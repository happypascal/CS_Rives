// PDF du registre : une décision par bloc, table des matières paginée.
//
// Refonte du 2026-07-17 sur retour de Pascal (« ne va pas du tout »). Le contenu
// était validé ; c'était la forme. Voir les commentaires de chaque section pour
// le pourquoi de chaque choix — plusieurs sont contre-intuitifs.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, eur, htmlToText } from './format'
import { tally, tallySummary, VOTE_LABELS } from './decisionLogic'
import { PROJET_ACTION_NOMS } from './projetLogic'
import { decisionResumeTexte } from './decisionResume'
import { ORG } from './config'
import { ASSISTANT_REGULAR, ASSISTANT_BOLD } from './fonts/assistant'

const NAVY = [31, 56, 100] // #1F3864
const INK = [30, 37, 48]
const GREY = [120, 120, 120]
const GREEN = [21, 128, 61]
const RED = [185, 28, 28]

// Marges. 14 mm au lieu de 20 : Pascal les trouvait trop grandes, et la colonne
// « Objet » de la table des matières a besoin de cette largeur.
const M = 14
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - 2 * M
const BOTTOM = PAGE_H - 16 // laisse la place au pied de page

// Espace vertical unique : sous l'en-tête de page, et entre deux décisions.
// Pascal : « prévoir un espace entre entête et entre chaque décision toujours
// identique ». Une seule constante — deux valeurs finiraient par diverger.
const GAP = 8

// Le cadre de chaque décision déborde des marges de texte de 3 mm.
const FRAME_PAD = 3

// Normalise le texte avant de le dessiner. INDISPENSABLE.
//
// Intl.NumberFormat('fr-FR') sépare les milliers avec U+202F (espace fine
// insécable) et précède le € d'un U+00A0. U+202F n'existe ni dans WinAnsi, ni
// dans le sous-ensemble latin d'Assistant : jsPDF retombait sur l'octet de poids
// faible, 0x202F & 0xFF = 0x2F = « / » — d'où « 20/000,00 » signalé par Pascal.
// Le même caractère faussait la mesure de largeur, donc la coupe des lignes :
// la colonne Objet de la TdM débordait de son cadre. UN caractère, trois bugs.
//
// Remplacé par U+00A0, couvert par la police et insécable comme l'original : un
// montant ne doit pas se couper en fin de ligne.
// Échappements explicites, jamais les caractères littéraux : U+202F et U+2009
// sont invisibles dans un éditeur — un copier-coller les perdrait sans que
// personne ne voie la règle disparaître.
const pdfText = (s) => String(s ?? '').replace(/[\u202F\u2009]/g, '\u00A0')

// Enregistre Assistant. Pascal : « Arial c'est moche ». Effet de bord utile —
// une police embarquée passe en Identity-H, donc Unicode, là où les polices
// standard de jsPDF sont limitées à WinAnsi.
function setupFont(doc) {
  doc.addFileToVFS('Assistant-Regular.ttf', ASSISTANT_REGULAR)
  doc.addFont('Assistant-Regular.ttf', 'Assistant', 'normal')
  doc.addFileToVFS('Assistant-Bold.ttf', ASSISTANT_BOLD)
  doc.addFont('Assistant-Bold.ttf', 'Assistant', 'bold')
  doc.setFont('Assistant', 'normal')
}

