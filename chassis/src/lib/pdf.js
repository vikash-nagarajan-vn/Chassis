// pdf.js
// -----------------------------------------------------------------------------
// Export entries to a PDF that reads like an Engineering Notebook page — the
// document FIRST teams already have to maintain for competition judging. This
// is the "do work once, reuse it" payoff: log a problem while you solve it, then
// export it straight into your notebook instead of writing it up twice.
//
// jsPDF draws to a page with manual cursor management. We keep a running `y`
// position and start a new page whenever content would overflow the margin.
// -----------------------------------------------------------------------------

import { jsPDF } from 'jspdf'

const MARGIN = 56
const LINE = 15

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function statusLabel(s) {
  return s === 'solved' ? 'SOLVED' : 'IN PROGRESS'
}

// Build a {tagId -> tag} lookup so we can print tag names and colors.
function tagMap(tags) {
  const m = {}
  for (const t of tags) m[t.id] = t
  return m
}

function hexToRgb(hex) {
  const h = (hex || '#6B7280').replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export function exportEntriesToPdf({ teamName, entries, tags, title }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGIN * 2
  const tags_ = tagMap(tags)
  let y = MARGIN

  const ensureSpace = (needed) => {
    if (y + needed > pageH - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }

  // --- Header band -----------------------------------------------------------
  doc.setFillColor(22, 24, 29)
  doc.rect(0, 0, pageW, 76, 'F')
  doc.setFillColor(232, 84, 30) // rail accent
  doc.rect(MARGIN, 26, 6, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('CHASSIS', MARGIN + 18, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 200, 205)
  doc.text(`${teamName} · Engineering Notebook export`, MARGIN + 18, 58)
  y = 104

  // --- Document title --------------------------------------------------------
  doc.setTextColor(22, 24, 29)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title || 'Knowledge Log', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 120)
  doc.text(
    `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · generated ${fmtDate(
      new Date().toISOString()
    )}`,
    pageW - MARGIN,
    y,
    { align: 'right' }
  )
  y += 12
  doc.setDrawColor(221, 225, 230)
  doc.line(MARGIN, y, pageW - MARGIN, y)
  y += 24

  // --- Entries ---------------------------------------------------------------
  entries.forEach((e, i) => {
    const tag = e.tagId ? tags_[e.tagId] : null
    ensureSpace(90)

    // tag color rail
    if (tag) {
      const [r, g, b] = hexToRgb(tag.color)
      doc.setFillColor(r, g, b)
      doc.rect(MARGIN, y - 10, 4, 22, 'F')
    }

    // title
    doc.setTextColor(22, 24, 29)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    const titleLines = doc.splitTextToSize(e.title || 'Untitled', contentW - 16)
    doc.text(titleLines, MARGIN + 14, y)
    y += titleLines.length * 14

    // meta line
    doc.setFont('courier', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(110, 110, 120)
    const meta = [
      statusLabel(e.status),
      tag ? tag.name.toUpperCase() : 'UNTAGGED',
      e.author ? `@${e.author}` : null,
      fmtDate(e.createdAt),
    ]
      .filter(Boolean)
      .join('   ·   ')
    doc.text(meta, MARGIN + 14, y)
    y += 16

    // description
    if (e.description) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(40, 42, 48)
      const descLines = doc.splitTextToSize(e.description, contentW - 14)
      descLines.forEach((ln) => {
        ensureSpace(LINE)
        doc.text(ln, MARGIN + 14, y)
        y += LINE
      })
    }

    // comments (corrections/updates over time)
    if (e.comments && e.comments.length) {
      y += 4
      ensureSpace(LINE)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(110, 110, 120)
      doc.text('Notes & corrections:', MARGIN + 14, y)
      y += LINE
      e.comments.forEach((c) => {
        const cl = doc.splitTextToSize(`— ${c.text}  (${c.author})`, contentW - 28)
        cl.forEach((ln) => {
          ensureSpace(LINE)
          doc.text(ln, MARGIN + 22, y)
          y += LINE
        })
      })
    }

    // divider between entries
    y += 10
    if (i < entries.length - 1) {
      ensureSpace(20)
      doc.setDrawColor(232, 235, 238)
      doc.line(MARGIN, y, pageW - MARGIN, y)
      y += 22
    }
  })

  // --- Page numbers ----------------------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 158)
    doc.text(`${p} / ${pages}`, pageW - MARGIN, pageH - 24, { align: 'right' })
    doc.text('Logged with Chassis', MARGIN, pageH - 24)
  }

  const safe = (title || teamName || 'chassis').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`${safe}-notebook.pdf`)
}
