'use client'

import React, { useState } from 'react'

interface StaffGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function StaffGuideModal({ isOpen, onClose }: StaffGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'buttons' | 'numbers' | 'receipts' | 'pages'>('buttons')

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10001, backdropFilter: 'blur(4px)', background: 'rgba(26, 11, 20, 0.75)' }}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '92%',
          padding: '0',
          borderRadius: '20px',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(74, 16, 50, 0.35)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4A1032 0%, #6B1D48 60%, #340822 100%)',
            color: '#FAF6EB',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '3px solid #D4AF37',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: '#E6CA65', fontWeight: 700, textTransform: 'uppercase' }}>
              Mandera African Wear
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0' }}>
              📖 Simple Staff Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '4px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('buttons')}
            style={{
              padding: '8px 4px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'buttons' ? '#5B1A3E' : 'transparent',
              color: activeTab === 'buttons' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            1. − / + / Undo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('numbers')}
            style={{
              padding: '8px 4px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'numbers' ? '#5B1A3E' : 'transparent',
              color: activeTab === 'numbers' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            2. The Numbers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            style={{
              padding: '8px 4px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'receipts' ? '#5B1A3E' : 'transparent',
              color: activeTab === 'receipts' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            3. Receipts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pages')}
            style={{
              padding: '8px 4px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'pages' ? '#5B1A3E' : 'transparent',
              color: activeTab === 'pages' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            4. All Pages
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, fontSize: '13px', lineHeight: 1.6, color: '#334155' }}>
          {/* TAB 1: BUTTONS */}
          {activeTab === 'buttons' && (
            <div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#991b1b', fontSize: '14px' }}>
                  <span style={{ background: '#991b1b', color: 'white', padding: '2px 8px', borderRadius: '6px' }}>−</span>
                  <span>MINUS BUTTON = ITEM SOLD</span>
                </div>
                <p style={{ margin: '6px 0 0', color: '#7f1d1d', fontSize: '12px' }}>
                  Tap <strong>−</strong> whenever a customer buys a piece. It takes 1 piece off the shelf and records an official sale.
                </p>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#166534', fontSize: '14px' }}>
                  <span style={{ background: '#166534', color: 'white', padding: '2px 8px', borderRadius: '6px' }}>+</span>
                  <span>PLUS BUTTON = NEW STOCK ARRIVAL</span>
                </div>
                <p style={{ margin: '6px 0 0', color: '#14532d', fontSize: '12px' }}>
                  Tap <strong>+</strong> when supplier brings new fabric delivery to add to the shelf.
                </p>
              </div>

              <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#92400e', fontSize: '14px' }}>
                  <span style={{ background: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: '6px' }}>Undo ↺</span>
                  <span>THE GOLDEN RULE: HOW TO FIX MISTAKES</span>
                </div>
                <p style={{ margin: '6px 0 0', color: '#78350f', fontSize: '12px' }}>
                  ⚠️ <strong>If you tapped by accident, NEVER tap the opposite button to fix it!</strong><br />
                  A yellow <strong>Undo ↺</strong> banner will appear at the bottom. Tap <strong>Undo ↺</strong> to cancel the mistake cleanly.
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Special Tags in the Popup:</div>
                <ul style={{ margin: '0', paddingLeft: '18px', fontSize: '12px' }}>
                  <li><strong>Customer Return</strong>: If a customer returns an item, tap <strong>+</strong>, then tap <em>Customer Return</em> on the popup.</li>
                  <li><strong>Own Use</strong>: If an item was taken for yourself or shop display, tap <strong>−</strong>, then tap <em>Own Use</em> on the popup.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: NUMBERS */}
          {activeTab === 'numbers' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: '10px' }}>
                Why is the number different from the boxes?
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 800, color: '#86198f', fontSize: '13px' }}>
                    📦 BOXES (STYLES / PATTERNS)
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#701a75' }}>
                    Each card on your screen is <strong>1 Style / Box</strong> (e.g. 11 boxes). Even if a box runs out of stock, the box stays on the screen so you know the pattern exists.
                  </p>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '13px' }}>
                    🧵 PIECES IN STOCK
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#1e3a8a' }}>
                    This counts the <strong>real physical fabric rolls</strong>. For example:
                    <br />• Box 1 has <strong>2 pieces</strong>
                    <br />• Box 2 has <strong>2 pieces</strong>
                    <br />• Box 3 has <strong>1 piece</strong>
                    <br />• Box 4 has <strong>0 pieces</strong> (Out of stock!)
                    <br />👉 Total: <strong>11 Boxes, but 13 Pieces in Stock!</strong>
                  </p>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#334155', marginBottom: '2px' }}>⚡ Real-Time Instant Sync:</div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Whenever you tap <strong>−</strong> or <strong>+</strong>, the pieces count updates immediately on the card, in the top header, and on the main catalog!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RECEIPTS */}
          {activeTab === 'receipts' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: '10px' }}>
                How to give a customer a receipt
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 800, color: '#166534', fontSize: '13px' }}>
                    Method 1: Instant WhatsApp Receipt on 1 Item
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#14532d' }}>
                    When you tap <strong>−</strong>, look at the popup banner at the bottom and click <strong>🧾 Receipt</strong>.
                    Type the customer&apos;s phone number (e.g. 0712345678) and tap <strong>Send WhatsApp Receipt</strong>. WhatsApp opens with an official boutique receipt ready to send!
                  </p>
                </div>

                <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontWeight: 800, color: '#9d174d', fontSize: '13px' }}>
                    Method 2: Multi-Item Sale (+Invoice)
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#831843' }}>
                    If a customer buys 2 or more different fabric items:
                    <br />1. Tap <strong>🛍️ +Invoice</strong> on each item they want.
                    <br />2. Tap the floating purple <strong>Multi-Item Sale</strong> bar at the bottom.
                    <br />3. Enter customer details, choose Cash / M-Pesa, and complete the sale!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PAGES */}
          {activeTab === 'pages' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: '10px' }}>
                Quick Map of the Entire System
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#5B1A3E' }}>🎨 Classify (Showroom)</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    The main visual fabric showroom. Tap any design code (like AN, AJ) to see its colorways and change stock.
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#5B1A3E' }}>📋 Master Stock (Inventory)</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Spreadsheet table of every fabric piece. You can search by code, sort, and download Excel/PDF reports.
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#5B1A3E' }}>📜 Activity Log (History)</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Audit trail showing every movement: who sold what, when, and at what time.
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#5B1A3E' }}>💰 Finance & Sales</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Daily sales, total revenue, profit tracking, and customer invoice records.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Tap <strong>💡 Help</strong> anytime to reopen this guide.
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}
          >
            Got it, thanks! ✓
          </button>
        </div>
      </div>
    </div>
  )
}
