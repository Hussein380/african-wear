'use client'

import React, { useState } from 'react'
import { useSaleBasket } from '@/lib/useSaleBasket'
import {
  generateInvoicePdf,
  shareInvoicePdfViaWhatsApp,
  InvoicePdfData,
  isValidKenyanPhone,
  formatKenyanPhoneDisplay,
} from '@/lib/pdfInvoice'

export default function SaleBasketFloating() {
  const { items, updateItem, removeItem, clearBasket, totalPieces, totalAmount } = useSaleBasket()
  const [isOpen, setIsOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [lastWaUrl, setLastWaUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<{
    invoiceNumber: string
    totalPieces: number
    pdfData: InvoicePdfData
  } | null>(null)

  const handleCloseModal = () => {
    setIsOpen(false)
    setCompletedSale(null)
    setLastWaUrl(null)
    setShareError(null)
    setCustomerName('')
    setCustomerPhone('')
    setCheckoutError(null)
  }

  if (items.length === 0 && !completedSale) return null

  const handleCheckoutAndShare = async (openWhatsApp: boolean) => {
    if (isSubmitting) return
    setCheckoutError(null)
    setShareError(null)
    if (openWhatsApp && !customerPhone.trim()) {
      setCheckoutError('Please enter a WhatsApp phone number for the customer (e.g. 0712345678).')
      return
    }

    setIsSubmitting(true)
    let data
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          items: items.map(i => ({
            colorwayId: i.colorwayId,
            fullCode: i.fullCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice || 0,
            subVariantLabel: i.subVariantLabel,
          })),
        }),
      })
      data = await res.json()
      if (!res.ok) {
        setCheckoutError(data.error || 'Failed to complete sale')
        setIsSubmitting(false)
        return
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutError('Network error completing sale. Please try again.')
      setIsSubmitting(false)
      return
    }

    // The sale is saved and stock is deducted. From here on nothing may send it again,
    // so clear the basket before the PDF/WhatsApp step, which can fail on its own.
    const pdfData: InvoicePdfData = {
      invoiceNumber: data.invoiceNumber,
      createdAt: data.createdAt,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      items: data.items,
      totalAmount: data.totalAmount,
    }
    setCompletedSale({
      invoiceNumber: data.invoiceNumber,
      totalPieces: items.reduce((acc, i) => acc + i.quantity, 0),
      pdfData,
    })
    clearBasket()
    setIsSubmitting(false)

    try {
      if (openWhatsApp) {
        const result = await shareInvoicePdfViaWhatsApp(customerPhone.trim(), pdfData)
        setLastWaUrl(result.waUrl)
      } else {
        await generateInvoicePdf(pdfData)
      }
    } catch (err) {
      console.error('Receipt share error:', err)
      setShareError('Sale saved, but the receipt could not be shared. Use "Download PDF Again" below or the Receipts page.')
    }
  }

  return (
    <>
      {/* Floating Action Pill */}
      {items.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--color-primary, #5B1A3E)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '50px',
            boxShadow: '0 8px 24px rgba(91, 26, 62, 0.4)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onClick={() => setIsOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.2 }}>
              Multi-Item Sale ({totalPieces} {totalPieces === 1 ? 'bale' : 'bales'})
            </div>
            <div style={{ fontSize: '11px', opacity: 0.9 }}>
              Tap to make receipt
            </div>
          </div>
        </div>
      )}

      {/* Combined Multi-Item Checkout Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={handleCloseModal} style={{ zIndex: 10000 }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {completedSale ? (
              <>
                <div className="modal__header">
                  <div>
                    <h3 className="modal__title" style={{ fontSize: '17px', color: '#065f46' }}>
                      ✓ Sale Completed & Stock Deducted!
                    </h3>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                      Receipt #{completedSale.invoiceNumber}
                    </p>
                  </div>
                  <button className="modal__close-btn" onClick={handleCloseModal} type="button">
                    ✕
                  </button>
                </div>

                <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '24px 16px' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#dcfce7', color: '#166534', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
                      {completedSale.totalPieces} {completedSale.totalPieces === 1 ? 'bale' : 'bales'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '3px' }}>
                      sold & removed from store shelves
                    </div>
                  </div>

                  {shareError && (
                    <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}>
                      {shareError}
                    </div>
                  )}

                  {lastWaUrl && (
                    <div style={{
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                      border: '1.5px solid #86efac',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      <div style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                        Send receipt directly to customer&apos;s WhatsApp:
                      </div>
                      <a
                        href={lastWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{
                          background: '#128C7E',
                          color: '#ffffff',
                          textDecoration: 'none',
                          padding: '10px 22px',
                          fontSize: '14px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(18, 140, 126, 0.25)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.058.376-.058c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.939l-1.564 5.889 6.088-1.597c1.706.929 3.659 1.469 5.735 1.469 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                        </svg>
                        <span>Open WhatsApp Now</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="modal__footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => generateInvoicePdf(completedSale.pdfData)}
                    className="btn btn--secondary"
                    style={{ fontSize: '12px', padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    <span>Download PDF Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn btn--primary"
                    style={{ fontSize: '13px', fontWeight: 700, padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Done / New Sale</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal__header">
                  <div>
                    <h3 className="modal__title" style={{ fontSize: '17px' }}>
                      Multi-Item Sale Receipt
                    </h3>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                      Mandera African Wear • {items.length} different fabrics selected
                    </p>
                  </div>
                  <button className="modal__close-btn" onClick={handleCloseModal} type="button">
                    ✕
                  </button>
                </div>

                <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {checkoutError && (
                    <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" x2="12" y1="8" y2="12"/>
                        <line x1="12" x2="12.01" y1="16" y2="16"/>
                      </svg>
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  {/* Client Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                        Customer Name (Optional):
                      </label>
                      <input
                        type="text"
                        className="form-group__input"
                        placeholder="e.g. Halima Ahmed"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                          🇰🇪 WhatsApp Number:
                        </label>
                        {customerPhone.trim().length > 0 && (
                          isValidKenyanPhone(customerPhone) ? (
                            <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 700 }}>✓ Valid (+254)</span>
                          ) : (
                            <span style={{ color: '#d97706', fontSize: '11px' }}>07XX / 01XX</span>
                          )
                        )}
                      </div>
                      <input
                        type="tel"
                        className="form-group__input"
                        placeholder="0712 345 678"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleCheckoutAndShare(true)
                          }
                        }}
                        style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '8px' }}
                      />
                      {isValidKenyanPhone(customerPhone) && (
                        <span style={{ fontSize: '11px', color: '#166534', marginTop: '3px', display: 'block' }}>
                          Sends to {formatKenyanPhoneDisplay(customerPhone)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Combined Items Table */}
                  <div style={{ background: '#fafaf9', borderRadius: '10px', border: '1px solid #e7e5e4', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#292524' }}>
                        Fabrics in this Sale ({items.length})
                      </span>
                      <span style={{ fontSize: '11px', color: '#78716c' }}>
                        Stock auto-deducts upon saving
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {items.map((item, idx) => (
                        <div
                          key={`${item.colorwayId}_${item.subVariantId || ''}`}
                          style={{
                            // Two rows so it fits a phone: name + remove, then quantity + price
                            display: 'grid',
                            gridTemplateColumns: '84px minmax(0, 1fr) auto',
                            gridTemplateAreas: '"code code remove" "qty price price"',
                            gap: '8px',
                            alignItems: 'end',
                            fontSize: '12px',
                            background: '#ffffff',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #e7e5e4',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ gridArea: 'code', minWidth: 0, overflowWrap: 'anywhere' }}>
                            <strong style={{ color: '#1c1917', fontSize: '14px' }}>{item.fullCode}</strong>
                            {item.subVariantLabel && (
                              <span style={{ color: '#78716c', fontSize: '11px', display: 'block' }}>
                                {item.subVariantLabel}
                              </span>
                            )}
                          </div>

                          <div style={{ gridArea: 'qty', minWidth: 0 }}>
                            <span style={{ fontSize: '11px', color: '#78716c', display: 'block', marginBottom: '2px' }}>Bales (max {item.available})</span>
                            <input
                              type="number"
                              className="form-group__input"
                              min="1"
                              max={item.available}
                              value={item.quantity}
                              onChange={e => updateItem(idx, parseInt(e.target.value) || 1)}
                              style={{ width: '100%', minHeight: '44px', padding: '8px', fontSize: '16px', borderRadius: '6px' }}
                            />
                          </div>

                          <div style={{ gridArea: 'price', minWidth: 0 }}>
                            <span style={{ fontSize: '11px', color: '#78716c', display: 'block', marginBottom: '2px' }}>Price / bale (KES)</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="form-group__input"
                              placeholder="0"
                              value={item.unitPrice ? String(item.unitPrice) : ''}
                              onChange={e => updateItem(idx, item.quantity, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
                              aria-label={`Selling price per bale for ${item.fullCode}`}
                              style={{ width: '100%', minHeight: '44px', padding: '8px', fontSize: '16px', fontWeight: 700, borderRadius: '6px', border: '1.5px solid #D4AF37', background: '#fffdf5', textAlign: 'right' }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            style={{ gridArea: 'remove', alignSelf: 'start', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', minWidth: '40px', minHeight: '40px' }}
                            aria-label={`Remove ${item.fullCode} from receipt`}
                            title="Remove from receipt"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Summary */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #fdf8f6 0%, #fef3c7 100%)',
                      border: '1px solid #fed7aa',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: '#7c2d12', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Bales</span>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#431407' }}>{totalPieces} {totalPieces === 1 ? 'bale' : 'bales'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#7c2d12', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total</span>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-primary, #4A1032)' }}>KES {totalAmount.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', width: '100%' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: '#128C7E',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '12px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(18, 140, 126, 0.25)',
                        cursor: 'pointer',
                      }}
                      disabled={isSubmitting}
                      onClick={() => handleCheckoutAndShare(true)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.058.376-.058c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.939l-1.564 5.889 6.088-1.597c1.706.929 3.659 1.469 5.735 1.469 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span>{isSubmitting ? 'Processing...' : 'Send WhatsApp & PDF Receipt'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '12px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                      disabled={isSubmitting}
                      onClick={() => handleCheckoutAndShare(false)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                      <span>{isSubmitting ? 'Processing...' : 'Download PDF Receipt'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '4px' }}>
                    <button
                      type="button"
                      onClick={clearBasket}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                      <span>Clear All ({items.length})</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={handleCloseModal}
                      style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '6px' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