// ⚠ Assistant n'a pas d'italique embarqué. Toute demande d'italique serait
// synthétisée ou ignorée : on marque les incises par la taille et le gris.
const font = (doc, style = 'normal', size = 10, color = INK) => {
  doc.setFont('Assistant', style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

const text = (doc, s, x, y, opts) => doc.text(pdfText(s), x, y, opts)

// Coupe un texte à la largeur donnée, après normalisation — sinon les largeurs
// sont mesurées sur des caractères que la police ne connaît pas.
const lines = (doc, s, width) => doc.splitTextToSize(pdfText(s), width)

// Bandeau de tête. Réservé à la première page : Pascal — « l'en-tête registre
// des décisions est inutile sur les pages des décisions ». Le titre du document
// n'a besoin d'être affirmé qu'une fois ; ensuite c'est du bruit qui mange la
// hauteur utile dont on a besoin pour tenir deux décisions par page.
function coverHeader(doc) {
  font(doc, 'bold', 14, NAVY)
  text(doc, 'REGISTRE DES DÉCISIONS', PAGE_W / 2, 18, { align: 'center' })
  font(doc, 'normal', 9, NAVY)
  text(doc, `${ORG.name} — ${ORG.lotissement}, ${ORG.commune}`, PAGE_W / 2, 24, { align: 'center' })
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.4)
  doc.line(M, 28, PAGE_W - M, 28)
  return 28 + GAP // même écart que celui qui sépare deux décisions
}

// Pieds de page numérotés, posés à la FIN sur toutes les pages : « Page 3 / 12 »
// exige de connaître le total, qui n'est connu qu'une fois tout dessiné. Exigé
// par Pascal — une table des matières sans numéros de page ne sert à rien.
function paginate(doc) {
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    font(doc, 'normal', 8, GREY)
    text(doc, `${ORG.lotissement} — Registre des décisions du Conseil Syndical`, M, PAGE_H - 8)
    text(doc, `Page ${p} / ${total}`, PAGE_W - M, PAGE_H - 8, { align: 'right' })
  }
}

// Réserve `needed` mm ; ouvre une page si le bloc ne tient pas. C'est ce qui
// permet à deux décisions de partager une page au lieu d'un saut systématique.
function ensure(doc, y, needed) {
  if (y + needed <= BOTTOM) return y
  doc.addPage()
  return 20
}

function sectionTitle(doc, label, y) {
  y = ensure(doc, y, 10)
  font(doc, 'bold', 9, NAVY)
  text(doc, label, M, y)
  return y + 4.5
}

// Le cadre d'une décision. Dessiné APRÈS coup : sa hauteur n'est connue qu'une
// fois le contenu posé. Un bloc peut enjamber plusieurs pages — on ferme alors
// un rectangle par page, sinon le trait serait tiré dans le vide.
function drawFrame(doc, startPage, startY, endY) {
  const endPage = doc.internal.getCurrentPageInfo().pageNumber
  doc.setDrawColor(205, 212, 222)
  doc.setLineWidth(0.3)
  for (let p = startPage; p <= endPage; p++) {
    doc.setPage(p)
    const top = p === startPage ? startY : 16
    const bot = p === endPage ? endY : BOTTOM + 2
    doc.roundedRect(M - FRAME_PAD, top, CONTENT_W + FRAME_PAD * 2, bot - top, 1.5, 1.5)
  }
  doc.setPage(endPage)
}

