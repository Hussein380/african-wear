'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SaleBasketFloating from '@/components/SaleBasketFloating'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import {
  generateInvoicePdf,
  shareInvoicePdfViaWhatsApp,
  InvoicePdfData,
  formatKenyanPhoneDisplay,
} from '@/lib/pdfInvoice'

interface ReceiptItem {
  colorwayId?: string
  fullCode: string
  subVariantLabel?: string
  quantity: number
  unitPrice: number
  subtotal: number
}

interface ReceiptRecord {
  _id: string
  invoiceNumber: string
  customerName?: string
  customerPhone?: string
  paymentMethod?: string
  items: ReceiptItem[]
  totalAmount: number
  createdAt: string
  notes?: string
}

export default function ReceiptsPage() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'week'>('all')

  useEffect(() => {
    async function loadReceipts() {
      try {
        const res = await fetch('/api/invoices?limit=100&t=' + Date.now(), {
          cache: 'no-store',
        })
        if (res.ok) {
          const json = await res.json()
          setReceipts(json.invoices || [])
        }
      } catch (err) {
        console.error('Failed to load receipts:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadReceipts()
  }, [])

  const filteredReceipts = useMemo(() => {
    let result = receipts

    // Period filter
    const now = new Date()
    if (activeFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      result = result.filter(r => r.createdAt && r.createdAt.startsWith(todayStr))
    } else if (activeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      result = result.filter(r => new Date(r.createdAt) >= weekAgo)
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter(r => {
        const invNum = (r.invoiceNumber || '').toLowerCase()
        const name = (r.customerName || '').toLowerCase()
        const phone = (r.customerPhone || '').toLowerCase()
        const itemsMatch = (r.items || []).some(i => i.fullCode.toLowerCase().includes(q))
        return invNum.includes(q) || name.includes(q) || phone.includes(q) || itemsMatch
      })
    }

    return result
  }, [receipts, searchTerm, activeFilter])

  const totalBalesIssued = useMemo(() => {
    return filteredReceipts.reduce((sum, r) => {
      return sum + (r.items || []).reduce((iSum, item) => iSum + (item.quantity || 0), 0)
    }, 0)
  }, [filteredReceipts])

  const handleDownloadPdf = (r: ReceiptRecord) => {
    const pdfData: InvoicePdfData = {
      invoiceNumber: r.invoiceNumber,
      createdAt: r.createdAt,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      paymentMethod: r.paymentMethod,
      items: r.items,
      totalAmount: r.totalAmount,
    }
    generateInvoicePdf(pdfData)
  }

  const handleShareWhatsApp = async (r: ReceiptRecord) => {
    if (!r.customerPhone) {
      const customPhone = prompt('Enter customer WhatsApp phone number (e.g. 0712345678):')
      if (!customPhone) return
      r.customerPhone = customPhone
    }
    const pdfData: InvoicePdfData = {
      invoiceNumber: r.invoiceNumber,
      createdAt: r.createdAt,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      paymentMethod: r.paymentMethod,
      items: r.items,
      totalAmount: r.totalAmount,
    }
    await shareInvoicePdfViaWhatsApp(r.customerPhone, pdfData)
  }

  return (
    <>
      {/* App Bar */}
      <header className="appbar">
        <div className="appbar__left">
          <button
            className="mobile-menu-btn"
            onClick={() => setIsSidebarOpen(prev => !prev)}
            aria-label="Toggle menu"
            type="button"
          >
            ☰
          </button>
          <button
            className="appbar__back-btn"
            onClick={() => router.push('/classify')}
            type="button"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            <span>Back</span>
          </button>
          <div>
            <h1 className="appbar__title">Customer Sales Receipts</h1>
            <p className="appbar__subtitle">
              Proof of transactions • Re-download branded PDFs or share via WhatsApp
            </p>
          </div>
        </div>
        <div className="appbar__right">
          <ExpandingSearchDock
            onSearch={(val) => setSearchTerm(val)}
            placeholder="Search receipts by #, name, phone, code..."
          />
        </div>
      </header>

      {/* Navigation Sidebar */}
      <Sidebar
        activeCategory="Receipts"
        onCategoryChange={(cat) => router.push(cat === 'Receipts' ? '/receipts' : cat === 'Inventory' ? '/inventory' : `/classify?category=${cat}`)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="main-content" style={{ padding: 'var(--space-lg)' }}>
        {/* Top Metric Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #5B1A3E', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Receipts Issued
            </span>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#5B1A3E', marginTop: '2px' }}>
              {filteredReceipts.length}
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              {activeFilter === 'all' ? 'All records in database' : activeFilter === 'today' ? "Issued today" : 'Issued past 7 days'}
            </span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #16a34a', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Bales Sold via Receipts
            </span>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
              {totalBalesIssued} <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>bales</span>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Physical fabric rolls deducted
            </span>
          </div>

          {/* Quick Date Tabs */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Filter By Period
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['all', 'today', 'week'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveFilter(tab)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: `1.5px solid ${activeFilter === tab ? '#5B1A3E' : '#e2e8f0'}`,
                    background: activeFilter === tab ? '#5B1A3E' : '#ffffff',
                    color: activeFilter === tab ? '#ffffff' : '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'all' ? 'All Time' : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '12px' }}>
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '14px' }}>Loading Customer Receipts...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredReceipts.length === 0 && (
          <div className="empty-state" style={{ background: '#ffffff', borderRadius: '16px', padding: '48px 20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: '#FAF5EB', color: '#5B1A3E', marginBottom: '14px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
                <line x1="8" y1="8" x2="16" y2="8"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px' }}>No Receipts Found</h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
              {searchTerm
                ? `No sales receipts match "${searchTerm}". Try checking the receipt number or customer name.`
                : 'Whenever you deduct stock or complete a multi-item sale, the official PDF receipt will be archived here.'}
            </p>
          </div>
        )}

        {/* Receipts Cards Grid */}
        {!isLoading && filteredReceipts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {filteredReceipts.map(r => {
              const totalBales = (r.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0)
              const dateObj = new Date(r.createdAt)
              const dateFormatted = isNaN(dateObj.getTime())
                ? 'Date unrecorded'
                : `${dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

              return (
                <div
                  key={r._id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #4A1032 0%, #6B1D48 100%)',
                      color: '#FAF6EB',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#E6CA65', fontWeight: 800 }}>
                        RECEIPT
                      </span>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '2px 0 0', letterSpacing: '0.5px' }}>
                        {r.invoiceNumber}
                      </h3>
                    </div>
                    <span
                      style={{
                        background: 'rgba(212, 175, 55, 0.2)',
                        border: '1px solid #D4AF37',
                        color: '#FAF6EB',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '20px',
                      }}
                    >
                      {totalBales} {totalBales === 1 ? 'bale' : 'bales'}
                    </span>
                  </div>

                  {/* Customer Meta */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafaf9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                        {r.customerName?.trim() || 'Walk-in Customer'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {r.customerPhone ? formatKenyanPhoneDisplay(r.customerPhone) : 'No phone recorded'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: r.paymentMethod === 'mpesa' ? '#DCFCE7' : '#F1F5F9',
                          color: r.paymentMethod === 'mpesa' ? '#166534' : '#334155',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-block',
                          marginBottom: '2px',
                        }}
                      >
                        {r.paymentMethod ? r.paymentMethod.toUpperCase() : 'CASH'}
                      </span>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                        {dateFormatted}
                      </div>
                    </div>
                  </div>

                  {/* Itemized Fabrics List */}
                  <div style={{ padding: '12px 16px', flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Fabrics Sold ({r.items?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(r.items || []).map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px',
                            padding: '4px 0',
                            borderBottom: idx === (r.items.length - 1) ? 'none' : '1px dashed #e2e8f0',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: '#334155' }}>
                            {item.fullCode}
                            {item.subVariantLabel ? <span style={{ color: '#64748b', fontWeight: 500 }}> ({item.subVariantLabel})</span> : ''}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                              {item.quantity} {item.quantity === 1 ? 'bale' : 'bales'}
                            </span>
                            {item.subtotal > 0 && (
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                KES {item.subtotal.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {r.totalAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px', paddingTop: '10px', borderTop: '1.5px solid #D4AF37' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4A1032' }}>TOTAL:</span>
                        <span style={{ fontSize: '17px', fontWeight: 900, color: '#4A1032' }}>
                          KES {r.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr',
                      gap: '8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(r)}
                      style={{
                        background: '#128C7E',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                      title="Share PDF receipt directly with customer via WhatsApp"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.058.376-.058c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.939l-1.564 5.889 6.088-1.597c1.706.929 3.659 1.469 5.735 1.469 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span>WhatsApp PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(r)}
                      style={{
                        background: '#FAF6EB',
                        color: '#4A1032',
                        border: '1px solid #D4AF37',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                      title="Download clean branded PDF receipt"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                      <span>PDF Slip</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Floating Multi-Item Sale Basket preserved */}
      <SaleBasketFloating />
    </>
  )
}
