import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/** Shop details printed on every receipt. Edit here to change them everywhere. */
export const SHOP_DETAILS = {
  name: 'MANDERA AFRICAN WEAR',
  tagline: 'Specialists in Quality African Fabrics & Authentic Prints',
  address: 'Mandera Town, Kenya',
  phone: '+254 700 000 000',
}

export interface InvoicePdfData {
  invoiceNumber: string
  createdAt?: string
  customerName?: string
  customerPhone?: string
  items: {
    fullCode: string
    subVariantLabel?: string
    quantity: number
    unitPrice?: number
    subtotal?: number
  }[]
  totalAmount?: number
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
  const greeting = data.customerName?.trim() ? `Hello ${data.customerName.trim()},` : 'Hello,'
  const message = `${greeting}
Here is your receipt ${data.invoiceNumber} from Mandera African Wear (PDF attached).
Thank you for shopping with us!`
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
  doc.text(SHOP_DETAILS.name, textStartX, currentY + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(SHOP_DETAILS.tagline, textStartX, currentY + 13)
  doc.text(`${SHOP_DETAILS.address}  •  Phone/WhatsApp: ${SHOP_DETAILS.phone}`, textStartX, currentY + 18)

  // 3. Invoice Badge & Metadata (Top Right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...primaryColor)
  doc.text('RECEIPT', 196, currentY + 7, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Receipt No: ${data.invoiceNumber}`, 196, currentY + 13, { align: 'right' })

  const invoiceDate = data.createdAt ? new Date(data.createdAt) : new Date()
  doc.text(`Date: ${invoiceDate.toLocaleDateString()} ${invoiceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 196, currentY + 18, { align: 'right' })

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
  doc.text('CUSTOMER:', 18, currentY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...darkTextColor)
  const clientName = data.customerName?.trim() || 'Walk-in Customer'
  const clientPhone = data.customerPhone?.trim() ? `  •  Phone: ${data.customerPhone.trim()}` : ''
  doc.text(`${clientName}${clientPhone}`, 18, currentY + 14)

  // 6. Itemized Table (Combining All Items)
  currentY += 26

  // Price columns only appear when a selling price was typed for the receipt
  const hasPrices = data.items.some(i => (i.unitPrice || 0) > 0)
  const kes = (n: number) => `KES ${n.toLocaleString()}`
  const tableBody = data.items.map((item, idx) => [
    (idx + 1).toString(),
    item.subVariantLabel ? `${item.fullCode} (${item.subVariantLabel})` : item.fullCode,
    item.quantity.toString(),
    ...(hasPrices ? [kes(item.unitPrice || 0), kes(item.subtotal ?? (item.unitPrice || 0) * item.quantity)] : []),
  ])

  autoTable(doc, {
    startY: currentY,
    head: [hasPrices
      ? ['#', 'Fabric Code / Description', 'Bales', 'Price / Bale', 'Amount']
      : ['#', 'Fabric Code / Description', 'Bales']],
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
      2: { cellWidth: hasPrices ? 18 : 30, halign: 'center', fontStyle: 'bold' },
      ...(hasPrices
        ? { 3: { cellWidth: 34, halign: 'right' as const }, 4: { cellWidth: 36, halign: 'right' as const, fontStyle: 'bold' as const } }
        : {}),
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
  const grandTotal = data.totalAmount ?? data.items.reduce((sum, i) => sum + (i.subtotal ?? (i.unitPrice || 0) * i.quantity), 0)
  const boxHeight = hasPrices ? 24 : 14
  doc.setFillColor(...primaryColor)
  doc.roundedRect(120, finalY, 76, boxHeight, 2, 2, 'F')

  doc.setTextColor(255, 255, 255)
  if (hasPrices) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Total bales:', 124, finalY + 8)
    doc.text(`${totalBales}`, 192, finalY + 8, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('TOTAL:', 124, finalY + 18)
    doc.text(kes(grandTotal), 192, finalY + 18, { align: 'right' })
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('TOTAL BALES:', 124, finalY + 9)
    doc.text(`${totalBales}`, 192, finalY + 9, { align: 'right' })
  }

  // 8. Footer & Terms
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Goods once sold in good condition cannot be returned or exchanged.', 14, 280)
  doc.text(`Thank you for choosing Mandera African Wear!  •  ${SHOP_DETAILS.phone}`, 14, 284)

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
export interface PreparedReceiptPdf {
  doc: jsPDF
  file: File
  data: InvoicePdfData
}

/** Builds the receipt PDF ahead of time, so sharing can run straight from a tap. */
export async function prepareReceiptPdf(data: InvoicePdfData): Promise<PreparedReceiptPdf> {
  const doc = await buildInvoicePdfDoc(data)
  const file = new File([doc.output('blob')], `${data.invoiceNumber}_ManderaWear.pdf`, { type: 'application/pdf' })
  return { doc, file, data }
}

/** True when this device can hand the PDF file to WhatsApp through the share sheet (phones). */
export function canSharePdfFile(file: File): boolean {
  return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] })
}

/**
 * Sends the receipt as a PDF file. Call it directly from a button tap: phones only
 * open the share sheet during a user action.
 * - Phones: the share sheet opens with the PDF attached; staff pick WhatsApp and the customer.
 * - Computers (no file sharing): the PDF downloads and the customer's WhatsApp chat opens,
 *   ready for staff to attach the downloaded file.
 */
export async function sendPreparedReceipt(
  prepared: PreparedReceiptPdf,
  phone?: string
): Promise<'shared' | 'cancelled' | 'downloaded'> {
  if (canSharePdfFile(prepared.file)) {
    try {
      await navigator.share({
        files: [prepared.file],
        title: `Receipt ${prepared.data.invoiceNumber} - Mandera African Wear`,
      })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
      // Share failed for another reason: fall through to download
    }
  }
  prepared.doc.save(prepared.file.name)
  window.open(getWhatsAppInvoiceUrl(phone || '', prepared.data), '_blank')
  return 'downloaded'
}

/** One-step version used by the sale basket. */
export async function shareInvoicePdfViaWhatsApp(phone: string, data: InvoicePdfData): Promise<{ sharedViaNative: boolean; waUrl: string }> {
  const prepared = await prepareReceiptPdf(data)
  const result = await sendPreparedReceipt(prepared, phone)
  return { sharedViaNative: result !== 'downloaded', waUrl: getWhatsAppInvoiceUrl(phone, data) }
}