// Un bloc « décision », à partir de `y`. Renvoie le y de sortie.
//
// Ne force JAMAIS de saut de page en entrée : c'est l'appelant qui décide. Le
// contenu s'écoule et ouvre une page quand il déborde (cf. ensure).
function decisionBlock(doc, decision, opts = {}) {
  const { members = [], votes = [], qa = [], includeQA = true, contexte = {}, y: startY = 20 } = opts
  const startPage = doc.internal.getCurrentPageInfo().pageNumber
  let y = startY

  const composition = decision.composition_snapshot?.length ? decision.composition_snapshot : members
  const presidentId = composition.find((m) => m.role === 'president')?.id
  const t = tally(votes, composition.length, votes.find((v) => v.membre_id === presidentId)?.vote ?? null)
  const adoptee = t.quorumAtteint && t.adoptee

  // Bandeau : numéro à gauche, VERDICT à droite en couleur.
  doc.setFillColor(243, 246, 250)
  doc.rect(M - FRAME_PAD, y, CONTENT_W + FRAME_PAD * 2, 9, 'F')
  font(doc, 'bold', 11, NAVY)
  text(doc, `Décision n° ${decision.numero}`, M, y + 6.2)

  // « Non enregistrée » est un troisième état, distinct de rejetée : la décision
  // n'a pas encore été actée par le président, son verdict n'est pas définitif.
  const verdict = !decision.enregistree ? 'NON ENREGISTRÉE' : adoptee ? 'VALIDÉE' : 'REJETÉE'
  const verdictColor = !decision.enregistree ? GREY : adoptee ? GREEN : RED
  font(doc, 'bold', 11, verdictColor)
  text(doc, verdict, PAGE_W - M, y + 6.2, { align: 'right' })
  y += 9 + 5

  // Une seule date : celle de la décision. Publication et limite de réponse sont
  // de la mécanique de vote, sans intérêt une fois la délibération actée (Pascal).
  // Repli sur la publication pour une décision NON enregistrée : elle n'a pas
  // encore de date de décision, et une ligne sans aucune date serait pire.
  font(doc, 'normal', 8, GREY)
  text(
    doc,
    decision.date_enregistrement
      ? `Décidée le ${formatDate(decision.date_enregistrement)}`
      : `Publiée le ${formatDate(decision.date_publication)} — pas encore enregistrée`,
    M,
    y,
  )
  y += 6

  // L'objet, sans titre de section : gras bleu, il se lit comme un titre — c'en
  // est un. « OBJET » au-dessus ne disait rien que la mise en forme ne dise.
  font(doc, 'bold', 10, NAVY)
  const titleLines = lines(doc, decision.titre, CONTENT_W)
  y = ensure(doc, y, titleLines.length * 5)
  doc.text(titleLines, M, y)
  y += titleLines.length * 5 + 3

  const body = htmlToText(decision.description)
  if (body.trim()) {
    font(doc, 'normal', 10, INK)
    // Coupé ligne à ligne plutôt qu'en bloc : un texte long doit pouvoir
    // enjamber une page sans être tronqué ni déborder du bas.
    for (const line of lines(doc, body, CONTENT_W)) {
      y = ensure(doc, y, 5)
      doc.text(line, M, y)
      y += 5
    }
    y += 2
  }

  // Ce que la délibération fait au projet. Le PDF est la trace légale : il doit
  // dire ce que le CS a voté, pas seulement le texte de la décision.
  //
  // Titré « PROJET IMPACTÉ » et non « ENGAGEMENT BUDGÉTAIRE » : Pascal — ce
  // dernier est FAUX quand la décision suspend ou clôture un projet sans
  // engager un centime. On nomme le projet, puis ce qui lui arrive.
  //
  // Sans projet (engagement direct sur une résolution d'AG), le titre redevient
  // « ENGAGEMENT » : il n'y a pas de projet à impacter, et l'annoncer serait faux.
  const engage = decision.montant_engage != null && decision.montant_engage !== ''
  const effets = [
    engage ? `Engagement ${eur(decision.montant_engage)}` : null,
    decision.projet_action ? PROJET_ACTION_NOMS[decision.projet_action] : null,
  ].filter(Boolean)
  if (effets.length) {
    const surProjet = Boolean(decision.projet_id)
    y = sectionTitle(doc, surProjet ? 'PROJET IMPACTÉ' : 'ENGAGEMENT', y)
    if (surProjet) {
      font(doc, 'normal', 10, INK)
      y = ensure(doc, y, 5)
      text(doc, contexte.projetNom || '(projet non identifié)', M, y)
      y += 5
    } else if (contexte.cibleLabel) {
      font(doc, 'normal', 9, GREY)
      y = ensure(doc, y, 5)
      text(doc, `Sur ${contexte.cibleLabel}`, M, y)
      y += 5
    }
    font(doc, 'normal', 10, INK)
    for (const e of effets) {
      y = ensure(doc, y, 5)
      text(doc, e, M, y)
      y += 5
    }
    y += 2
  }

  // UNE table : composition ET vote de chacun, sans titre — le tableau se
  // présente tout seul (Pascal).
  //
  // Il y avait deux tables — la composition figée, puis le détail des votes —
  // qui répétaient les mêmes noms. Fusionnées ; un membre sans ligne de vote
  // porte « Pas voté », ce qui est exactement la définition statutaire de
  // l'absent (art. 15 : présent = a voté ; un non-vote est une absence, pas une
  // abstention). La table dit donc aussi qui devait signer.
  const voteBy = Object.fromEntries(votes.map((v) => [v.membre_id, v]))
  y = ensure(doc, y, 20)
  autoTable(doc, {
    startY: y,
    head: [['Membre', 'Rôle', 'Vote', 'Commentaire']],
    body: composition.map((m) => {
      const v = voteBy[m.id]
      return [
        pdfText(`${m.prenom} ${m.nom}`),
        m.role === 'president' ? 'Président' : 'Membre',
        v ? VOTE_LABELS[v.vote] || v.vote : 'Pas voté',
        pdfText(v?.commentaire || ''),
      ]
    }),
    theme: 'grid',
    styles: { font: 'Assistant', fontSize: 8, cellPadding: 1.5 },
    headStyles: { font: 'Assistant', fontStyle: 'bold', fillColor: NAVY, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 22 }, 2: { cellWidth: 22 }, 3: { cellWidth: 'auto' } },
    // Un membre qui n'a pas voté est grisé : l'absence doit se voir d'un coup d'œil.
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const m = composition[data.row.index]
      if (!voteBy[m?.id]) data.cell.styles.textColor = GREY
    },
    margin: { left: M, right: M, bottom: 16 },
  })
  y = doc.lastAutoTable.finalY + 5

  y = ensure(doc, y, 12)
  font(doc, 'normal', 9)
  text(doc, tallySummary(t.counts), M, y)
  y += 5
  font(doc, 'bold', 9, !t.quorumAtteint ? RED : adoptee ? GREEN : RED)
  text(doc, !t.quorumAtteint ? 'Quorum non atteint — décision rejetée' : adoptee ? 'Décision adoptée' : 'Décision rejetée', M, y)
  y += 5
  // Le registre doit porter la RAISON du départage, pas seulement son résultat.
  if (t.quorumAtteint && t.partage) {
    y = ensure(doc, y, 5)
    font(doc, 'normal', 7.5, GREY)
    text(doc, 'Partage des voix — voix prépondérante du président (art. 15 des statuts).', M, y)
    y += 4
  }
  y += 2

  if (includeQA && qa.length) {
    y = sectionTitle(doc, 'QUESTIONS ET RÉPONSES', y)
    font(doc, 'normal', 8.5)
    const nameById = Object.fromEntries(composition.map((m) => [m.id, `${m.prenom} ${m.nom}`]))
    for (const item of qa) {
      const indent = item.parent_id ? M + 6 : M
      const prefix = item.type === 'question' ? 'Q' : 'R'
      for (const line of lines(doc, `${prefix} — ${nameById[item.auteur_id] || 'Membre'} : ${item.texte}`, CONTENT_W - (indent - M))) {
        y = ensure(doc, y, 4.5)
        doc.text(line, indent, y)
        y += 4.5
      }
      y += 1.5
    }
    y += 2
  }

  // Pas de lignes de signature manuscrite ici — voir le commentaire de
  // downloadRegistrePDF pour le raisonnement (art. 15).

  const endY = y + 2
  drawFrame(doc, startPage, startY, endY)
  return endY
}

