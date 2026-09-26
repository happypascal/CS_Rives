// PDF du registre : une décision par bloc, table des matières paginée.
//
// Refonte du 2026-07-17 sur retour de Pascal (« ne va pas du tout »). Le contenu
// était validé ; c'était la forme. Voir les commentaires de chaque section pour
// le pourquoi de chaque choix — plusieurs sont contre-intuitifs.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, eur, htmlToText } from './format'
import { tally, tallySummary, engagementApprouve, VOTE_LABELS, phaseOf } from './decisionLogic'
import { PROJET_ACTION_NOMS } from './projetLogic'
import { decisionResumeTexte } from './decisionResume'
import { ORG } from './config'
import { emailsOfficiels } from './proprietaireLogic'
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
  // Même garde d'engagement qu'à l'écran (point 3) : le verdict du PDF doit
  // coïncider avec l'adoption calculée dans DecisionDetail.
  const t = tally(votes, composition.length, votes.find((v) => v.membre_id === presidentId)?.vote ?? null, {
    engagementApprouve: engagementApprouve(decision, votes, composition),
  })
  const adoptee = t.quorumAtteint && t.adoptee

  // Bandeau : numéro à gauche, VERDICT à droite en couleur.
  doc.setFillColor(243, 246, 250)
  doc.rect(M - FRAME_PAD, y, CONTENT_W + FRAME_PAD * 2, 9, 'F')
  font(doc, 'bold', 11, NAVY)
  text(doc, `Décision n° ${decision.numero}`, M, y + 6.2)

  // « ADOPTÉE », pas « VALIDÉE » — un seul mot pour une seule chose. Pascal avait
  // demandé « VALIDÉ » en en-tête, mais « adoptée » est le terme de l'art. 15, de
  // la colonne `statut` ('adoptee') et des badges de l'app : « validée » aurait
  // fait diverger le registre légal du vocabulaire de tout le reste.
  //
  // « Non enregistrée » est un troisième état, distinct de rejetée : la décision
  // n'a pas encore été actée par le président, son verdict n'est pas définitif.
  //
  // « ANNULÉE » est un quatrième état (migration 026) : la décision a été
  // retirée AVANT toute soumission au conseil. Elle reste au registre — rien ne
  // disparaît — mais elle n'a jamais été délibérée, donc ni adoptée ni rejetée.
  const annulee = phaseOf(decision) === 'annulee'
  const verdict = annulee ? 'ANNULÉE' : !decision.enregistree ? 'NON ENREGISTRÉE' : adoptee ? 'ADOPTÉE' : 'REJETÉE'
  const verdictColor = annulee ? RED : !decision.enregistree ? GREY : adoptee ? GREEN : RED
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
    annulee
      ? `Annulée avant soumission au conseil${decision.motif_annulation ? ` — ${decision.motif_annulation}` : ''}`
      : decision.date_enregistrement
        ? `Décidée le ${formatDate(decision.date_enregistrement)}`
        : `Publiée le ${formatDate(decision.date_publication)} — pas encore enregistrée`,
    M,
    y,
  )
  y += 4

  // Mention de valeur probante (migration 026), affichée seulement quand elle
  // existe — les décisions antérieures au gel n'en ont pas : l'empreinte du
  // texte figé à l'ouverture du vote, qui prouve que le texte imprimé ici est
  // bien celui sur lequel les membres ont voté.
  const mentions = [
    decision.hash_contenu ? `Empreinte SHA-256 du texte voté : ${decision.hash_contenu}` : null,
  ].filter(Boolean)
  for (const mention of mentions) {
    font(doc, 'normal', 7, GREY)
    for (const line of lines(doc, mention, CONTENT_W)) {
      y = ensure(doc, y, 3.5)
      doc.text(line, M, y)
      y += 3.5
    }
  }
  y += mentions.length ? 3 : 2

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

  // Le décompte, puis la RAISON quand il en faut une — jamais le verdict, qui
  // est déjà dans le bandeau. Il y était écrit deux fois, et avec deux mots
  // différents (« VALIDÉE » en haut, « Décision adoptée » ici) : c'est ce que
  // Pascal a relevé. Un verdict, un endroit, un mot.
  y = ensure(doc, y, 12)
  font(doc, 'normal', 9)
  text(doc, tallySummary(t.counts), M, y)
  y += 5
  const raison = !t.quorumAtteint
    ? 'Quorum non atteint — la majorité des membres actifs ne s’est pas exprimée.'
    : t.partage
      ? 'Partage des voix — voix prépondérante du président (art. 15 des statuts).'
      : null
  if (raison) {
    y = ensure(doc, y, 5)
    font(doc, 'normal', 7.5, GREY)
    text(doc, raison, M, y)
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

// Hauteur d'un bloc, mesurée en le dessinant pour de faux.
//
// Pascal : « il faut faire un saut de page avant si le cadre empiète sur 2
// pages ». Impossible à décider sans la hauteur — et la hauteur d'une décision
// n'est connue qu'une fois posée (texte coupé selon la police, table dont les
// lignes s'ajustent au contenu). Un calcul analytique redirait la mise en page
// une deuxième fois, et divergerait au premier changement.
//
// D'où le brouillon : même code, doc jetable, on lit le y de sortie. Le doc est
// réutilisé d'un appel à l'autre — chaque page de brouillon coûte peu, mais
// réenregistrer la police à chaque mesure coûterait cher (75 ko de base64).
//
// Renvoie Infinity si le bloc dépasse une page à lui seul : aucun saut ne le
// fera tenir, autant le commencer proprement en haut d'une page et le laisser
// s'écouler.
function makeMeasurer() {
  const scratch = new jsPDF()
  setupFont(scratch)
  return (decision, opts) => {
    scratch.addPage()
    const p0 = scratch.internal.getCurrentPageInfo().pageNumber
    const endY = decisionBlock(scratch, decision, { ...opts, y: 20 })
    const p1 = scratch.internal.getCurrentPageInfo().pageNumber
    return p1 === p0 ? endY - 20 : Infinity
  }
}

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
      // Annulée = phase, pas statut : une décision retirée avant soumission n'est
      // ni « en cours », ni adoptée, ni rejetée (migration 026).
      phaseOf(d) === 'annulee' ? 'Annulée' : { en_cours: 'En cours', adoptee: 'Adoptée', rejetee: 'Rejetée' }[d.statut] || d.statut,
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
  // décisions courtes tiennent sur une page (demande de Pascal). Mais un cadre
  // ne doit pas se couper en deux : on mesure d'abord, et on saute la page si
  // le bloc ne tient pas dans ce qui reste.
  const measure = makeMeasurer()
  const startPages = []
  y = doc.lastAutoTable.finalY + GAP
  for (const d of decisions) {
    const detail = getDetail ? getDetail(d) : {}
    const contexte = getContexte ? getContexte(d) : {}
    const h = measure(d, { ...opts, ...detail, contexte })
    // `y > 20` : si on est déjà en haut d'une page, sauter n'apporterait rien —
    // et sur un bloc plus haut qu'une page (h = Infinity) on bouclerait.
    if (y + h > BOTTOM && y > 20) {
      doc.addPage()
      y = 20
    }
    startPages.push(doc.getNumberOfPages())
    y = decisionBlock(doc, d, { ...opts, ...detail, contexte, y })
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

// ============================================================================
// ÉTAT DES COLOTIS POUR LE NOTAIRE — liste à retourner annotée
//
// Demande de Pascal (2026-09-26). La résolution n° 15 de l'AG 2026 impose à
// chaque coloti d'adresser son titre de propriété à Me Garnier avant le
// 31 octobre, pour qu'il puisse publier les statuts. Le notaire a besoin de la
// liste des parcelles et de leurs propriétaires, et d'un endroit où noter ce
// qu'il a reçu.
//
// ⚠ CE DOCUMENT SORT DU REGISTRE DES PROPRIÉTAIRES. La mention RGPD acceptée par
// chaque membre (migration 035) dit : « Vous ne pouvez communiquer à quiconque —
// coloti, tiers, prestataire — d'autre information que le nom du propriétaire,
// son adresse dans le lotissement et son numéro de lot. Les adresses de
// communication, adresses électroniques et numéros de téléphone ne sortent pas
// de ce registre. »
//
// ⚠ LES ADRESSES ÉLECTRONIQUES Y FIGURENT MALGRÉ TOUT, SUR ARBITRAGE EXPRÈS DE
// PASCAL (2026-09-26) : « chaque coloti va lui envoyer son acte de vente donc tu
// peux mettre les emails dans ce fichier ». La mention prévoit elle-même cette
// voie — elle interdit de communiquer « sans arbitrage », pas d'arbitrer. Le
// notaire doit pouvoir rapprocher un acte reçu d'une parcelle et relancer qui
// n'a pas répondu ; sans adresse, il renverrait la relance au conseil.
// ⚠ ET LE DESTINATAIRE COMPTE AUTANT QUE LA DONNÉE : « c'est un notaire, pas un
// quidam » (Pascal). Un officier public, tenu au secret professionnel, mandaté
// par la résolution n° 15 de l'AG 2026 pour publier les statuts. La même liste
// adressée à un prestataire ou à un coloti serait une divulgation.
// ⚠ C'EST UNE DÉCISION, PAS UN RÉGLAGE : ne pas l'étendre à un autre destinataire
// sans un nouvel arbitrage. Elle engage la responsabilité de celui qui envoie.
//
// Restent EXCLUS, et doivent le rester : les adresses de communication (domiciles
// hors lotissement) et les numéros de téléphone.
//
// Les adresses retenues sont les CONTACTS OFFICIELS (migration 044), pas la
// colonne `email` : c'est à eux que l'association écrit, dirigeant de SCI ou
// mandataire compris. Prendre `email` seul aurait privé le notaire de
// l'interlocuteur réel de la moitié des sociétés.
//
// ⚠ LA COLONNE « ACTE REÇU LE » REPORTE CE QUE LE REGISTRE SAIT DÉJÀ, et reste
// vide partout ailleurs (migration 059). Ce n'est pas une contradiction avec le
// principe « l'application ne constate rien » : les dates imprimées sont celles
// que le NOTAIRE a lui-même communiquées, et qu'on lui rend. C'est ce qui
// transforme un second envoi en RELANCE — il voit d'un coup d'œil les lignes qui
// restent blanches, au lieu de recommencer un pointage complet.
// ⚠ Au premier envoi, la colonne est entièrement vide : le registre ne sait rien
// encore, et c'est exactement ce qu'il doit montrer.
// ============================================================================

// ⚠ PAS `num()` DE `ui.jsx` : ce module ne doit pas dépendre d'un fichier React,
// et surtout `Intl` en fr-FR insère une espace fine U+202F — le caractère qui a
// donné « 20/000,00 » dans un PDF (voir `pdfText` en tête de fichier). Les
// cellules d'`autoTable` ne passent PAS par `text()`, donc pas par `pdfText` :
// la correction doit être appliquée ici, à la source.
const nombre = (n) => pdfText(new Intl.NumberFormat('fr-FR').format(Number(n) || 0))

// Le second propriétaire est NOMMÉ : une indivision ou un couple, ce sont deux
// personnes à qui le notaire devra réclamer un titre. N'en nommer qu'une
// laisserait croire qu'un seul acte suffit.
function nomsDuLot(lot) {
  const p = lot.proprietaire
  if (!p) return null
  return pdfText([p.nom, p.nom_2].filter(Boolean).join(' / '))
}

export function downloadRegistreNotairePDF(lots, opts = {}) {
  // ⚠ PAYSAGE. Sept colonnes, dont une d'adresses électroniques et deux laissées
  // libres pour l'annotation, ne tiennent pas en portrait : les courriels s'y
  // coupaient en trois lignes. Les constantes du module décrivent une page
  // portrait — on les redéfinit ICI plutôt que de les modifier, pour ne rien
  // changer au PDF du registre des décisions.
  const doc = new jsPDF({ orientation: 'landscape' })
  const W = 297
  const H = 210
  const LARGEUR = W - 2 * M
  const BAS = H - 16
  setupFont(doc)

  font(doc, 'bold', 14, NAVY)
  text(doc, 'ÉTAT DES COLOTIS', W / 2, 18, { align: 'center' })
  font(doc, 'normal', 9, NAVY)
  text(doc, `${ORG.name} — ${ORG.lotissement}, ${ORG.commune}`, W / 2, 24, { align: 'center' })
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.4)
  doc.line(M, 28, W - M, 28)

  let y = 28 + GAP
  font(doc, 'normal', 9, INK)
  // ⚠ L'intro DIT si la colonne porte déjà des dates : un document qui en montre
  // sans expliquer d'où elles viennent laisserait croire que l'association tient
  // un décompte parallèle au sien.
  const dejaRecus = lots.filter((l) => l.proprietaire?.acte_transmis_le).length
  const intro = opts.intro || (
    dejaRecus > 0
      ? `Liste des parcelles et de leurs propriétaires actuels, établie d’après le registre tenu par le Conseil Syndical, avec l’adresse électronique à laquelle chacun peut être joint. Les ${dejaRecus} titres déjà signalés reçus sont reportés ci-dessous ; les lignes restées vides sont celles que nous relançons.`
      : 'Liste des parcelles et de leurs propriétaires actuels, établie d’après le registre tenu par le Conseil Syndical, avec l’adresse électronique à laquelle chacun peut être joint. Les deux dernières colonnes sont laissées libres pour noter les titres de propriété reçus.'
  )
  for (const l of lines(doc, intro, LARGEUR)) {
    text(doc, l, M, y)
    y += 4.5
  }
  y += 2
  font(doc, 'normal', 8, GREY)
  text(doc, `Édité le ${formatDate(new Date().toISOString().slice(0, 10))}`, M, y)
  y += GAP

  // ⚠ Les parcelles VACANTES restent dans la liste, avec la mention explicite :
  // une ligne absente se lirait « rien à réclamer ici », alors qu'elle signifie
  // « nous ne savons pas à qui la réclamer ». C'est exactement ce que le notaire
  // doit voir.
  const body = lots.map((l) => [
    pdfText(l.numero || ''),
    nomsDuLot(l) || '— propriétaire inconnu —',
    // ⚠ TOUTES les adresses officielles, séparées par un retour à la ligne : un
    // lot à deux noms se réclame aux deux. N'en montrer qu'une laisserait croire
    // qu'un seul acte est attendu.
    pdfText(emailsOfficiels(l.proprietaire).join('\n')),
    pdfText(l.adresse_lotissement || ''),
    l.superficie != null ? `${nombre(l.superficie)} m²` : '',
    l.proprietaire?.acte_transmis_le ? formatDate(l.proprietaire.acte_transmis_le) : '',
    pdfText(l.proprietaire?.acte_observations || ''),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Parcelle', 'Propriétaire(s)', 'Courriel', 'Adresse dans le lotissement', 'Superficie', 'Acte reçu le', 'Observations']],
    body,
    theme: 'grid', // quadrillage complet : on écrit dedans à la main
    styles: { font: 'Assistant', fontSize: 8.5, cellPadding: 1.8, lineColor: [190, 190, 190] },
    headStyles: { font: 'Assistant', fontStyle: 'bold', fillColor: NAVY, fontSize: 8.5 },
    bodyStyles: { valign: 'middle', minCellHeight: 8 },
    // ⚠ PAYSAGE et colonnes resserrées : sept colonnes dont deux à remplir à la
    // main ne tiennent pas en portrait sans que les courriels ne se coupent.
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 46 },
      2: { cellWidth: 'auto', fontSize: 7.5 },
      3: { cellWidth: 38 },
      4: { cellWidth: 17, halign: 'right' },
      5: { cellWidth: 20 },
      6: { cellWidth: 28 },
    },
    didParseCell: (data) => {
      // Une parcelle sans propriétaire connu se voit : c'est une réclamation
      // que le notaire ne pourra pas adresser.
      if (data.section === 'body' && data.column.index === 1 && data.cell.raw === '— propriétaire inconnu —') {
        data.cell.styles.textColor = RED
      }
    },
    margin: { left: M, right: M, bottom: 16 },
  })

  y = doc.lastAutoTable.finalY + GAP
  // `ensure` raisonne en portrait : on refait le test avec la hauteur réelle.
  if (y + 24 > BAS) { doc.addPage(); y = 20 }
  font(doc, 'normal', 8, GREY)
  const totalLots = lots.reduce((s, l) => s + (Number(l.nombre_lots) || 1), 0)
  text(doc, `${lots.length} parcelle(s) — ${nombre(totalLots)} lot(s).`, M, y)
  y += 5
  // ⚠ La mention de protection voyage AVEC le document : une fois envoyé, il
  // n'est plus sous le contrôle du conseil, et le destinataire doit savoir à
  // quoi il est tenu.
  for (const l of lines(doc, 'Ce document contient des données à caractère personnel, communiquées au notaire de l’association au seul titre de la publication des statuts (résolution n° 15 de l’assemblée générale 2026). Il ne doit être ni rediffusé, ni utilisé à d’autres fins.', LARGEUR)) {
    text(doc, l, M, y)
    y += 4
  }

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    font(doc, 'normal', 8, GREY)
    text(doc, `${ORG.lotissement} — état des colotis`, M, H - 8)
    text(doc, `Page ${p} / ${total}`, W - M, H - 8, { align: 'right' })
  }

  doc.save(`etat-colotis-ASL-Rives-${new Date().toISOString().slice(0, 10)}.pdf`)
}
