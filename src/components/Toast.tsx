'use client'

import { useEffect, useState } from 'react'
import {
  generateInvoicePdf,
  openWhatsAppInvoice,
  InvoicePdfData,
  isValidKenyanPhone,
  formatKenyanPhoneDisplay,
  getWhatsAppInvoiceUrl,
} from '@/lib/pdfInvoice'

export interface ToastData {
  id: string
  message: string
  itemCode: string
  activityId?: string
  colorwayId: string
  change: number
  subVariantId?: string
  currentKind?: 'sold' | 'own_use' | 'arrived' | 'returned'
  soldPrice?: number
  costPrice?: number
  onUndo?: () => void
  onTagChange?: (newKind: 'sold' | 'own_use' | 'arrived' | 'returned') => void
  onPriceUpdate?: (newPrice?: number) => void
}

interface ToastProps {
  toast: ToastData | null
  onDismiss: () => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [overrideKind, setOverrideKind] = useState<{ id: string; kind: string } | null>(null)
  const [overridePrice, setOverridePrice] = useState<number | undefined>(undefined)
  const [isUpdatingTag, setIsUpdatingTag] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [lastWaUrl, setLastWaUrl] = useState<string | null>(null)

  const activeKind = (toast && overrideKind?.id === toast.id) ? overrideKind.kind : toast?.currentKind

  useEffect(() => {
    if (!toast || showReceiptModal) return
    setOverridePrice(undefined)
    const timer = setTimeout(() => {
      onDismiss()
    }, 15000) // 15 seconds visible

    return () => clearTimeout(timer)
  }, [toast, onDismiss, showReceiptModal])

  if (!toast) return null

  const isOut = toast.change < 0
  const isUndoable = !!toast.onUndo

