'use client'

import React, { useState } from 'react'
import { useSaleBasket } from '@/lib/useSaleBasket'
import { generateInvoicePdf, openWhatsAppInvoice, InvoicePdfData } from '@/lib/pdfInvoice'

export default function SaleBasketFloating() {
  const { items, updateItem, removeItem, clearBasket, totalPieces, totalAmount } = useSaleBasket()
  const [isOpen, setIsOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'credit'>('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (items.length === 0) return null

  const handleCheckoutAndShare = async (openWhatsApp: boolean) => {
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

        // 1. Generate and download branded PDF invoice
        await generateInvoicePdf(pdfData)

        // 2. Open WhatsApp DM if requested
        if (openWhatsApp) {
          const phoneToSend = customerPhone.trim()
          if (!phoneToSend) {
            const ask = prompt('Enter customer WhatsApp number to send invoice (e.g. 0712345678):')
            if (ask) openWhatsAppInvoice(ask, pdfData)
          } else {
            openWhatsAppInvoice(phoneToSend, pdfData)
          }
        }

        clearBasket()
        setIsOpen(false)
        setCustomerName('')
        setCustomerPhone('')
        alert(`✓ Invoice ${data.invoiceNumber} created, stock updated, and PDF generated!`)
      } else {
        alert(data.error || 'Failed to complete sale')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Network error completing sale')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating Action Pill */}
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

      {/* Combined Multi-Item Checkout Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)} style={{ zIndex: 10000 }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal__header">
              <div>
                <h3 className="modal__title" style={{ fontSize: '17px' }}>
                  Combine & Invoice Multiple Items
                </h3>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                  Mandera African Wear • {items.length} different fabrics selected
                </p>
              </div>
              <button className="modal__close-btn" onClick={() => setIsOpen(false)} type="button">
                ✕
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Client Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Customer Name (Optional):
                  </label>
                  <input
                    type="text"
                    className="form-group__input"
                    placeholder="e.g. Halima Ahmed"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    WhatsApp Phone:
                  </label>
                  <input
                    type="text"
                    className="form-group__input"
                    placeholder="e.g. 0712345678"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Payment Method:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['cash', 'mpesa', 'credit'] as const).map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setPaymentMethod(pm)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${paymentMethod === pm ? 'var(--color-primary)' : '#d1d5db'}`,
                        background: paymentMethod === pm ? 'rgba(91, 26, 62, 0.1)' : '#ffffff',
                        color: paymentMethod === pm ? 'var(--color-primary)' : '#374151',
                        fontWeight: paymentMethod === pm ? 700 : 400,
                        fontSize: '12px',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {pm === 'mpesa' ? 'M-Pesa' : pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Combined Items Table */}
              <div style={{ background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  Selected Fabrics ({items.length})
                </span>

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
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #f3f4f6',
                      }}
                    >
                      <div>
                        <strong>{item.fullCode}</strong>
                        {item.subVariantLabel && (
                          <span style={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                            {item.subVariantLabel}
                          </span>
                        )}
                      </div>

                      <div>
                        <span style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>Qty (max {item.available})</span>
                        <input
                          type="number"
                          className="form-group__input"
                          min="1"
                          max={item.available}
                          value={item.quantity}
                          onChange={e => updateItem(idx, parseInt(e.target.value) || 1)}
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>Price (KES)</span>
                        <input
                          type="number"
                          className="form-group__input"
                          min="0"
                          value={item.unitPrice}
                          onChange={e => updateItem(idx, item.quantity, parseFloat(e.target.value) || 0)}
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
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
                  background: '#f3f4f6',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>Total Pieces:</span>
                  <strong>{totalPieces} pcs</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>Total Amount:</span>
                  <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                    KES {totalAmount.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <div className="modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12px',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
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
                    fontSize: '12px',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  disabled={isSubmitting}
                  onClick={() => handleCheckoutAndShare(false)}
                >
                  📄 {isSubmitting ? 'Processing...' : 'Download PDF Invoice'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <button
                  type="button"
                  onClick={clearBasket}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Clear All Items
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setIsOpen(false)}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
