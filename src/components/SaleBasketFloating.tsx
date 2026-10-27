'use client'

import React, { useState } from 'react'
import { useSaleBasket } from '@/lib/useSaleBasket'
import {
  generateInvoicePdf,
  openWhatsAppInvoice,
  InvoicePdfData,
  isValidKenyanPhone,
  formatKenyanPhoneDisplay,
  getWhatsAppInvoiceUrl,
} from '@/lib/pdfInvoice'

export default function SaleBasketFloating() {
  const { items, updateItem, removeItem, clearBasket, totalPieces, totalAmount } = useSaleBasket()
  const [isOpen, setIsOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'credit'>('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [lastWaUrl, setLastWaUrl] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<{
    invoiceNumber: string
    totalAmount: number
    totalPieces: number
    pdfData: InvoicePdfData
  } | null>(null)

  const handleCloseModal = () => {
    setIsOpen(false)
    setCompletedSale(null)
    setLastWaUrl(null)
    setCustomerName('')
    setCustomerPhone('')
    setCheckoutError(null)
  }

  if (items.length === 0 && !completedSale) return null

  const handleCheckoutAndShare = async (openWhatsApp: boolean) => {
    setCheckoutError(null)
    if (openWhatsApp && !customerPhone.trim()) {
      setCheckoutError('Please enter a WhatsApp phone number for the customer (e.g. 0712345678).')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          paymentMethod,
          items: items.map(i => ({
            colorwayId: i.colorwayId,
            fullCode: i.fullCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            costPrice: i.costPrice,
            subVariantLabel: i.subVariantLabel,
          })),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        const pdfData: InvoicePdfData = {
          invoiceNumber: data.invoiceNumber,
          createdAt: data.createdAt,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          paymentMethod: data.paymentMethod,
          items: data.items,
          totalAmount: data.totalAmount,
        }

        const saleInfo = {
          invoiceNumber: data.invoiceNumber,
          totalAmount: data.totalAmount,
          totalPieces: items.reduce((acc, i) => acc + i.quantity, 0),
          pdfData,
        }

        // 1. Generate and download branded PDF invoice
        await generateInvoicePdf(pdfData)

        // 2. Open WhatsApp DM if requested
        if (openWhatsApp && customerPhone.trim()) {
          const waUrl = getWhatsAppInvoiceUrl(customerPhone.trim(), pdfData)
          setLastWaUrl(waUrl)
          openWhatsAppInvoice(customerPhone.trim(), pdfData)
        }

        setCompletedSale(saleInfo)
        clearBasket()
        setIsSubmitting(false)
      } else {
        setCheckoutError(data.error || 'Failed to complete sale')
        setIsSubmitting(false)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutError('Network error completing sale. Please try again.')
      setIsSubmitting(false)
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
          <span style={{ fontSize: '18px' }}>🛍️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.2 }}>
              Multi-Item Sale ({totalPieces} pc{totalPieces > 1 ? 's' : ''})
            </div>
            <div style={{ fontSize: '11px', opacity: 0.9 }}>
              Total: KES {totalAmount.toLocaleString()} • Tap to Invoice
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
                      KES {completedSale.totalAmount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '3px' }}>
                      {completedSale.totalPieces} fabric piece{completedSale.totalPieces > 1 ? 's' : ''} sold & removed from store shelves
                    </div>
                  </div>

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
                          background: '#25D366',
                          color: '#ffffff',
                          textDecoration: 'none',
                          padding: '10px 22px',
                          fontSize: '14px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
                        }}
                      >
                        💬 Open WhatsApp Now
                      </a>
                    </div>
                  )}
                </div>

                <div className="modal__footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => generateInvoicePdf(completedSale.pdfData)}
                    className="btn btn--secondary"
                    style={{ fontSize: '12px', padding: '10px 16px' }}
                  >
                    📄 Download PDF Again
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn btn--primary"
                    style={{ fontSize: '13px', fontWeight: 700, padding: '10px 20px' }}
                  >
                    ✓ Done / New Sale
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal__header">
                  <div>
                    <h3 className="modal__title" style={{ fontSize: '17px' }}>
                      Combine & Invoice Multiple Items
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

                  {/* Payment Method */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                      Payment Method:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      {[
                        { id: 'cash', label: '💵 Cash in Drawer' },
                        { id: 'mpesa', label: '📱 M-Pesa on Till' },
                        { id: 'credit', label: '💳 Credit (Deyn)' },
                      ].map(pm => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id as any)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1.5px solid ${paymentMethod === pm.id ? 'var(--color-primary, #4A1032)' : '#e5e7eb'}`,
                            background: paymentMethod === pm.id ? 'rgba(74, 16, 50, 0.08)' : '#ffffff',
                            color: paymentMethod === pm.id ? 'var(--color-primary, #4A1032)' : '#4b5563',
                            fontWeight: paymentMethod === pm.id ? 700 : 500,
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {pm.label}
                        </button>
                      ))}
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
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1.2fr auto',
                            gap: '8px',
                            alignItems: 'center',
                            fontSize: '12px',
                            background: '#ffffff',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #e7e5e4',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div>
                            <strong style={{ color: '#1c1917', fontSize: '13px' }}>{item.fullCode}</strong>
                            {item.subVariantLabel && (
                              <span style={{ color: '#78716c', fontSize: '11px', display: 'block' }}>
                                {item.subVariantLabel}
                              </span>
                            )}
                          </div>

                          <div>
                            <span style={{ fontSize: '10px', color: '#78716c', display: 'block' }}>Qty (max {item.available})</span>
                            <input
                              type="number"
                              className="form-group__input"
                              min="1"
                              max={item.available}
                              value={item.quantity}
                              onChange={e => updateItem(idx, parseInt(e.target.value) || 1)}
                              style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px' }}
                            />
                          </div>

                          <div>
                            <span style={{ fontSize: '10px', color: '#78716c', display: 'block' }}>Price (KES)</span>
                            <input
                              type="number"
                              className="form-group__input"
                              min="0"
                              value={item.unitPrice}
                              onChange={e => updateItem(idx, item.quantity, parseFloat(e.target.value) || 0)}
                              style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px' }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '4px 6px' }}
                            title="Remove from invoice"
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
                      <span style={{ fontSize: '11px', color: '#7c2d12', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Pieces</span>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#431407' }}>{totalPieces} pcs</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#7c2d12', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Grand Total</span>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--color-primary, #4A1032)' }}>
                        KES {totalAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', width: '100%' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: '#25D366',
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
                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                        cursor: 'pointer',
                      }}
                      disabled={isSubmitting}
                      onClick={() => handleCheckoutAndShare(true)}
                    >
                      💬 {isSubmitting ? 'Processing...' : 'Send WhatsApp & PDF'}
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
                      📄 {isSubmitting ? 'Processing...' : 'Download PDF Invoice'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '4px' }}>
                    <button
                      type="button"
                      onClick={clearBasket}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                    >
                      🗑️ Clear All ({items.length})
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
