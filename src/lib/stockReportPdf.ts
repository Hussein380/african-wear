import jsPDF from 'jspdf'
import { shopDateString } from './stockRules'

// Colour palette matching the app brand
const PLUM = '#5B1A3E'
const GOLD = '#D4AF37'
const LIGHT_GRAY = '#F8F6F4'

interface BreakdownItem {
  id: string
  label: string
  quantity: number
}

interface InventoryItem {
  _id: string
  fullCode: string
  quantityAvailable: number
  breakdown?: BreakdownItem[]
  category: string
  designCodeName: string
  location?: string
}

interface StoreSnapshot {
  items: InventoryItem[]
  storeName?: string
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export async function generateStockSnapshotPdf({ items, storeName = 'MANDERA AFRICAN WEAR' }: StoreSnapshot): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 15
  const contentW = pageW - margin * 2
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })

  // Group items by category
  const categoryMap = new Map<string, InventoryItem[]>()
  items.forEach(item => {
    const cat = item.category || 'Other'
    if (!categoryMap.has(cat)) categoryMap.set(cat, [])
    categoryMap.get(cat)!.push(item)
  })

  const totalBales = items.reduce((s, i) => s + i.quantityAvailable, 0)
  const totalDesigns = new Set(items.map(i => i.designCodeName)).size

  // ── Header ─────────────────────────────────────────────────────────────────
  const [pr, pg, pb] = hexToRgb(PLUM)
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, pageW, 42, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(storeName, margin, 16)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('STORE STOCK SNAPSHOT', margin, 23)
  doc.text(`Generated: ${dateStr} at ${timeStr}`, margin, 29)

  // Summary badges on the right
  const [gr, gg, gb] = hexToRgb(GOLD)
  doc.setFillColor(gr, gg, gb)
  doc.roundedRect(pageW - margin - 70, 8, 70, 26, 3, 3, 'F')
  doc.setTextColor(pr, pg, pb)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(String(totalBales), pageW - margin - 35, 21, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('TOTAL BALES IN STORE', pageW - margin - 35, 29, { align: 'center' })

  // ── Category Sections ───────────────────────────────────────────────────────
  let y = 52

  const categoryOrder = ['PrintedC', 'PrintedP', 'PrintTC', ...Array.from(categoryMap.keys()).filter(c => !['PrintedC','PrintedP','PrintTC'].includes(c))]

  for (const cat of categoryOrder) {
    if (!categoryMap.has(cat)) continue
    const catItems = categoryMap.get(cat)!
    const catTotal = catItems.reduce((s, i) => s + i.quantityAvailable, 0)
    const catDesigns = new Set(catItems.map(i => i.designCodeName)).size

    // Page break check
    if (y > 255) {
      doc.addPage()
      y = 15
    }

    // Category header bar
    doc.setFillColor(pr, pg, pb)
    doc.rect(margin, y, contentW, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(cat, margin + 3, y + 5.5)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${catDesigns} Designs • ${catTotal} Bales`, pageW - margin - 3, y + 5.5, { align: 'right' })
    y += 11

    // Items
    let isEven = false
    for (const item of catItems) {
      if (y > 270) {
        doc.addPage()
        y = 15
      }

      if (isEven) {
        doc.setFillColor(248, 246, 244)
        doc.rect(margin, y, contentW, 7, 'F')
      }
      isEven = !isEven

      doc.setTextColor(40, 40, 40)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(item.fullCode, margin + 3, y + 5)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      if (item.location) {
        doc.text(`📍 ${item.location}`, margin + 55, y + 5)
      }

      // Bale count on right
      doc.setFont('helvetica', 'bold')
      const balesColor = item.quantityAvailable <= 5 ? [185, 28, 28] : [pr, pg, pb] as [number, number, number]
      doc.setTextColor(...(item.quantityAvailable <= 5 ? [185, 28, 28] as [number, number, number] : [pr, pg, pb] as [number, number, number]))
      doc.text(`${item.quantityAvailable} bales`, pageW - margin - 3, y + 5, { align: 'right' })

      y += 7

      // Breakdown if present
      if (item.breakdown && item.breakdown.length > 0) {
        for (const b of item.breakdown) {
          if (y > 270) { doc.addPage(); y = 15 }
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(120, 120, 120)
          doc.setFontSize(8)
          doc.text(`  • ${b.label}`, margin + 8, y + 4)
          doc.text(`${b.quantity}`, pageW - margin - 3, y + 4, { align: 'right' })
          y += 5.5
        }
      }
    }

    y += 6
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(pr, pg, pb)
    doc.rect(0, 290, pageW, 8, 'F')
    doc.setTextColor(200, 200, 200)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`${storeName} — Confidential Stock Report`, margin, 295)
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, 295, { align: 'right' })
  }

  doc.save(`Stock_Snapshot_${shopDateString(now)}.pdf`)
}

export function buildWhatsAppStockSummary({ items, storeName = 'MANDERA AFRICAN WEAR' }: StoreSnapshot): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })

  const categoryMap = new Map<string, InventoryItem[]>()
  items.forEach(item => {
    const cat = item.category || 'Other'
    if (!categoryMap.has(cat)) categoryMap.set(cat, [])
    categoryMap.get(cat)!.push(item)
  })

  const totalBales = items.reduce((s, i) => s + i.quantityAvailable, 0)

  let msg = `*${storeName}*\n*CURRENT STORE STOCK — ${dateStr}*\n\n`

  const order = ['PrintedC', 'PrintedP', 'PrintTC', ...Array.from(categoryMap.keys()).filter(c => !['PrintedC','PrintedP','PrintTC'].includes(c))]

  for (const cat of order) {
    if (!categoryMap.has(cat)) continue
    const catItems = categoryMap.get(cat)!
    const catTotal = catItems.reduce((s, i) => s + i.quantityAvailable, 0)
    const catDesigns = new Set(catItems.map(i => i.designCodeName)).size

    if (cat === 'PrintTC') {
      const totalColors = catItems.length
      msg += `📦 *${cat}*: ${totalColors} Colors — ${catTotal} Total Bales\n`
    } else {
      msg += `📦 *${cat}*: ${catDesigns} Designs — ${catTotal} Total Bales\n`
    }
  }

  msg += `\n*🔢 TOTAL IN STORE: ${totalBales} Bales*`
  return msg
}
