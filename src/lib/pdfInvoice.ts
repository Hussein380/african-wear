import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InvoicePdfData {
  invoiceNumber: string
  createdAt?: string
  customerName?: string
  customerPhone?: string
  paymentMethod?: string
  items: {
    fullCode: string
    subVariantLabel?: string
    quantity: number
    unitPrice: number
    subtotal: number
  }[]
  totalAmount: number
  notes?: string
}

/**
 * Normalizes phone numbers to WhatsApp international format (e.g. 0712345678 -> 254712345678)
 */
export function normalizeKenyanPhone(phone: string): string {
  let clean = phone.trim().replace(/[^0-9]/g, '')
  if (clean.startsWith('00254')) {
    clean = clean.slice(2)
  } else if (clean.startsWith('0')) {
    clean = '254' + clean.slice(1)
  } else if ((clean.startsWith('7') || clean.startsWith('1')) && clean.length === 9) {
    clean = '254' + clean
  }
  return clean
}

/**
 * Checks if a string is a potentially valid Kenyan phone number (9 digits starting with 7 or 1)
 */
export function isValidKenyanPhone(phone: string): boolean {
  const norm = normalizeKenyanPhone(phone)
  return /^254[71][0-9]{8}$/.test(norm)
}

/**
 * Formats a Kenyan phone number into human-readable display: +254 7XX XXX XXX
 */
export function formatKenyanPhoneDisplay(phone: string): string {
  const norm = normalizeKenyanPhone(phone)
  if (norm.length === 12 && norm.startsWith('254')) {
    return `+254 ${norm.slice(3, 6)} ${norm.slice(6, 9)} ${norm.slice(9)}`
  }
  return phone
}

/**
 * Builds the direct WhatsApp DM URL for an invoice
 */
export function getWhatsAppInvoiceUrl(phone: string, data: InvoicePdfData): string {
  const normPhone = normalizeKenyanPhone(phone)
  const clientName = data.customerName?.trim() ? `\n*Customer:* ${data.customerName.trim()}` : ''
  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString()

  let itemsList = ''
  data.items.forEach((item, idx) => {
    const desc = item.subVariantLabel ? `${item.fullCode} (${item.subVariantLabel})` : item.fullCode
    itemsList += `${idx + 1}. *${desc}* — ${item.quantity} pc${item.quantity > 1 ? 's' : ''} @ KES ${item.unitPrice.toLocaleString()} = KES ${item.subtotal.toLocaleString()}\n`
  })

  const totalPieces = data.items.reduce((acc, i) => acc + i.quantity, 0)
  const isCredit = data.paymentMethod === 'credit'
  const paymentText = isCredit ? 'CREDIT (DEYN - OUTSTANDING)' : (data.paymentMethod || 'CASH').toUpperCase()
  const totalSuffix = isCredit ? '*(UNPAID BALANCE)*' : '*(PAID)*'

  const message = `✨ *MANDERA AFRICAN WEAR* ✨
*Official Receipt: ${data.invoiceNumber}*
────────────────────────${clientName}
*Date:* ${dateStr}
*Payment:* ${paymentText}

*Items Purchased:*
${itemsList}────────────────────────
*TOTAL PIECES:* ${totalPieces} pcs
*TOTAL AMOUNT:* *KES ${data.totalAmount.toLocaleString()}* ${totalSuffix}
────────────────────────
Thank you for shopping with Mandera African Wear!
_Quality African Fabric & Authentic Prints Specialist_`

  const encoded = encodeURIComponent(message)
  return normPhone ? `https://wa.me/${normPhone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`
}

/**
 * Helper to load an image from URL and convert to Base64 for jsPDF
 */
async function getBase64ImageFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Generates and downloads a branded PDF invoice for Mandera African Wear
 */