// ---- Décision seule -------------------------------------------------------

export function generateDecisionPDF(decision, opts) {
  const doc = new jsPDF()
  setupFont(doc)
  const y = coverHeader(doc)
  decisionBlock(doc, decision, { ...opts, y })
  paginate(doc)
  return doc
}

export function downloadDecisionPDF(decision, opts) {
  generateDecisionPDF(decision, opts).save(`decision-${decision.numero}.pdf`)
}

export function decisionPDFBlob(decision, opts) {
  return generateDecisionPDF(decision, opts).output('blob')
}

// ---- Registre complet -----------------------------------------------------

// Rend le registre entier. `tocPages` = numéro de page de chaque décision, ou
// null au premier passage (voir downloadRegistrePDF).
function buildRegistre(decisions, opts, tocPages) {
  const { getDetail, getContexte } = opts
  const doc = new jsPDF()
  setupFont(doc)

  let y = coverHeader(doc)
  font(doc, 'bold', 12, NAVY)
  text(doc, 'Table des matières', M, y)
  y += 6

  autoTable(doc, {
    startY: y,
    // « Objet » plutôt que « Titre » : le titre seul ne dit ni ce qu'on engage,
    // ni ce que la décision change. C'est le PDF qui part en signature — le
    // signataire doit savoir ce qu'il signe sans dépiler vingt pages.
    head: [['N°', 'Date', 'Objet', 'Statut', 'Page']],
    body: decisions.map((d, i) => [
      d.numero,
      formatDate(d.date_enregistrement || d.date_publication),
      pdfText(decisionResumeTexte(d, getContexte ? getContexte(d) : {}, { max: 180 })),
      { en_cours: 'En cours', adoptee: 'Adoptée', rejetee: 'Rejetée' }[d.statut] || d.statut,
      // Placeholder au 1er passage : même largeur de colonne, donc mêmes hauteurs
      // de ligne qu'au 2e — c'est ce qui rend la pagination stable.
      tocPages ? String(tocPages[i]) : '—',
    ]),
    theme: 'striped',
    styles: { font: 'Assistant', fontSize: 9, cellPadding: 1.5 },
    headStyles: { font: 'Assistant', fontStyle: 'bold', fillColor: NAVY },
    bodyStyles: { valign: 'top' },
    // L'objet prend toute la place restante ; le reste est étroit et fixe.
    // C'est le point que Pascal signalait : la colonne était trop serrée.
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 18 },
      4: { cellWidth: 12, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) data.cell.styles.fontSize = 8.5
    },
    margin: { left: M, right: M, bottom: 16 },
  })

  // Une décision par bloc, à la suite. Pas d'addPage systématique : deux
  // décisions courtes tiennent sur une page (demande de Pascal). On ouvre une
  // page seulement s'il ne reste pas de quoi commencer un bloc — sinon on
  // laisserait un en-tête de décision seul en bas de page.
  const startPages = []
  y = doc.lastAutoTable.finalY + GAP
  for (const d of decisions) {
    if (y + 60 > BOTTOM) {
      doc.addPage()
      y = 20
    }
    startPages.push(doc.getNumberOfPages())
    const detail = getDetail ? getDetail(d) : {}
    y = decisionBlock(doc, d, { ...opts, ...detail, contexte: getContexte ? getContexte(d) : {}, y })
    // Plus de trait séparateur : chaque décision a désormais son cadre, deux
    // lignes côte à côte feraient doublon. Un seul écart, le même que sous
    // l'en-tête de page.
    y += GAP
  }

  paginate(doc)
  return { doc, startPages }
}

// Deux passages : les numéros de page de la table des matières ne sont connus
// qu'une fois le document rendu, et la TdM est en tête. On rend donc une
// première fois pour relever les pages, une seconde avec les vrais numéros.
//
// Stable parce que le placeholder « — » et un numéro occupent la même colonne
// de largeur fixe : les hauteurs de ligne, donc la pagination, sont identiques
// d'un passage à l'autre.
//
// PAS de lignes de signature manuscrite (retirées le 2026-07-17, Pascal : « je
// comprends pas pourquoi il y a les signatures physiques sur chaque décision »).
// Elles venaient d'un registre papier. La signature retenue est ÉLECTRONIQUE
// (Youtrust, en manuel) : elle s'appose sur le document entier, pas décision par
// décision. Et la table « composition et votes » nomme désormais les présents,
// donc les signataires au sens de l'art. 15 — l'information est conservée, seul
// le trait à remplir au stylo disparaît. À restaurer si le CS revenait au papier.
export function downloadRegistrePDF(decisions, opts = {}) {
  const { startPages } = buildRegistre(decisions, opts, null)
  const { doc } = buildRegistre(decisions, opts, startPages)
  doc.save(`registre-CS-${new Date().getFullYear()}.pdf`)
}
