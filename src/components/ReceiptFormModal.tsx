'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  prepareReceiptPdf,
  sendPreparedReceipt,
  canSharePdfFile,
  isValidKenyanPhone,
  formatKenyanPhoneDisplay,
  PreparedReceiptPdf,
  SHOP_DETAILS,
} from '@/lib/pdfInvoice'

export interface SaleLine {
  activityId: string
  fullCode: string
  subVariantLabel?: string
  quantity: number
}

interface ReceiptFormModalProps {
  /** New receipt for these sales, or… */
  sales?: SaleLine[]
  /** …an existing receipt to edit and send again. */
  invoiceId?: string
  onClose: () => void
  /** Called after a receipt is created or changed, so the list can refresh. */
  onSaved: () => void
}

/**
 * One line on the form per fabric + colour (+ price, for saved receipts), so 3 bales of the
 * same colour show as "3 bales" with one price box. Each sale stays its own receipt item
 * underneath, so undoing one sale in History still works.
 */
interface FormLine {
  fullCode: string
  subVariantLabel?: string
  quantity: number
  price: string
  /** Sales in this line (new receipts) */
  activityIds: string[]
  /** Positions of this line's items in the saved receipt */
  itemIndexes: number[]
}

type ReceiptItemLike = { fullCode: string; subVariantLabel?: string; quantity: number; unitPrice?: number; activityId?: string }

const kes = (n: number) => `KES ${n.toLocaleString()}`

function groupLines(
  rows: { fullCode: string; subVariantLabel?: string; quantity: number; activityId?: string; unitPrice?: number }[]
): FormLine[] {
  const lines: FormLine[] = []
  rows.forEach((r, idx) => {
    const price = r.unitPrice ? String(r.unitPrice) : ''
    const key = `${r.fullCode}::${r.subVariantLabel || ''}::${price}`
    const line = lines.find(l => `${l.fullCode}::${l.subVariantLabel || ''}::${l.price}` === key)
    if (line) {
      line.quantity += r.quantity
      if (r.activityId) line.activityIds.push(r.activityId)
      line.itemIndexes.push(idx)
    } else {
      lines.push({
        fullCode: r.fullCode,
        subVariantLabel: r.subVariantLabel,
        quantity: r.quantity,
        price,
        activityIds: r.activityId ? [r.activityId] : [],
        itemIndexes: [idx],
      })
    }
  })
  return lines
}

