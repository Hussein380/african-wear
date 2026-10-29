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
    itemsList += `${idx + 1}. *${desc}* — ${item.quantity} ${item.quantity === 1 ? 'bale' : 'bales'}${item.unitPrice > 0 ? ` @ KES ${item.unitPrice.toLocaleString()} = KES ${item.subtotal.toLocaleString()}` : ''}\n`
  })

  const totalBales = data.items.reduce((acc, i) => acc + i.quantity, 0)
  const paymentText = (data.paymentMethod || 'CASH').toUpperCase()

  const message = `✨ *MANDERA AFRICAN WEAR* ✨
*Official Receipt: ${data.invoiceNumber}*
────────────────────────${clientName}
*Date:* ${dateStr}
*Payment:* ${paymentText}

*Items Purchased:*
${itemsList}────────────────────────
*TOTAL BALES:* ${totalBales} ${totalBales === 1 ? 'bale' : 'bales'}
${data.totalAmount > 0 ? `*TOTAL PAID:* *KES ${data.totalAmount.toLocaleString()}*\n────────────────────────\n` : ''}📄 *Official PDF receipt has been generated & downloaded for your records.*
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
 * Builds the jsPDF document object for an invoice
 */
export async function buildInvoicePdfDoc(data: InvoicePdfData): Promise<jsPDF> {
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
    head: [['#', 'Fabric Code / Description', 'Bales', 'Unit Price', 'Subtotal']],
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

  const totalBales = data.items.reduce((acc, i) => acc + i.quantity, 0)

  // Total Summary Box
  doc.setFillColor(...primaryColor)
  doc.roundedRect(120, finalY, 76, 22, 2, 2, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(`Total Bales: ${totalBales} ${totalBales === 1 ? 'bale' : 'bales'}`, 124, finalY + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL PAID:', 124, finalY + 16)
  doc.text(`KES ${data.totalAmount.toLocaleString()}`, 192, finalY + 16, { align: 'right' })

  // 8. Footer & Terms
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Goods once sold in good condition cannot be returned or exchanged.', 14, 280)
  doc.text('Thank you for choosing Mandera African Wear! Quality fabric is our tradition.', 14, 284)

  return doc
}

/**
 * Generates and downloads a branded PDF invoice for Mandera African Wear
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<jsPDF> {
  const doc = await buildInvoicePdfDoc(data)
  doc.save(`${data.invoiceNumber}_ManderaWear.pdf`)
  return doc
}

/**
 * Automatically generates the official branded PDF invoice, downloads it for the customer,
 * and shares/opens it directly via WhatsApp.
 */
export async function shareInvoicePdfViaWhatsApp(phone: string, data: InvoicePdfData): Promise<{ sharedViaNative: boolean; waUrl: string }> {
  const doc = await buildInvoicePdfDoc(data)
  let sharedViaNative = false

  try {
    const pdfBlob = doc.output('blob')
    const fileName = `${data.invoiceNumber}_ManderaWear.pdf`
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })

    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: `Official Receipt ${data.invoiceNumber} - Mandera African Wear`,
        text: `Official Receipt ${data.invoiceNumber} from Mandera African Wear`,
      })
      sharedViaNative = true
    }
  } catch (err) {
    // Sharing cancelled or not supported on this platform
  }

  // Always save/download PDF directly if not natively handled by OS share sheet
  if (!sharedViaNative) {
    doc.save(`${data.invoiceNumber}_ManderaWear.pdf`)
  }

  const waUrl = getWhatsAppInvoiceUrl(phone, data)
  window.open(waUrl, '_blank')

  return { sharedViaNative, waUrl }
}

export interface ZReportPdfData {
  reportNumber: string
  dateStr: string
  periodLabel: string
  drawer: {
    cash: number
    mpesa: number
    credit: number
    totalCollections: number
  }
  summary: {
    totalRevenue: number
    wholesaleCost?: number
    estimatedGrossProfit?: number
    totalExpenses: number
    netProfit: number
    totalPiecesSold: number
    invoicesCount: number
  }
  expensesList?: {
    category: string
    description?: string
    amount: number
  }[]
}

/**
 * Generates and downloads an Executive Branded Z-Report (Daily Register Close) PDF
 */
export async function generateZReportPdf(data: ZReportPdfData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const primaryColor: [number, number, number] = [91, 26, 62] // #5B1A3E
  const goldColor: [number, number, number] = [212, 175, 55] // #D4AF37
  const darkTextColor: [number, number, number] = [15, 23, 42] // #0F172A
  const greenColor: [number, number, number] = [21, 128, 61] // #15803D
  const redColor: [number, number, number] = [185, 28, 28] // #B91C1C

  // 1. Top Decorative Brand Bar
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 210, 10, 'F')

  doc.setFillColor(...goldColor)
  doc.rect(0, 10, 210, 2.5, 'F')

  // 2. Logo & Company Details
  let currentY = 24

  const logoBase64 = await getBase64ImageFromUrl('/mandera-logo.png')
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, currentY, 24, 24)
    } catch {
      // Fallback
    }
  }

  const textStartX = logoBase64 ? 42 : 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...primaryColor)
  doc.text('MANDERA AFRICAN WEAR', textStartX, currentY + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...goldColor)
  doc.text('DAILY REGISTER CLOSE (Z-REPORT)', textStartX, currentY + 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text('Mandera Town, Kenya  •  Official Cash Drawer & P&L Reconciliation', textStartX, currentY + 17)

  // Top Right Report Metadata Box
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...primaryColor)
  doc.text('Z-REPORT', 196, currentY + 6, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`Ref: ${data.reportNumber}`, 196, currentY + 12, { align: 'right' })
  doc.text(`Date: ${data.dateStr}`, 196, currentY + 17, { align: 'right' })
  doc.text(`Period: ${data.periodLabel}`, 196, currentY + 22, { align: 'right' })

  // 3. Divider
  currentY += 28
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(14, currentY, 196, currentY)

  // 4. Section 1: Cash Drawer Reconciliation Table
  currentY += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...primaryColor)
  doc.text('1. CASH DRAWER & REGISTER RECONCILIATION', 14, currentY)

  currentY += 4
  const drawerRows = [
    ['Physical Cash in Drawer', 'Cash balance counted in register drawer', `KES ${data.drawer.cash.toLocaleString()}`],
    ['M-Pesa on Till', 'Safaricom Buy Goods Till account collections', `KES ${data.drawer.mpesa.toLocaleString()}`],
    ['Customer Credit (Deyn)', 'Outstanding customer debt balance (uncollected)', `KES ${data.drawer.credit.toLocaleString()}`],
    ['TOTAL VERIFIED COLLECTIONS', 'Cash in Drawer + M-Pesa on Till Balance', `KES ${(data.drawer.cash + data.drawer.mpesa).toLocaleString()}`],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [['Register Channel', 'Reconciliation Description', 'Verified Balance']],
    body: drawerRows,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 'auto', textColor: [71, 85, 105] },
      2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: darkTextColor,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : currentY + 35

  // 5. Section 2: Store Profitability & Financial Summary
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...primaryColor)
  doc.text('2. STORE REVENUE, EXPENSES & NET PROFIT', 14, currentY)

  currentY += 4
  const wholesaleCost = data.summary.wholesaleCost || 0
  const grossProfit = data.summary.estimatedGrossProfit !== undefined ? data.summary.estimatedGrossProfit : (data.summary.totalRevenue - wholesaleCost)

  const summaryRows = [
    ['Total Sales Revenue', 'Total revenue generated from customer purchases', `KES ${data.summary.totalRevenue.toLocaleString()}`],
    ['Cost of Goods Sold (COGS)', 'Wholesale fabric purchase cost from suppliers', `KES ${wholesaleCost.toLocaleString()}`],
    ['Estimated Gross Profit', 'Revenue minus wholesale cost of fabrics sold', `KES ${grossProfit.toLocaleString()}`],
    ['Shop Operating Expenses', 'Rent, electricity, logistics, and store overheads', `- KES ${data.summary.totalExpenses.toLocaleString()}`],
    ['ESTIMATED NET STORE PROFIT', 'Net shop earnings after all inventory & operating costs', `KES ${data.summary.netProfit.toLocaleString()}`],
    ['Total Fabrics Sold', 'Physical fabric rolls deducted from store inventory', `${data.summary.totalPiecesSold} pieces`],
    ['Receipts & Invoices Issued', 'Total transactions recorded through system', `${data.summary.invoicesCount} invoices`],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [['Financial Metric', 'Description', 'Amount']],
    body: summaryRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42], // Dark slate
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 'auto', textColor: [71, 85, 105] },
      2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: darkTextColor,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : currentY + 50

  // 6. Section 3: Highlight Cards (Net Profit Box & Drawer Total Box)
  if (currentY < 235) {
    const isNetPositive = data.summary.netProfit >= 0
    doc.setFillColor(...(isNetPositive ? greenColor : redColor))
    doc.roundedRect(14, currentY, 86, 22, 2, 2, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('ESTIMATED NET TAKE-HOME:', 18, currentY + 7)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`KES ${data.summary.netProfit.toLocaleString()}`, 18, currentY + 16)

    doc.setFillColor(...primaryColor)
    doc.roundedRect(108, currentY, 88, 22, 2, 2, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('CASH & M-PESA AVAILABLE TODAY:', 112, currentY + 7)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`KES ${(data.drawer.cash + data.drawer.mpesa).toLocaleString()}`, 112, currentY + 16)

    currentY += 28
  }

  // 7. Store Verification & Signatures
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.5)

  const signY = 265
  doc.line(14, signY, 85, signY)
  doc.line(125, signY, 196, signY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('Store Manager / Cashier Verification', 14, signY + 4)
  doc.text('Shop Owner Sign-Off & Approval', 125, signY + 4)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} • Mandera African Wear`, 14, 285)

  // Save PDF
  doc.save(`${data.reportNumber}_ManderaWear_ZReport.pdf`)
}

/**
 * Opens WhatsApp directly in the customer's chat DM and returns the URL
 */
export function openWhatsAppInvoice(phone: string, data: InvoicePdfData): string {
  const waUrl = getWhatsAppInvoiceUrl(phone, data)
  window.open(waUrl, '_blank')
  return waUrl
}