export async function generateInvoicePdf(data: InvoicePdfData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const primaryColor: [number, number, number] = [91, 26, 62] // #5B1A3E
  const accentColor: [number, number, number] = [155, 45, 107] // #9B2D6B
  const darkTextColor: [number, number, number] = [30, 41, 59] // #1E293B

  // 1. Top Decorative Brand Bar
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 210, 10, 'F')

  doc.setFillColor(...accentColor)
  doc.rect(0, 10, 210, 2, 'F')

  // 2. Logo & Company Details
  let currentY = 24

  // Try to load the Mandera logo
  const logoBase64 = await getBase64ImageFromUrl('/mandera-logo.png')
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, currentY, 26, 26)
    } catch {
      // Fallback if format unsupported
    }
  }

  // Company Name & Subtitle
  const textStartX = logoBase64 ? 44 : 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...primaryColor)
  doc.text('MANDERA AFRICAN WEAR', textStartX, currentY + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Specialists in Quality African Fabrics & Authentic Prints', textStartX, currentY + 13)
  doc.text('Mandera Town, Kenya  •  Phone/WhatsApp: +254 700 000 000', textStartX, currentY + 18)

  // 3. Invoice Badge & Metadata (Top Right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...primaryColor)
  doc.text('TAX INVOICE', 196, currentY + 7, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Invoice No: ${data.invoiceNumber}`, 196, currentY + 13, { align: 'right' })

  const invoiceDate = data.createdAt ? new Date(data.createdAt) : new Date()
  doc.text(`Date: ${invoiceDate.toLocaleDateString()} ${invoiceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 196, currentY + 18, { align: 'right' })
  doc.text(`Payment Method: ${(data.paymentMethod || 'CASH').toUpperCase()}`, 196, currentY + 23, { align: 'right' })

  // 4. Divider Line
  currentY += 32
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(14, currentY, 196, currentY)

  // 5. Bill To Box
  currentY += 6
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, currentY, 182, 20, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...primaryColor)
  doc.text('BILLED TO:', 18, currentY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...darkTextColor)
  const clientName = data.customerName?.trim() || 'Walk-in Customer'
  const clientPhone = data.customerPhone?.trim() ? `  •  Phone: ${data.customerPhone.trim()}` : ''
  doc.text(`${clientName}${clientPhone}`, 18, currentY + 14)

  // 6. Itemized Table (Combining All Items)
  currentY += 26

  const tableBody = data.items.map((item, idx) => [
    (idx + 1).toString(),
    item.subVariantLabel ? `${item.fullCode} (${item.subVariantLabel})` : item.fullCode,
    item.quantity.toString(),
    `KES ${item.unitPrice.toLocaleString()}`,
    `KES ${item.subtotal.toLocaleString()}`,
  ])

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Fabric Code / Description', 'Qty', 'Unit Price', 'Subtotal']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      textColor: darkTextColor,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  })

  // 7. Totals & Summary Block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : currentY + 40

  const totalPieces = data.items.reduce((acc, i) => acc + i.quantity, 0)

  // Total Summary Box
  const isCredit = data.paymentMethod === 'credit'
  doc.setFillColor(...(isCredit ? [153, 27, 27] as [number, number, number] : primaryColor))
  doc.roundedRect(120, finalY, 76, 22, 2, 2, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(`Total Pieces: ${totalPieces} pcs`, 124, finalY + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(isCredit ? 'BALANCE DUE:' : 'TOTAL PAID:', 124, finalY + 16)
  doc.text(`KES ${data.totalAmount.toLocaleString()}`, 192, finalY + 16, { align: 'right' })

  // 8. Footer & Terms
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Goods once sold in good condition cannot be returned or exchanged.', 14, 280)
  doc.text('Thank you for choosing Mandera African Wear! Quality fabric is our tradition.', 14, 284)

  // Save the PDF
  doc.save(`${data.invoiceNumber}_ManderaWear.pdf`)
}

/**
 * Opens WhatsApp directly in the customer's chat DM and returns the URL
 */
export function openWhatsAppInvoice(phone: string, data: InvoicePdfData): string {
  const waUrl = getWhatsAppInvoiceUrl(phone, data)
  window.open(waUrl, '_blank')
  return waUrl
}
