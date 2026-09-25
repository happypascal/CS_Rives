// LECTURE DE PDF — couche texte d'abord, OCR français ensuite.
//
// ⚠ POURQUOI DU SWIFT DANS UN DÉPÔT REACT. Les procès-verbaux d'assemblée
// depuis 1955 sont des SCANS : sans reconnaissance de caractères, ils ne sont
// pas cherchables, et une archive qu'on ne peut pas interroger ne sert qu'à
// celui qui sait déjà où regarder. Or cette machine n'a ni `tesseract`, ni
// `ocrmypdf`, ni `pdftotext`, ni Homebrew pour les installer — vérifié, pas
// supposé. Elle a en revanche PDFKit et Vision, livrés avec macOS, dont la
// reconnaissance française est bonne. Vingt lignes de Swift valent mieux qu'une
// dépendance qu'on ne peut pas installer.
//
// ⚠ LA COUCHE TEXTE PRIME TOUJOURS SUR L'OCR. Un PDF qui porte déjà son texte
// (PV récent, export numérique) donne un résultat EXACT ; l'océriser par-dessus
// n'ajouterait que des fautes. L'OCR n'est qu'un pis-aller pour le papier.
//
// ⚠ TOUS LES FICHIERS EN UN SEUL APPEL. `swift fichier.swift` recompile à
// chaque exécution : un appel par PDF coûterait plusieurs minutes sur soixante-
// dix documents, pour rien.
//
// Usage :  swift scripts/lire_pdf.swift <fichier.pdf> [<fichier.pdf> …]
// Sortie :  une ligne JSON par fichier —
//           {"path":…,"pages":N,"source":"texte|ocr|mixte|aucun","text":…,"erreur":…}

import Foundation
import PDFKit
import Vision

// Reconnaissance sur une image de page. Renvoie nil si Vision échoue : l'appelant
// distingue « rien reconnu » (page blanche, scan illisible) d'une panne.
func ocr(_ image: CGImage) -> String? {
    let requete = VNRecognizeTextRequest()
    requete.recognitionLevel = .accurate
    // ⚠ Le français D'ABORD : ces documents sont français, et laisser Vision
    // hésiter avec l'anglais produit des « the » à la place des « de ».
    requete.recognitionLanguages = ["fr-FR", "en-US"]
    // Correction linguistique activée : sur du texte suivi elle aide plus
    // qu'elle ne nuit. Les noms propres en souffrent — raison de plus pour ne
    // jamais CITER un texte océrisé, seulement le chercher.
    requete.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([requete])
    } catch {
        return nil
    }
    guard let observations = requete.results else { return nil }
    return observations
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")
}

// Rendu d'une page en image. 2× la taille nominale : à l'échelle 1, un scan de
// 1955 passe sous le seuil de lisibilité de Vision et ne rend presque rien.
func image(de page: PDFPage) -> CGImage? {
    let rect = page.bounds(for: .mediaBox)
    let echelle: CGFloat = 2.0
    let largeur = Int(rect.width * echelle)
    let hauteur = Int(rect.height * echelle)
    guard largeur > 0, hauteur > 0,
          let espace = CGColorSpace(name: CGColorSpace.sRGB),
          let contexte = CGContext(data: nil, width: largeur, height: hauteur,
                                   bitsPerComponent: 8, bytesPerRow: 0,
                                   space: espace,
                                   bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else { return nil }
    contexte.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    contexte.fill(CGRect(x: 0, y: 0, width: largeur, height: hauteur))
    contexte.scaleBy(x: echelle, y: echelle)
    contexte.translateBy(x: -rect.origin.x, y: -rect.origin.y)
    page.draw(with: .mediaBox, to: contexte)
    return contexte.makeImage()
}

func echappe(_ s: String) -> String {
    let data = try? JSONSerialization.data(withJSONObject: [s], options: [])
    guard let data, let texte = String(data: data, encoding: .utf8) else { return "\"\"" }
    // On retire les crochets du tableau : il ne reste que la chaîne échappée.
    return String(texte.dropFirst().dropLast())
}

func emet(path: String, pages: Int, source: String, text: String, erreur: String?) {
    var ligne = "{\"path\":\(echappe(path)),\"pages\":\(pages),\"source\":\"\(source)\","
    ligne += "\"text\":\(echappe(text))"
    if let erreur { ligne += ",\"erreur\":\(echappe(erreur))" }
    ligne += "}"
    print(ligne)
}

let fichiers = Array(CommandLine.arguments.dropFirst())
if fichiers.isEmpty {
    FileHandle.standardError.write("usage: swift lire_pdf.swift <fichier.pdf> …\n".data(using: .utf8)!)
    exit(2)
}

for chemin in fichiers {
    guard let document = PDFDocument(url: URL(fileURLWithPath: chemin)) else {
        emet(path: chemin, pages: 0, source: "aucun", text: "", erreur: "PDF illisible")
        continue
    }
    var morceaux: [String] = []
    var pagesTexte = 0
    var pagesOcr = 0
    for i in 0..<document.pageCount {
        guard let page = document.page(at: i) else { continue }
        let brut = (page.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        // Seuil volontairement bas : quelques caractères parasites ne font pas
        // une couche texte. En dessous, on considère la page comme du papier.
        if brut.count >= 20 {
            morceaux.append(brut)
            pagesTexte += 1
        } else if let img = image(de: page), let reconnu = ocr(img) {
            let propre = reconnu.trimmingCharacters(in: .whitespacesAndNewlines)
            if !propre.isEmpty {
                morceaux.append(propre)
                pagesOcr += 1
            }
        }
    }
    let source: String
    if pagesTexte > 0 && pagesOcr > 0 { source = "mixte" }
    else if pagesTexte > 0 { source = "texte" }
    else if pagesOcr > 0 { source = "ocr" }
    else { source = "aucun" }
    emet(path: chemin, pages: document.pageCount, source: source,
         text: morceaux.joined(separator: "\n\n"), erreur: nil)
}