  const handleTag = async (newKind: 'sold' | 'own_use' | 'arrived' | 'returned') => {
    if (!toast.activityId || isUpdatingTag) return
    setIsUpdatingTag(true)
    setOverrideKind({ id: toast.id, kind: newKind })
    try {
      const res = await fetch(`/api/activities/${toast.activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: newKind }),
      })
      if (res.ok) {
        toast.onTagChange?.(newKind)
      }
    } catch (e) {
      console.error('Failed to update tag:', e)
    } finally {
      setIsUpdatingTag(false)
    }
  }

  const handlePriceClick = async () => {
    const currentP = overridePrice !== undefined ? overridePrice : toast.soldPrice
    const val = prompt(
      `Agreed sold price for ${toast.itemCode} (KES):`,
      currentP !== undefined ? String(currentP) : ''
    )
    if (val !== null) {
      const num = val.trim() !== '' ? parseFloat(val) : undefined
      if (toast.costPrice !== undefined && num !== undefined && num < toast.costPrice) {
        const confirmLoss = confirm(
          `⚠️ Warning: Selling at KES ${num.toLocaleString()} is below buying cost (KES ${toast.costPrice.toLocaleString()}). Proceed with this discount?`
        )
        if (!confirmLoss) return
      }
      setOverridePrice(num)
      if (toast.activityId) {
        await fetch(`/api/activities/${toast.activityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ soldPrice: num !== undefined ? num : null }),
        })
        toast.onPriceUpdate?.(num)
      }
    }
  }

  const handleUndo = async () => {
    if (isUndoing || !toast.onUndo) return
    setIsUndoing(true)
    try {
      await toast.onUndo()
      onDismiss()
    } finally {
      setIsUndoing(false)
    }
  }

  const handleSendWhatsApp = () => {
    const p = (overridePrice !== undefined ? overridePrice : toast.soldPrice) || 0
    const total = p * Math.abs(toast.change)
    const phoneToUse = customerPhone.trim()

    if (!phoneToUse) {
      alert('Please enter a WhatsApp phone number (e.g. 0712345678 or 0112345678).')
      return
    }

    const data: InvoicePdfData = {
      invoiceNumber: `REC-${Date.now().toString().slice(-6)}`,
      customerName: customerName.trim() || undefined,
      customerPhone: phoneToUse,
      items: [
        {
          fullCode: toast.itemCode,
          quantity: Math.abs(toast.change),
          unitPrice: p,
          subtotal: total,
        },
      ],
      totalAmount: total,
    }

    const waUrl = getWhatsAppInvoiceUrl(phoneToUse, data)
    setLastWaUrl(waUrl)
    openWhatsAppInvoice(phoneToUse, data)
  }

  return (
    <div className="stock-toast" role="status" aria-live="polite">
      <div className="stock-toast__content">
        <div className="stock-toast__main">
          <span className="stock-toast__badge" style={{
            background: isOut ? '#fee2e2' : '#dcfce7',
            color: isOut ? '#991b1b' : '#166534',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 700,
          }}>
            {isOut ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                <span>Sold (Stock Deducted)</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                <span>Stock Added</span>
              </>
            )}
          </span>
          <span className="stock-toast__text">
            <strong>{Math.abs(toast.change)} roll</strong> of <strong>{toast.itemCode}</strong>
          </span>
        </div>

        {/* Quick 1-tap tag switcher: Sold vs Own Use, or Arrived vs Returned */}
        {toast.activityId && (
          <div className="stock-toast__tags">
            {isOut ? (
              <>
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'sold' || !activeKind ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('sold')}
                  disabled={isUpdatingTag}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Sold</span>
                </button>
                {(activeKind === 'sold' || !activeKind) && (
                  <button
                    type="button"
                    className="stock-toast__tag-btn"
                    onClick={handlePriceClick}
                    style={{
                      borderColor: '#3b82f6',
                      color: '#2563eb',
                      fontWeight: 600,
                      background: (overridePrice !== undefined || toast.soldPrice !== undefined) ? 'rgba(37, 99, 235, 0.1)' : undefined,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {(overridePrice !== undefined ? overridePrice : toast.soldPrice) !== undefined ? (
                      <>
                        <span>KES {(overridePrice !== undefined ? overridePrice : toast.soldPrice)?.toLocaleString()}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </>
                    ) : (
                      <span>+ Set Price</span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'own_use' ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('own_use')}
                  disabled={isUpdatingTag}
                >
                  Own Use
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'arrived' || !activeKind ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('arrived')}
                  disabled={isUpdatingTag}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Arrived</span>
                </button>
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'returned' ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('returned')}
                  disabled={isUpdatingTag}
                >
                  Customer Return
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="stock-toast__actions">
        {isOut && (activeKind === 'sold' || !activeKind) && (
          <button
            type="button"
            className="stock-toast__undo-btn"
            onClick={() => setShowReceiptModal(true)}
            style={{
              background: '#059669',
              color: '#ffffff',
              borderColor: '#059669',
              fontWeight: 700,
              padding: '6px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
            title="Generate instant WhatsApp receipt or printable slip"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
            <span>Receipt</span>
          </button>
        )}
        {isUndoable && (
          <button
            type="button"
            className="stock-toast__undo-btn"
            onClick={handleUndo}
            disabled={isUndoing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              padding: '6px 12px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
            <span>{isUndoing ? 'Undoing…' : 'Undo'}</span>
          </button>
        )}
        <button
          type="button"
          className="stock-toast__close-btn"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* 1-Tap Quick Sale Luxury Boutique Receipt Modal */}
      {showReceiptModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowReceiptModal(false)}
          style={{ zIndex: 10000, backdropFilter: 'blur(3px)', background: 'rgba(26, 11, 20, 0.75)' }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              padding: '0',
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid #E6CA65',
              boxShadow: '0 25px 50px -12px rgba(74, 16, 50, 0.35)',
              background: '#ffffff',
            }}
          >
            {/* Boutique Crest Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #4A1032 0%, #6B1D48 60%, #340822 100%)',
                color: '#FAF6EB',
                padding: '20px 22px 16px',
                textAlign: 'center',
                borderBottom: '3px solid #D4AF37',
              }}
            >
              <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#E6CA65', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                Mandera African Wear
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 4px', letterSpacing: '0.5px' }}>
                OFFICIAL SALES RECEIPT
              </h2>
              <div style={{ fontSize: '11px', color: '#F3E8CE', opacity: 0.9 }}>
                Direct Sale • Authentic Fabrics & Silks
              </div>
              <div style={{ fontSize: '10px', color: '#E6CA65', marginTop: '6px', opacity: 0.85 }}>
                {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div style={{ padding: '18px 22px 20px' }}>
              {/* Customer Inputs with Kenyan Phone Formatter */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', display: 'block', marginBottom: '4px' }}>
                    Client Name
                  </label>
                  <input
                    type="text"
                    className="form-group__input"
                    placeholder="e.g. Halima"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563' }}>
                      WhatsApp Phone
                    </label>
                    {customerPhone.trim() && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isValidKenyanPhone(customerPhone) ? '#DCFCE7' : '#FEF3C7',
                          color: isValidKenyanPhone(customerPhone) ? '#166534' : '#92400E',
                        }}
                      >
                        {isValidKenyanPhone(customerPhone) ? '✓ Valid' : '07.../01...'}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#6B7280',
                        pointerEvents: 'none',
                      }}
                    >
                      +254
                    </span>
                    <input
                      type="tel"
                      className="form-group__input"
                      placeholder="07XX XXX XXX"
                      value={customerPhone}
                      onChange={e => {
                        setCustomerPhone(e.target.value)
                        setLastWaUrl(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSendWhatsApp()
                        }
                      }}
                      style={{
                        fontSize: '12px',
                        padding: '8px 8px 8px 38px',
                        borderRadius: '8px',
                        border: isValidKenyanPhone(customerPhone)
                          ? '1.5px solid #22c55e'
                          : customerPhone.trim()
                          ? '1.5px solid #f59e0b'
                          : '1px solid #D1D5DB',
                        width: '100%',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Items Card */}
              <div
                style={{
                  background: '#FDFBF7',
                  border: '1px solid #EFE4D2',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '13px', color: '#1F2937' }}>{toast.itemCode}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#4A1032',
                      color: '#FAF6EB',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    Qty: {Math.abs(toast.change)} pc{Math.abs(toast.change) > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B7280', paddingTop: '6px', borderTop: '1px dashed #E5E7EB' }}>
                  <span>Price per pc</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>
                    {(overridePrice !== undefined ? overridePrice : toast.soldPrice) !== undefined
                      ? `KES ${(overridePrice !== undefined ? overridePrice : toast.soldPrice)?.toLocaleString()}`
                      : 'Unrecorded'}
                  </span>
                </div>
                {(overridePrice !== undefined ? overridePrice : toast.soldPrice) !== undefined && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1.5px solid #D4AF37',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#4A1032', letterSpacing: '0.5px' }}>
                      TOTAL DUE:
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: '#4A1032' }}>
                      KES {(((overridePrice !== undefined ? overridePrice : toast.soldPrice) || 0) * Math.abs(toast.change)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Direct fallback link if window.open was swallowed or user wants manual click */}
              {lastWaUrl && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #86EFAC',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    marginBottom: '12px',
                    textAlign: 'center',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: '#166534', fontWeight: 600 }}>WhatsApp opened in new tab.</span>{' '}
                  <a
                    href={lastWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#15803D', fontWeight: 800, textDecoration: 'underline' }}
                  >
                    Click here if blocked ↗
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    background: '#128C7E',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '11px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(18, 140, 126, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onClick={handleSendWhatsApp}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.058.376-.058c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.939l-1.564 5.889 6.088-1.597c1.706.929 3.659 1.469 5.735 1.469 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>Send WhatsApp Receipt {customerPhone.trim() ? `(${formatKenyanPhoneDisplay(customerPhone)})` : ''}</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    style={{
                      background: '#4A1032',
                      color: '#FAF6EB',
                      border: '1px solid #D4AF37',
                      borderRadius: '8px',
                      padding: '9px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                    onClick={() => {
                      const p = (overridePrice !== undefined ? overridePrice : toast.soldPrice) || 0
                      const total = p * Math.abs(toast.change)
                      const data: InvoicePdfData = {
                        invoiceNumber: `REC-${Date.now().toString().slice(-6)}`,
                        customerName: customerName.trim() || undefined,
                        customerPhone: customerPhone.trim() || undefined,
                        items: [
                          {
                            fullCode: toast.itemCode,
                            quantity: Math.abs(toast.change),
                            unitPrice: p,
                            subtotal: total,
                          },
                        ],
                        totalAmount: total,
                      }
                      generateInvoicePdf(data)
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                    <span>Branded PDF</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      background: '#F3F4F6',
                      color: '#374151',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      padding: '9px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                    onClick={() => window.print()}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
                    <span>Print Slip</span>
                  </button>
                </div>

                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    color: '#6B7280',
                    border: 'none',
                    padding: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '2px',
                  }}
                  onClick={() => setShowReceiptModal(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