export default function ReceiptFormModal({ sales, invoiceId, onClose, onSaved }: ReceiptFormModalProps) {
  const [lines, setLines] = useState<FormLine[]>(() => groupLines(sales || []))
  // Number of items in the saved receipt (prices are sent per item)
  const [itemCount, setItemCount] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  // Set once saved, so pressing Save again edits the same receipt instead of making a second one
  const [savedId, setSavedId] = useState<string | undefined>(invoiceId)
  const [isLoading, setIsLoading] = useState(!!invoiceId)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<PreparedReceiptPdf | null>(null)
  const [sendResult, setSendResult] = useState<'shared' | 'cancelled' | 'downloaded' | null>(null)

  // Existing receipt: load it so staff can fix the price or name and send again
  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false
    fetch(`/api/invoices/${invoiceId}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(inv => {
        if (cancelled) return
        setInvoiceNumber(inv.invoiceNumber)
        setCustomerName(inv.customerName || '')
        setCustomerPhone(inv.customerPhone || '')
        const items: ReceiptItemLike[] = inv.items || []
        setLines(groupLines(items))
        setItemCount(items.length)
      })
      .catch(() => !cancelled && setError('Could not open this receipt. Check the connection and try again.'))
      .finally(() => !cancelled && setIsLoading(false))
    return () => { cancelled = true }
  }, [invoiceId])

  const priceOf = (l: FormLine) => {
    const n = Number(l.price)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const totalBales = lines.reduce((sum, l) => sum + l.quantity, 0)
  const total = lines.reduce((sum, l) => sum + priceOf(l) * l.quantity, 0)
  const missingPrice = lines.some(l => priceOf(l) === 0)
  const phoneOk = !customerPhone.trim() || isValidKenyanPhone(customerPhone)
  const canShareFiles = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.canShare && canSharePdfFile(new File([''], 'x.pdf', { type: 'application/pdf' })),
    []
  )

  // One price per saved receipt item, taken from the line it belongs to
  const itemPrices = () => {
    const prices = new Array<number>(itemCount).fill(0)
    lines.forEach(l => l.itemIndexes.forEach(i => { prices[i] = priceOf(l) }))
    return prices
  }

  const setPrice = (idx: number, value: string) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, price: value.replace(/[^0-9.]/g, '') } : l)))
    setPrepared(null)
    setSendResult(null)
  }

  // Step 1: save the receipt and build the PDF
  const handleSave = async () => {
    if (isSaving) return
    setError(null)
    if (!phoneOk) {
      setError('That WhatsApp number does not look right. Use 07XX XXX XXX or 01XX XXX XXX.')
      return
    }
    setIsSaving(true)
    try {
      let res: Response
      if (savedId) {
        res = await fetch(`/api/invoices/${savedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName, customerPhone, prices: itemPrices() }),
        })
      } else {
        const prices: Record<string, number> = {}
        lines.forEach(l => l.activityIds.forEach(id => { prices[id] = priceOf(l) }))
        res = await fetch('/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityIds: sales!.map(s => s.activityId), prices, customerName, customerPhone }),
        })
      }
      const inv = await res.json()
      if (!res.ok) {
        setError(inv.error || 'Could not save the receipt.')
        return
      }
      setInvoiceNumber(inv.invoiceNumber)
      setSavedId(inv._id)
      // Remember where each line's sales sit in the saved receipt, for later price changes
      const savedItems: ReceiptItemLike[] = inv.items || []
      setItemCount(savedItems.length)
      setLines(prev => prev.map(l => l.activityIds.length
        ? { ...l, itemIndexes: savedItems.flatMap((it, i) => (it.activityId && l.activityIds.includes(it.activityId) ? [i] : [])) }
        : l))
      onSaved()
      setPrepared(await prepareReceiptPdf({
        invoiceNumber: inv.invoiceNumber,
        createdAt: inv.createdAt,
        customerName: inv.customerName || undefined,
        customerPhone: inv.customerPhone || undefined,
        items: inv.items,
        totalAmount: inv.totalAmount,
      }))
    } catch (err) {
      console.error('Receipt save error:', err)
      setError('Network error. The receipt was not saved. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Step 2: runs straight from the tap so the phone's share sheet is allowed to open
  const handleSend = async () => {
    if (!prepared) return
    setSendResult(await sendPreparedReceipt(prepared, customerPhone))
  }

  const isNewReceipt = !invoiceId
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="receipt-form" onClick={e => e.stopPropagation()} role="dialog" aria-label="Customer receipt">
        {/* Letterhead */}
        <div className="receipt-form__head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mandera-logo.png" alt="" className="receipt-form__logo" />
          <div className="receipt-form__shop">
            <div className="receipt-form__shop-name">{SHOP_DETAILS.name}</div>
            <div className="receipt-form__shop-meta">{SHOP_DETAILS.address}</div>
          </div>
          <div className="receipt-form__doc">
            <div className="receipt-form__doc-title">RECEIPT</div>
            <div className="receipt-form__doc-meta">{invoiceNumber || 'New'} • {today}</div>
          </div>
          <button type="button" className="receipt-form__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="receipt-form__body">
          {isLoading ? (
            <p className="receipt-form__hint">Opening receipt…</p>
          ) : (
            <>
              {error && <div className="receipt-form__error">{error}</div>}

              {/* Spreadsheet-style item grid: first, so the price box is the first thing staff see */}
              <div className="receipt-sheet" role="table">
                <div className="receipt-sheet__row receipt-sheet__row--head" role="row">
                  <span role="columnheader" className="code">Fabric</span>
                  <span role="columnheader" className="num qty">Bales</span>
                  <span role="columnheader" className="num price">Price / bale (KES)</span>
                  <span role="columnheader" className="num amount">Amount</span>
                </div>
                {lines.map((l, idx) => (
                  <div className="receipt-sheet__row" role="row" key={idx}>
                    <span role="cell" className="code">
                      {l.fullCode}
                      {l.subVariantLabel && <small>{l.subVariantLabel}</small>}
                    </span>
                    <span role="cell" className="num qty">{l.quantity}</span>
                    <span role="cell" className="num price">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={l.price}
                        onChange={e => setPrice(idx, e.target.value)}
                        placeholder="0"
                        aria-label={`Selling price per bale for ${l.fullCode}`}
                        autoFocus={idx === 0 && isNewReceipt}
                      />
                    </span>
                    <span role="cell" className="num amount">{priceOf(l) ? kes(priceOf(l) * l.quantity) : '—'}</span>
                  </div>
                ))}
                <div className="receipt-sheet__row receipt-sheet__row--total" role="row">
                  <span role="cell" className="code">TOTAL</span>
                  <span role="cell" className="num qty">{totalBales}</span>
                  <span role="cell" className="price" />
                  <span role="cell" className="num amount">{kes(total)}</span>
                </div>
              </div>

              {/* Customer */}
              <div className="receipt-form__fields">
                <label className="receipt-form__field">
                  <span>Customer name</span>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => { setCustomerName(e.target.value); setPrepared(null) }}
                    placeholder="e.g. Halima Ahmed"
                    autoComplete="off"
                  />
                </label>
                <label className="receipt-form__field">
                  <span>
                    WhatsApp number
                    {customerPhone.trim() && (
                      <em className={phoneOk ? 'ok' : 'bad'}>{phoneOk ? formatKenyanPhoneDisplay(customerPhone) : '07XX / 01XX'}</em>
                    )}
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={customerPhone}
                    onChange={e => { setCustomerPhone(e.target.value); setPrepared(null) }}
                    placeholder="0712 345 678"
                  />
                </label>
              </div>

              {missingPrice && !prepared && (
                <p className="receipt-form__hint">Lines without a price print without an amount.</p>
              )}

              {sendResult === 'downloaded' && (
                <p className="receipt-form__hint receipt-form__hint--ok">
                  PDF downloaded and WhatsApp opened. Attach the downloaded PDF in the customer&apos;s chat.
                </p>
              )}
              {sendResult === 'shared' && (
                <p className="receipt-form__hint receipt-form__hint--ok">Receipt PDF shared.</p>
              )}
            </>
          )}
        </div>

        <div className="receipt-form__foot">
          {!prepared ? (
            <button type="button" className="receipt-form__btn receipt-form__btn--primary" onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? 'Saving…' : savedId ? 'Save changes' : 'Create receipt'}
            </button>
          ) : (
            <>
              <button type="button" className="receipt-form__btn receipt-form__btn--whatsapp" onClick={handleSend}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12c0 2.159.57 4.184 1.564 5.939L0 24l6.088-1.597A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.42 16.42c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.058.376-.058c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z" /></svg>
                {canShareFiles ? 'Send PDF on WhatsApp' : 'Download PDF & open WhatsApp'}
              </button>
              <button type="button" className="receipt-form__btn" onClick={() => prepared.doc.save(prepared.file.name)}>
                Download PDF
              </button>
            </>
          )}
          <button type="button" className="receipt-form__btn receipt-form__btn--ghost" onClick={onClose}>
            {prepared ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
