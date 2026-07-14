import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './format'
import { tally, tallySummary, VOTE_LABELS } from './decisionLogic'
import { ORG } from './config'

const NAVY = [31, 56, 100] // #1F3864

// Strip minimal HTML from rich-text descriptions into plain text with line breaks.
function htmlToText(html) {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  // list items -> "• " lines
  tmp.querySelectorAll('li').forEach((li) => {
    li.textContent = '• ' + li.textContent
  })
  const text = tmp.textContent || tmp.innerText || ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function header(doc, title) {
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('REGISTRE DES DÉCISIONS', 105, 18, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${ORG.name} — ${ORG.lotissement}, ${ORG.commune}`, 105, 24, { align: 'center' })
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.4)
  doc.line(20, 28, 190, 28)
  if (title) {
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(title, 20, 38)
  }
}

function sectionTitle(doc, text, y) {
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(text, 20, y)
  return y + 5
}

// Build one decision block starting at y, returns the new y (may add pages).
function decisionBlock(doc, decision, opts = {}) {
  const { members = [], votes = [], qa = [], includeQA = true } = opts
  let y = 44

  doc.setTextColor(30, 37, 48)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Décision n° ${decision.numero}`, 20, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const dLabel = decision.date_enregistrement
    ? `Enregistrée le ${formatDate(decision.date_enregistrement)}`
    : `Publiée le ${formatDate(decision.date_publication)}`
  doc.text(dLabel, 190, y, { align: 'right' })
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Publication : ${formatDate(decision.date_publication)}  ·  Limite réponse : ${formatDate(decision.date_limite_reponse)}`, 20, y)
  doc.setTextColor(30, 37, 48)
  y += 6

  y = sectionTitle(doc, 'OBJET', y)
  doc.setTextColor(30, 37, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const titleLines = doc.splitTextToSize(decision.titre, 170)
  doc.text(titleLines, 20, y)
  y += titleLines.length * 5 + 3

  y = sectionTitle(doc, 'DÉCISION', y)
  const bodyLines = doc.splitTextToSize(htmlToText(decision.description), 170)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(bodyLines, 20, y)
  y += bodyLines.length * 5 + 4

  // Budget alloué (attribut de la décision).
  if (decision.budget_alloue != null && decision.budget_alloue !== '') {
    const montant = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(decision.budget_alloue))
    y = sectionTitle(doc, 'BUDGET ALLOUÉ', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${montant}${decision.budget_intitule ? ' — ' + decision.budget_intitule : ''}`, 20, y)
    y += 6
  }

  // Composition snapshot (fall back to current members).
  const composition = decision.composition_snapshot?.length
    ? decision.composition_snapshot
    : members
  autoTable(doc, {
    startY: y,
    head: [['Nom', 'Prénom', 'Rôle', 'Élu en AG']],
    body: composition.map((m) => [
      m.nom,
      m.prenom,
      m.role === 'president' ? 'Président' : 'Membre',
      m.ag_election || (m.date_election ? formatDate(m.date_election) : '—'),
    ]),
    theme: 'grid',
    headStyles: { fillColor: NAVY, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 20, right: 20 },
    didDrawPage: () => {},
  })
  y = doc.lastAutoTable.finalY + 6

  // Vote result
  const t = tally(votes, composition.length)
  y = sectionTitle(doc, 'RÉSULTAT DU VOTE', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 37, 48)
  doc.text(tallySummary(t.counts), 20, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  const verdict = !t.quorumAtteint
    ? 'QUORUM NON ATTEINT — DÉCISION REJETÉE'
    : t.adoptee
      ? '→ Décision ADOPTÉE'
      : '→ Décision REJETÉE'
  doc.setTextColor(...(t.adoptee && t.quorumAtteint ? [21, 128, 61] : [185, 28, 28]))
  doc.text(verdict, 20, y)
  y += 8

  // Vote detail
  if (votes.length) {
    y = sectionTitle(doc, 'DÉTAIL DES VOTES', y)
    const nameById = Object.fromEntries(composition.map((m) => [m.id, `${m.prenom} ${m.nom}`]))
    autoTable(doc, {
      startY: y,
      head: [['Membre', 'Vote', 'Commentaire']],
      body: votes.map((v) => [nameById[v.membre_id] || '—', VOTE_LABELS[v.vote] || v.vote, v.commentaire || '']),
      theme: 'grid',
      headStyles: { fillColor: NAVY, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20, right: 20 },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // Q&A
  if (includeQA && qa.length) {
    y = sectionTitle(doc, 'QUESTIONS ET RÉPONSES', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 37, 48)
    const nameById = Object.fromEntries(composition.map((m) => [m.id, `${m.prenom} ${m.nom}`]))
    for (const item of qa) {
      const prefix = item.type === 'question' ? 'Q' : 'R'
      const lines = doc.splitTextToSize(
        `${prefix} — ${nameById[item.auteur_id] || 'Membre'} : ${item.texte}`,
        item.parent_id ? 160 : 170,
      )
      if (y > 260) {
        doc.addPage()
        y = 20
      }
      doc.text(lines, item.parent_id ? 28 : 20, y)
      y += lines.length * 5 + 2
    }
    y += 4
  }

  // Signatures
  if (y > 240) {
    doc.addPage()
    y = 20
  }
  y = sectionTitle(doc, 'SIGNATURES', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 37, 48)
  const signers = composition
  let col = 0
  let rowY = y + 4
  for (const m of signers) {
    const x = col === 0 ? 20 : 110
    doc.text(`${m.prenom} ${m.nom}`, x, rowY)
    doc.setDrawColor(150)
    doc.line(x, rowY + 12, x + 70, rowY + 12)
    if (col === 1) {
      rowY += 22
      col = 0
    } else {
      col = 1
    }
  }
  return rowY
}

// Single decision PDF -> opens in a new tab / triggers download.
export function generateDecisionPDF(decision, opts) {
  const doc = new jsPDF()
  header(doc)
  decisionBlock(doc, decision, opts)
  return doc
}

export function downloadDecisionPDF(decision, opts) {
  const doc = generateDecisionPDF(decision, opts)
  doc.save(`decision-${decision.numero}.pdf`)
}

export function decisionPDFBlob(decision, opts) {
  return generateDecisionPDF(decision, opts).output('blob')
}

// Full registry PDF with a table of contents + one block per decision.
export function downloadRegistrePDF(decisions, opts = {}) {
  const { getDetail } = opts // getDetail(id) -> { votes, qa } (already resolved by caller)
  const doc = new jsPDF()
  header(doc, 'Table des matières')
  autoTable(doc, {
    startY: 44,
    head: [['N°', 'Date', 'Titre', 'Statut']],
    body: decisions.map((d) => [
      d.numero,
      formatDate(d.date_enregistrement || d.date_publication),
      d.titre,
      { en_cours: 'En cours', adoptee: 'Adoptée', rejetee: 'Rejetée' }[d.statut] || d.statut,
    ]),
    theme: 'striped',
    headStyles: { fillColor: NAVY },
    bodyStyles: { fontSize: 9 },
    margin: { left: 20, right: 20 },
  })

  for (const d of decisions) {
    doc.addPage()
    header(doc)
    const detail = getDetail ? getDetail(d) : {}
    decisionBlock(doc, d, { ...opts, ...detail })
  }
  doc.save(`registre-CS-${new Date().getFullYear()}.pdf`)
}
