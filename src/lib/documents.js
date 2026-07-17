// Téléchargement d'une pièce jointe, côté navigateur.
//
// Le bucket est privé : il n'y a pas de `href` à poser dans le JSX, l'URL doit
// être signée au moment du clic et ne vit que quelques minutes. D'où un handler
// asynchrone là où il y avait un simple <a href={doc.dataUrl}>.
//
// `window.open()` après un `await` se fait bloquer comme popup (le geste
// utilisateur a expiré). Une ancre cliquée par le code, elle, reste une
// navigation et passe. Le Storage répondant en Content-Disposition: attachment
// (option `download` de createSignedUrl), le fichier se télécharge sans quitter
// la page.
import { repo } from './api'

export async function downloadDocument(doc) {
  const url = await repo.getDocumentUrl(doc)
  const a = document.createElement('a')
  a.href = url
  // Les dataUrl (pièces jointes d'avant le Storage) sont same-origin : c'est
  // l'attribut qui leur donne le bon nom de fichier. Sur une URL signée il
  // serait ignoré — c'est le serveur qui s'en charge.
  if (doc.dataUrl) a.download = doc.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
