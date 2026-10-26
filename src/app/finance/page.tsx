'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Colorway, Invoice } from '@/types'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import Sidebar from '@/components/Sidebar'
import {
  generateInvoicePdf,
  openWhatsAppInvoice,
  isValidKenyanPhone,
  formatKenyanPhoneDisplay,
  getWhatsAppInvoiceUrl,
} from '@/lib/pdfInvoice'

interface FinanceSummary {
  period: {
    range: string
    startDate: string
    endDate: string
  }
  summary: {
    totalRevenue: number
    totalCost: number
    estimatedProfit: number
    totalPiecesSold: number
    pricedPiecesSold: number
    unpricedPiecesSold: number
    invoicesCount: number
  }
  coverage: {
    totalColorways: number
    pricedColorways: number
    coveragePercent: number
  }
  recentSales: {
    id: string
    fullCode: string
    subVariantLabel?: string
    quantity: number
    soldPrice?: number
    costPrice?: number
    totalRevenue?: number
    itemProfit?: number
    isLoss: boolean
    timestamp: string
  }[]
}

interface InvoiceItemDraft {
  colorwayId: string
  fullCode: string
  quantity: number
  unitPrice: number
  costPrice?: number
  available: number
  subVariantLabel?: string
  skipDeduction?: boolean
  recentSaleActivityId?: string
}

function formatFriendlyTime(isoString: string): { label: string; isRecent: boolean } {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)

  if (diffSec < 90) return { label: 'Just now', isRecent: true }
  if (diffMin < 60) return { label: `${diffMin}m ago`, isRecent: true }
  if (diffHr < 24 && date.getDate() === now.getDate()) {
    return {
      label: `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      isRecent: false,
    }
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
    return {
      label: `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      isRecent: false,
    }
  }
  return {
    label: `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    isRecent: false,
  }
}

export default function FinancePage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'invoice' | 'analytics' | 'prices'>('invoice')

  // Analytics state
  const [financeData, setFinanceData] = useState<FinanceSummary | null>(null)
  const [selectedRange, setSelectedRange] = useState<string>('month')
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // New Invoice form state
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'credit' | 'other'>('cash')
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemDraft[]>([])
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
  const [invoiceSuccessMsg, setInvoiceSuccessMsg] = useState('')

  // Inventory / Price Manager state
  const [allColorways, setAllColorways] = useState<Colorway[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  const [editingPriceCw, setEditingPriceCw] = useState<Colorway | null>(null)
  const [editBuyingPrice, setEditBuyingPrice] = useState('')
  const [editSellingPrice, setEditSellingPrice] = useState('')
  const [isSavingPrice, setIsSavingPrice] = useState(false)
  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null)
  const [isVoidingInvoice, setIsVoidingInvoice] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'stock' | 'recentSales'>('recentSales')
  const [modalPhone, setModalPhone] = useState('')
  const [lastWaUrl, setLastWaUrl] = useState<string | null>(null)

  // Load Finance Analytics
  const fetchFinanceAnalytics = useCallback(async (range: string) => {
    setIsLoadingAnalytics(true)
    try {
      const res = await fetch(`/api/finance?range=${range}`)
      if (res.ok) {
        const data = await res.json()
        setFinanceData(data)
      }
    } catch (err) {
      console.error('Failed to load finance analytics:', err)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }, [])

  // Load Invoices
  const fetchInvoices = useCallback(async () => {
    setIsLoadingInvoices(true)
    try {
      const res = await fetch('/api/invoices')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
      }
    } catch (err) {
      console.error('Failed to load invoices:', err)
    } finally {
      setIsLoadingInvoices(false)
    }
  }, [])

  // Load all colorways for price management & invoice selection
  const fetchAllColorways = useCallback(async () => {
    setIsLoadingInventory(true)
    try {
      // Fetch design codes, then colorways
      const dcRes = await fetch('/api/design-codes')
      if (!dcRes.ok) return
      const designCodes = await dcRes.json()

      const colorwayPromises = designCodes.map(async (dc: { _id: string }) => {
        const cwRes = await fetch(`/api/colorways?designCodeId=${dc._id}`)
        if (cwRes.ok) return await cwRes.json()
        return []
      })

      const nested = await Promise.all(colorwayPromises)
      const flat = nested.flat()
      setAllColorways(flat)
    } catch (err) {
      console.error('Failed to load colorways for price management:', err)
    } finally {
      setIsLoadingInventory(false)
    }
  }, [])

  useEffect(() => {
    fetchFinanceAnalytics(selectedRange)
    fetchInvoices()
    fetchAllColorways()
  }, [fetchFinanceAnalytics, fetchInvoices, fetchAllColorways, selectedRange])

  // Sorted recent sales (Strictly Newest to Oldest)
  const sortedRecentSales = useMemo(() => {
    if (!financeData?.recentSales) return []
    return [...financeData.recentSales].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [financeData?.recentSales])

  const latestSale = sortedRecentSales[0] || null

  // Add a Recent Shop Sale (Already Deducted) into the Receipt/Bill draft
  const handleAddRecentSaleToDraft = (sale: FinanceSummary['recentSales'][0]) => {
    if (invoiceItems.some(i => i.recentSaleActivityId === sale.id)) return

    const matchingCw = allColorways.find(c => c.fullCode === sale.fullCode)
    setInvoiceItems(prev => [
      ...prev,
      {
        colorwayId: matchingCw?._id || sale.id,
        fullCode: sale.fullCode,
        subVariantLabel: sale.subVariantLabel,
        quantity: sale.quantity,
        unitPrice: sale.soldPrice ?? matchingCw?.sellingPrice ?? 0,
        costPrice: sale.costPrice ?? matchingCw?.buyingPrice,
        available: matchingCw?.quantityAvailable ?? sale.quantity,
        skipDeduction: true, // Already deducted when minus (-) was tapped in shop
        recentSaleActivityId: sale.id,
      },
    ])
  }

  // Add Item from Shelves to Invoice Draft (Deducts on confirm)
  const handleAddItemToInvoice = (cw: Colorway) => {
    const existingIndex = invoiceItems.findIndex(i => i.colorwayId === cw._id && !i.skipDeduction)
    if (existingIndex > -1) {
      const updated = [...invoiceItems]
      if (updated[existingIndex].quantity < cw.quantityAvailable) {
        updated[existingIndex].quantity += 1
        setInvoiceItems(updated)
      }
    } else {
      setInvoiceItems([
        ...invoiceItems,
        {
          colorwayId: cw._id,
          fullCode: cw.fullCode,
          quantity: 1,
          unitPrice: cw.sellingPrice || 0,
          costPrice: cw.buyingPrice,
          available: cw.quantityAvailable,
          skipDeduction: false, // Picked from shelves, will deduct on save
        },
      ])
    }
  }

  // Remove Item from Invoice Draft
  const handleRemoveItem = (index: number) => {
    const updated = [...invoiceItems]
    updated.splice(index, 1)
    setInvoiceItems(updated)
  }

  // Update Item Price or Quantity
  const handleUpdateItem = (index: number, field: 'quantity' | 'unitPrice', val: number) => {
    const updated = [...invoiceItems]
    if (field === 'quantity') {
      const max = updated[index].available
      updated[index].quantity = Math.max(1, Math.min(val, max))
    } else {
      updated[index].unitPrice = Math.max(0, val)
    }
    setInvoiceItems(updated)
  }

  // Submit Invoice
  const handleCreateInvoice = async () => {
    if (invoiceItems.length === 0) return
    setIsCreatingInvoice(true)
    setInvoiceSuccessMsg('')

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          paymentMethod,
          items: invoiceItems.map(i => ({
            colorwayId: i.colorwayId,
            fullCode: i.fullCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            costPrice: i.costPrice,
            subVariantLabel: i.subVariantLabel,
            skipDeduction: i.skipDeduction,
            recentSaleActivityId: i.recentSaleActivityId,
          })),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setInvoiceSuccessMsg(`Receipt ${data.invoiceNumber} saved successfully!`)
        setInvoiceItems([])
        setCustomerName('')
        setCustomerPhone('')
        fetchInvoices()
        fetchFinanceAnalytics(selectedRange)
        fetchAllColorways()
        setSelectedInvoice(data)
      } else {
        alert(data.error || 'Failed to create invoice')
      }
    } catch (err) {
      console.error('Invoice creation error:', err)
      alert('Network error creating invoice')
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  // Save or Clear Price for a Colorway (CRUD)
  const handleSavePrice = async () => {
    if (!editingPriceCw) return
    setIsSavingPrice(true)

    const bVal = editBuyingPrice.trim() !== '' ? Number(editBuyingPrice) : null
    const sVal = editSellingPrice.trim() !== '' ? Number(editSellingPrice) : null

    try {
      const res = await fetch(`/api/colorways/${editingPriceCw._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyingPrice: bVal,
          sellingPrice: sVal,
        }),
      })

      if (res.ok) {
        setAllColorways(prev =>
          prev.map(item =>
            item._id === editingPriceCw._id
              ? {
                  ...item,
                  buyingPrice: bVal !== null ? bVal : undefined,
                  sellingPrice: sVal !== null ? sVal : undefined,
                }
              : item
          )
        )
        setEditingPriceCw(null)
        fetchFinanceAnalytics(selectedRange)
      } else {
        alert('Failed to update price')
      }
    } catch (err) {
      console.error('Error updating price:', err)
      alert('Network error')
    } finally {
      setIsSavingPrice(false)
    }
  }

  // Void / Undo an individual sale from the sales ledger
  const handleVoidSale = async (sale: { id: string; fullCode: string; quantity: number; totalRevenue?: number }) => {
    const revenueText = sale.totalRevenue ? ` (KES ${sale.totalRevenue.toLocaleString()})` : ''
    const confirmed = window.confirm(
      `Undo / Void this accidental sale of ${sale.quantity} pc(s) of ${sale.fullCode}${revenueText}?\n\n• The item will be restored back to store inventory.\n• The sale revenue/profit will be completely erased from reports.`
    )
    if (!confirmed) return

    setVoidingSaleId(sale.id)
    try {
      const res = await fetch(`/api/activities/${sale.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        alert(`✓ Sale voided. ${sale.fullCode} restored back to inventory.`)
        fetchFinanceAnalytics(selectedRange)
        fetchAllColorways()
        fetchInvoices()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to void sale')
      }
    } catch (err) {
      console.error('Failed to void sale:', err)
      alert('Network error while voiding sale.')
    } finally {
      setVoidingSaleId(null)
    }
  }

  const handleSelectInvoice = (inv: Invoice | null) => {
    setSelectedInvoice(inv)
    setModalPhone(inv?.customerPhone || '')
    setLastWaUrl(null)
  }

  // Open receipt / invoice for any past counter sale without deducting stock again
  const handleOpenReceiptForSale = (sale: {
    id: string
    fullCode: string
    subVariantLabel?: string | null
    quantity: number
    soldPrice?: number
    costPrice?: number
    timestamp: string
  }) => {
    const unitPrice = sale.soldPrice || 0
    const invoiceDraft: Invoice = {
      _id: sale.id,
      invoiceNumber: `REC-${new Date(sale.timestamp).toISOString().slice(0, 10).replace(/-/g, '')}-${sale.id.slice(-4).toUpperCase()}`,
      customerName: 'Walk-in Customer',
      customerPhone: '',
      paymentMethod: 'cash',
      items: [
        {
          colorwayId: '',
          designCodeId: '',
          fullCode: sale.fullCode,
          subVariantLabel: sale.subVariantLabel || undefined,
          quantity: sale.quantity,
          unitPrice,
          costPrice: sale.costPrice,
          subtotal: unitPrice * sale.quantity,
        },
      ],
      totalAmount: unitPrice * sale.quantity,
      status: 'completed',
      createdAt: sale.timestamp,
    }
    handleSelectInvoice(invoiceDraft)
  }

  const handleSendWhatsApp = () => {
    if (!selectedInvoice) return
    const targetPhone = modalPhone.trim() || selectedInvoice.customerPhone || ''
    if (!targetPhone) {
      alert('Please enter a Kenyan phone number (e.g. 0725996394) to open WhatsApp.')
      return
    }
    const url = getWhatsAppInvoiceUrl(targetPhone, selectedInvoice)
    setLastWaUrl(url)
    try {
      window.open(url, '_blank')
    } catch (e) {
      console.warn('Popup blocked, user can click direct link', e)
    }
  }

  // Void / Undo an invoice or counter receipt
  const handleVoidInvoice = async () => {
    if (!selectedInvoice) return
    const confirmed = window.confirm(
      `Void invoice / receipt ${selectedInvoice.invoiceNumber}?\n\n• The item(s) will be returned to store inventory.\n• The sale will be removed from financial records.`
    )
    if (!confirmed) return

    setIsVoidingInvoice(true)
    try {
      let res = await fetch(`/api/invoices/${selectedInvoice._id}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status === 404) {
        // Fallback for standalone counter sale activity
        res = await fetch(`/api/activities/${selectedInvoice._id}`, {
          method: 'DELETE',
        })
      }

      if (res.ok) {
        alert(`✓ Transaction ${selectedInvoice.invoiceNumber} voided and stock restored.`)
        setSelectedInvoice(null)
        fetchInvoices()
        fetchFinanceAnalytics(selectedRange)
        fetchAllColorways()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to void transaction')
      }
    } catch (err) {
      console.error('Failed to void transaction:', err)
      alert('Network error while voiding transaction.')
    } finally {
      setIsVoidingInvoice(false)
    }
  }

  // Invoice calculations
  const invoiceSubtotal = invoiceItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const invoiceCostTotal = invoiceItems.reduce(
    (acc, i) => acc + (i.costPrice !== undefined ? i.costPrice * i.quantity : 0),
    0
  )
  const hasCostData = invoiceItems.some(i => i.costPrice !== undefined)

  // Filter colorways in Price Manager
  const filteredColorways = allColorways.filter(cw =>
    cw.fullCode.toLowerCase().includes(searchFilter.toLowerCase())
  )

  return (
    <>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Back
          </button>
          <div>
            <h1 className="appbar__title">Finance & Invoices</h1>
            <p className="appbar__subtitle">Mandera African Wear</p>
          </div>
        </div>

        <div className="appbar__right">
          <ExpandingSearchDock placeholder="Search fabrics, codes, invoices..." />
        </div>
      </header>

      <Sidebar
        activeCategory="Finance"
        onCategoryChange={(cat) => router.push(`/classify?category=${cat}`)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="main-content" style={{ padding: 'var(--space-md)' }}>
        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '4px 0 16px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--color-border, #e5e7eb)',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('invoice')}
            className={`btn ${activeTab === 'invoice' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600 }}
            type="button"
          >
            🧾 Create Receipt / Bill
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`btn ${activeTab === 'analytics' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600 }}
            type="button"
          >
            📊 Sales & Profit Reports
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`btn ${activeTab === 'prices' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600 }}
            type="button"
          >
            🏷️ Set Fabric Prices
          </button>
        </div>

        <div style={{ maxWidth: '1200px' }}>
          {/* ========================================================================= */}
          {/* TAB 1: CREATE RECEIPT / BILL */}
          {/* ========================================================================= */}
          {activeTab === 'invoice' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* Left Column: Build Receipt */}
              <div
                style={{
                  background: 'var(--color-surface, #ffffff)',
                  padding: '18px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Auto-Suggested Most Recent Sale Card */}
                {latestSale && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #FDF9F3 0%, #FFFFFF 100%)',
                      border: '1.5px solid #D4AF37',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      boxShadow: '0 2px 8px rgba(74, 16, 50, 0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            background: '#4A1032',
                            color: '#FAF6EB',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          ⭐ Just Sold in Shop
                        </span>
                        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>
                          {formatFriendlyTime(latestSale.timestamp).label}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
                        {latestSale.fullCode}
                        {latestSale.subVariantLabel ? ` (${latestSale.subVariantLabel})` : ''}
                        <span style={{ marginLeft: '8px', color: '#059669', fontWeight: 700 }}>
                          {latestSale.soldPrice ? `KES ${latestSale.soldPrice.toLocaleString()}` : 'Price not recorded'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 400, marginLeft: '6px' }}>
                          ({latestSale.quantity} pc{latestSale.quantity > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px', fontWeight: 500 }}>
                        ✓ Already deducted from shelves when you clicked minus (−)
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleAddRecentSaleToDraft(latestSale)}
                        disabled={invoiceItems.some(i => i.recentSaleActivityId === latestSale.id)}
                        style={{
                          background: invoiceItems.some(i => i.recentSaleActivityId === latestSale.id) ? '#F3F4F6' : '#4A1032',
                          color: invoiceItems.some(i => i.recentSaleActivityId === latestSale.id) ? '#9CA3AF' : '#FAF6EB',
                          border: '1px solid #D4AF37',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: invoiceItems.some(i => i.recentSaleActivityId === latestSale.id) ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {invoiceItems.some(i => i.recentSaleActivityId === latestSale.id) ? '✓ In this Receipt' : '+ Add to Receipt'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReceiptForSale(latestSale)}
                        style={{
                          background: '#25D366',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        💬 WhatsApp
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: '#166534', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>💡</span>
                  <div>
                    <strong>Tapped minus (−) on a fabric in the shop?</strong>
                    <div style={{ marginTop: '2px', color: '#15803d' }}>
                      That fabric was already deducted from your shelves! Tap <strong>&quot;+ Add to Receipt&quot;</strong> on it to generate a customer bill without double-deducting.
                    </div>
                  </div>
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>
                  Customer Details (Optional)
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      Customer Name
                    </label>
                    <input
                      type="text"
                      className="form-group__input"
                      placeholder="e.g. Halima Ahmed"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      Phone / WhatsApp
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        padding: '0 8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', marginRight: '6px' }}>
                        🇰🇪 +254
                      </span>
                      <input
                        type="tel"
                        placeholder="e.g. 0725 996 394"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        style={{
                          border: 'none',
                          outline: 'none',
                          width: '100%',
                          padding: '8px 0',
                          fontSize: '13px',
                          color: '#111827',
                        }}
                      />
                    </div>
                    {customerPhone.trim() && (
                      <div style={{ marginTop: '3px', fontSize: '11px' }}>
                        {isValidKenyanPhone(customerPhone) ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            ✓ {formatKenyanPhoneDisplay(customerPhone)}
                          </span>
                        ) : (
                          <span style={{ color: '#d97706' }}>
                            Type 9-10 digits (e.g. 0725996394)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>
                    Payment Method
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {[
                      { key: 'cash', label: 'Cash 💵', color: '#059669' },
                      { key: 'mpesa', label: 'M-Pesa 📱', color: '#10B981' },
                      { key: 'credit', label: 'Credit 💳', color: '#8B5CF6' },
                    ].map(pm => {
                      const isSelected = paymentMethod === pm.key
                      return (
                        <button
                          key={pm.key}
                          type="button"
                          onClick={() => setPaymentMethod(pm.key as 'cash' | 'mpesa' | 'credit')}
                          style={{
                            padding: '9px 8px',
                            borderRadius: '8px',
                            border: isSelected ? `2px solid ${pm.color}` : '1px solid #e5e7eb',
                            background: isSelected ? '#FAF8F5' : '#ffffff',
                            color: isSelected ? '#4A1032' : '#4B5563',
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          }}
                        >
                          {pm.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '20px 0 10px', borderTop: '1px solid #e5e7eb', paddingTop: '14px' }}>
                  Invoice Items ({invoiceItems.length})
                </h2>

                {invoiceItems.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px dashed #d1d5db',
                      color: '#6b7280',
                      fontSize: '13px',
                    }}
                  >
                    Select fabrics from the available stock panel on the right to add them to this invoice.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {invoiceItems.map((item, idx) => {
                      const isBelowCost = item.costPrice !== undefined && item.unitPrice < item.costPrice
                      return (
                        <div
                          key={item.colorwayId}
                          style={{
                            padding: '10px',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            border: `1px solid ${isBelowCost ? '#fca5a5' : '#e5e7eb'}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ fontSize: '13px' }}>{item.fullCode}</strong>
                              {item.skipDeduction ? (
                                <span style={{ fontSize: '10px', background: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  ✓ Recent Shop Sale (Already Deducted)
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#1E40AF', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  📦 From Shelves (Deducts on Save)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '8px', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>Qty (Max {item.available})</span>
                              <input
                                type="number"
                                className="form-group__input"
                                min="1"
                                max={item.available}
                                value={item.quantity}
                                onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>Agreed Price (KES)</span>
                              <input
                                type="number"
                                className="form-group__input"
                                min="0"
                                value={item.unitPrice}
                                onChange={e => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>Subtotal</span>
                              <strong style={{ fontSize: '13px' }}>
                                KES {(item.unitPrice * item.quantity).toLocaleString()}
                              </strong>
                            </div>
                          </div>

                          {isBelowCost && (
                            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
                              ⚠️ Below Cost! Buying price is KES {item.costPrice?.toLocaleString()}. Loss of KES {((item.costPrice! - item.unitPrice) * item.quantity).toLocaleString()}.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Total Summary */}
                <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span>Total Amount:</span>
                    <strong style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                      KES {invoiceSubtotal.toLocaleString()}
                    </strong>
                  </div>
                  {hasCostData && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4b5563' }}>
                      <span>Estimated Gross Profit:</span>
                      <strong style={{ color: invoiceSubtotal >= invoiceCostTotal ? '#059669' : '#dc2626' }}>
                        KES {(invoiceSubtotal - invoiceCostTotal).toLocaleString()}
                      </strong>
                    </div>
                  )}
                </div>

                {invoiceSuccessMsg && (
                  <div style={{ padding: '10px', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                    ✓ {invoiceSuccessMsg}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={invoiceItems.length === 0 || isCreatingInvoice}
                  className="btn btn--primary"
                  style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}
                >
                  {isCreatingInvoice ? 'Saving Receipt & Updating Stock...' : 'Save Receipt & Print Slip'}
                </button>
              </div>

              {/* Right Column: Quick Inventory Picker & Recent Invoices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Stock Picker */}
                <div
                  style={{
                    background: 'var(--color-surface, #ffffff)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    maxHeight: '520px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Panel Mode Switcher */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('recentSales')}
                      style={{
                        flex: 1.2,
                        padding: '8px 6px',
                        fontSize: '11px',
                        fontWeight: rightPanelTab === 'recentSales' ? 700 : 500,
                        background: rightPanelTab === 'recentSales' ? '#059669' : '#f3f4f6',
                        color: rightPanelTab === 'recentSales' ? '#ffffff' : '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ Recent Shop Sales ({sortedRecentSales.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('stock')}
                      style={{
                        flex: 1,
                        padding: '8px 6px',
                        fontSize: '11px',
                        fontWeight: rightPanelTab === 'stock' ? 700 : 500,
                        background: rightPanelTab === 'stock' ? 'var(--color-primary)' : '#f3f4f6',
                        color: rightPanelTab === 'stock' ? '#ffffff' : '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      📦 Pick from Shelves ({allColorways.filter(c => c.quantityAvailable > 0).length})
                    </button>
                  </div>

                  {rightPanelTab === 'recentSales' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 10px' }}>
                        Already deducted in shop. Click <strong>+ Add</strong> to bundle into this receipt, or <strong>Receipt</strong> to send slip:
                      </p>
                      {sortedRecentSales.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '30px 10px' }}>
                          No recent shop sales recorded yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sortedRecentSales.slice(0, 40).map((sale, idx) => {
                            const timeInfo = formatFriendlyTime(sale.timestamp)
                            const isAdded = invoiceItems.some(i => i.recentSaleActivityId === sale.id)
                            return (
                              <div
                                key={sale.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: idx === 0 ? '#FDFBF7' : '#f9fafb',
                                  fontSize: '12px',
                                  border: idx === 0 ? '1.5px solid #D4AF37' : '1px solid #f3f4f6',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <strong>{sale.fullCode}</strong>
                                    {idx === 0 && (
                                      <span style={{ fontSize: '9px', fontWeight: 800, background: '#4A1032', color: '#FAF6EB', padding: '1px 5px', borderRadius: '4px' }}>
                                        ⭐ Latest
                                      </span>
                                    )}
                                    <span style={{ fontSize: '10px', color: '#166534', background: '#dcfce7', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                      ✓ −{sale.quantity} pc
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                    <span style={{ fontWeight: 600, color: '#374151' }}>
                                      {sale.soldPrice !== undefined ? `KES ${sale.soldPrice.toLocaleString()}` : 'Price unrecorded'}
                                    </span>{' '}
                                    • {timeInfo.label}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleAddRecentSaleToDraft(sale)}
                                    disabled={isAdded}
                                    style={{
                                      background: isAdded ? '#F3F4F6' : '#FAF6EB',
                                      color: isAdded ? '#9CA3AF' : '#4A1032',
                                      border: '1px solid #D4AF37',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: isAdded ? 'default' : 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isAdded ? '✓ Added' : '+ Add'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceiptForSale(sale)}
                                    style={{
                                      background: '#059669',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '5px 9px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    🧾 Receipt
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Select Fabric Stock</h4>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>Deducts stock on confirm</span>
                      </div>

                      <input
                        type="text"
                        className="form-group__input"
                        placeholder="Search fabric code..."
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        style={{ marginBottom: '10px' }}
                      />

                      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {isLoadingInventory ? (
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>Loading stock...</p>
                        ) : (
                          filteredColorways
                            .filter(c => c.quantityAvailable > 0)
                            .slice(0, 50)
                            .map(cw => (
                              <div
                                key={cw._id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  background: '#f9fafb',
                                  fontSize: '12px',
                                  border: '1px solid #f3f4f6',
                                }}
                              >
                                <div>
                                  <strong>{cw.fullCode}</strong>
                                  <span style={{ color: '#6b7280', marginLeft: '6px' }}>({cw.quantityAvailable} avail)</span>
                                  {cw.sellingPrice && (
                                    <span style={{ marginLeft: '6px', color: '#059669', fontWeight: 600 }}>
                                      KES {cw.sellingPrice.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddItemToInvoice(cw)}
                                  style={{
                                    background: 'var(--color-primary)',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  + Add
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Recent Invoices List */}
                <div
                  style={{
                    background: 'var(--color-surface, #ffffff)',
                    padding: '18px',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border, #e5e7eb)',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px' }}>
                    Recent Invoices ({invoices.length})
                  </h3>
                  {isLoadingInvoices ? (
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Loading invoices...</p>
                  ) : invoices.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>No invoices created yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {invoices.slice(0, 5).map(inv => (
                        <div
                          key={inv._id}
                          onClick={() => setSelectedInvoice(inv)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: '#f9fafb',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <strong>{inv.invoiceNumber}</strong>
                            <span style={{ color: '#6b7280', marginLeft: '6px' }}>
                              {inv.customerName || 'Walk-in'} • {new Date(inv.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <strong>KES {inv.totalAmount.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SALES & PROFIT REPORTS */}
          {/* ========================================================================= */}
          {activeTab === 'analytics' && (
            <div>
              {/* Range Filters */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'year', label: 'This Year' },
                  { key: 'all', label: 'All Time' },
                ].map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelectedRange(r.key)}
                    className={`btn ${selectedRange === r.key ? 'btn--primary' : 'btn--secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Total Sales Revenue</span>
                  <strong style={{ fontSize: '22px', color: '#111827' }}>
                    KES {(financeData?.summary.totalRevenue || 0).toLocaleString()}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#059669', display: 'block', marginTop: '4px' }}>
                    {financeData?.summary.pricedPiecesSold || 0} pieces with recorded price
                  </span>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Estimated Gross Profit</span>
                  <strong style={{ fontSize: '22px', color: '#059669' }}>
                    KES {(financeData?.summary.estimatedProfit || 0).toLocaleString()}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginTop: '4px' }}>
                    Wholesale Cost: KES {(financeData?.summary.totalCost || 0).toLocaleString()}
                  </span>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Total Fabrics Sold</span>
                  <strong style={{ fontSize: '22px', color: '#111827' }}>
                    {financeData?.summary.totalPiecesSold || 0} pcs
                  </strong>
                  <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginTop: '4px' }}>
                    {financeData?.summary.unpricedPiecesSold || 0} pcs sold without price
                  </span>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Pricing Coverage</span>
                  <strong style={{ fontSize: '22px', color: '#2563eb' }}>
                    {financeData?.coverage.coveragePercent || 0}%
                  </strong>
                  <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginTop: '4px' }}>
                    {financeData?.coverage.pricedColorways || 0} of {financeData?.coverage.totalColorways || 0} fabrics priced
                  </span>
                </div>
              </div>

              {/* Recent Sales History */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Sales History & Profits</h3>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>
                      All fabrics sold in your shop, listed from newest to oldest
                    </p>
                  </div>
                  {isLoadingAnalytics && <span style={{ fontSize: '12px', color: '#6b7280' }}>Refreshing...</span>}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                        <th style={{ padding: '10px 14px' }}>Sold Time</th>
                        <th style={{ padding: '10px 14px' }}>Fabric Code</th>
                        <th style={{ padding: '10px 14px' }}>Quantity</th>
                        <th style={{ padding: '10px 14px' }}>Agreed Sold Price</th>
                        <th style={{ padding: '10px 14px' }}>Buying Cost</th>
                        <th style={{ padding: '10px 14px' }}>Estimated Profit</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRecentSales.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                            No sales recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        sortedRecentSales.map((sale, idx) => {
                          const timeInfo = formatFriendlyTime(sale.timestamp)
                          return (
                            <tr key={sale.id} style={{ borderBottom: '1px solid #f3f4f6', background: idx === 0 ? '#FDFBF7' : 'transparent' }}>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong style={{ color: '#111827', fontSize: '12px' }}>{timeInfo.label}</strong>
                                  {idx === 0 && (
                                    <span style={{ fontSize: '9px', fontWeight: 800, background: '#4A1032', color: '#FAF6EB', padding: '1px 5px', borderRadius: '4px' }}>
                                      ⭐ Latest
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                  {new Date(sale.timestamp).toLocaleDateString()}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                                {sale.fullCode}
                                {sale.subVariantLabel && (
                                  <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>
                                    ({sale.subVariantLabel})
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px' }}>{sale.quantity} pc{sale.quantity > 1 ? 's' : ''}</td>
                              <td style={{ padding: '10px 14px' }}>
                                {sale.soldPrice !== undefined ? (
                                  <span style={{ color: sale.isLoss ? '#dc2626' : '#111827', fontWeight: 600 }}>
                                    KES {sale.soldPrice.toLocaleString()}
                                    {sale.isLoss && <span style={{ fontSize: '10px', marginLeft: '4px' }}>⚠️ (Below Cost)</span>}
                                  </span>
                                ) : (
                                  <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unrecorded</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                                {sale.costPrice !== undefined ? `KES ${sale.costPrice.toLocaleString()}` : '—'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {sale.itemProfit !== undefined ? (
                                  <span style={{ color: sale.itemProfit >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                    {sale.itemProfit >= 0 ? '+' : ''}KES {sale.itemProfit.toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ color: '#9ca3af' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceiptForSale(sale)}
                                    title="Print paper slip or send WhatsApp receipt to customer"
                                    style={{
                                      background: '#ecfdf5',
                                      color: '#065f46',
                                      border: '1px solid #a7f3d0',
                                      padding: '5px 9px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    🧾 Receipt
                                  </button>
                                  <button
                                    type="button"
                                    disabled={voidingSaleId === sale.id}
                                    onClick={() => handleVoidSale(sale)}
                                    title="Undo this sale and return the fabric back to shelves"
                                    style={{
                                      background: '#fee2e2',
                                      color: '#b91c1c',
                                      border: '1px solid #fecaca',
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {voidingSaleId === sale.id ? 'Returning...' : '↩️ Return to Shelf'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PRICE MANAGER (CRUD) */}
          {/* ========================================================================= */}
          {activeTab === 'prices' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Fabric Price Manager (CRUD)</h2>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                    Set, update, or remove prices for any fabric. Blank prices mean the item remains purely quantity-tracked.
                  </p>
                </div>

                <input
                  type="text"
                  className="form-group__input"
                  placeholder="Filter by fabric code..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  style={{ maxWidth: '240px' }}
                />
              </div>

              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                        <th style={{ padding: '10px 14px' }}>Fabric Code</th>
                        <th style={{ padding: '10px 14px' }}>Stock</th>
                        <th style={{ padding: '10px 14px' }}>Buying Price (Cost)</th>
                        <th style={{ padding: '10px 14px' }}>Selling Price (Retail)</th>
                        <th style={{ padding: '10px 14px' }}>Expected Profit</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredColorways.map(cw => {
                        const hasBuying = cw.buyingPrice !== undefined
                        const hasSelling = cw.sellingPrice !== undefined
                        const profit = hasBuying && hasSelling ? cw.sellingPrice! - cw.buyingPrice! : undefined
                        const marginPercent = hasBuying && hasSelling && cw.buyingPrice! > 0
                          ? ((profit! / cw.buyingPrice!) * 100).toFixed(1)
                          : undefined

                        return (
                          <tr key={cw._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{cw.fullCode}</td>
                            <td style={{ padding: '10px 14px' }}>{cw.quantityAvailable} pcs</td>
                            <td style={{ padding: '10px 14px', color: hasBuying ? '#111827' : '#9ca3af' }}>
                              {hasBuying ? `KES ${cw.buyingPrice?.toLocaleString()}` : 'Not set'}
                            </td>
                            <td style={{ padding: '10px 14px', color: hasSelling ? '#111827' : '#9ca3af' }}>
                              {hasSelling ? `KES ${cw.sellingPrice?.toLocaleString()}` : 'Not set'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {profit !== undefined ? (
                                <span style={{ color: profit >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                  {profit >= 0 ? '+' : ''}KES {profit.toLocaleString()} ({marginPercent}%)
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPriceCw(cw)
                                  setEditBuyingPrice(cw.buyingPrice !== undefined ? cw.buyingPrice.toString() : '')
                                  setEditSellingPrice(cw.sellingPrice !== undefined ? cw.sellingPrice.toString() : '')
                                }}
                                style={{
                                  background: 'var(--color-primary)',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                {hasBuying || hasSelling ? 'Edit Price' : '+ Add Price'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Quick Edit/Delete Price Modal */}
      {editingPriceCw && (
        <div className="modal-overlay" onClick={() => setEditingPriceCw(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h3 className="modal__title" style={{ fontSize: '16px' }}>
                Pricing: {editingPriceCw.fullCode}
              </h3>
              <button className="modal__close-btn" onClick={() => setEditingPriceCw(null)} type="button">
                ✕
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Buying Price / Cost (KES)
                </label>
                <input
                  type="number"
                  className="form-group__input"
                  placeholder="e.g. 1500 (Leave blank for none)"
                  min="0"
                  value={editBuyingPrice}
                  onChange={e => setEditBuyingPrice(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Selling Price / Retail (KES)
                </label>
                <input
                  type="number"
                  className="form-group__input"
                  placeholder="e.g. 2200 (Leave blank for none)"
                  min="0"
                  value={editSellingPrice}
                  onChange={e => setEditSellingPrice(e.target.value)}
                />
              </div>

              {(editBuyingPrice || editSellingPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditBuyingPrice('')
                    setEditSellingPrice('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textAlign: 'left',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Clear / Remove All Prices
                </button>
              )}
            </div>

            <div className="modal__footer">
              <button
                className="btn btn--secondary"
                onClick={() => setEditingPriceCw(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSavePrice}
                disabled={isSavingPrice}
                type="button"
              >
                {isSavingPrice ? 'Saving...' : 'Save Price'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Boutique Invoice / Receipt Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => handleSelectInvoice(null)} style={{ backdropFilter: 'blur(8px)', background: 'rgba(26, 6, 18, 0.75)' }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '95%',
              padding: 0,
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(91, 26, 62, 0.4), 0 0 0 1px rgba(212, 175, 55, 0.35)',
              background: '#FFFFFF',
              border: 'none',
            }}
          >
            {/* Luxury Plum & Gold Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #4A1032 0%, #6B1D48 100%)',
                color: '#FFFFFF',
                padding: '24px 24px 20px',
                textAlign: 'center',
                position: 'relative',
                borderBottom: '3px solid #D4AF37',
              }}
            >
              <button
                type="button"
                onClick={() => handleSelectInvoice(null)}
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '16px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#FFFFFF',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                ✕
              </button>

              <div style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: '#E6CA65', fontWeight: 700, marginBottom: '4px' }}>
                ⚜ OFFICIAL BOUTIQUE RECEIPT ⚜
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '0.5px', fontFamily: 'serif' }}>
                MANDERA AFRICAN WEAR
              </h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0' }}>
                Authentic African Fabrics & Specialist Prints • Mandera Town
              </p>
            </div>

            {/* Receipt Metadata Ribbon */}
            <div
              style={{
                background: '#FAF8F5',
                padding: '12px 24px',
                borderBottom: '1px solid #EFE8DC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: '#8C7862', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Receipt / Invoice</span>
                <strong style={{ color: '#4A1032', fontSize: '13px', letterSpacing: '0.5px' }}>{selectedInvoice.invoiceNumber}</strong>
              </div>
              <div>
                <span style={{ color: '#8C7862', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Date & Time</span>
                <span style={{ color: '#2D3748', fontWeight: 500 }}>
                  {new Date(selectedInvoice.createdAt).toLocaleDateString()} {new Date(selectedInvoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#8C7862', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Payment</span>
                <span
                  style={{
                    background: '#EDE4D1',
                    color: '#6B4E1B',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedInvoice.paymentMethod || 'CASH'}
                </span>
              </div>
            </div>

            {/* Receipt Body */}
            <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedInvoice.customerName && (
                <div style={{ background: '#FAF8F5', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Customer: <strong style={{ color: '#1A202C' }}>{selectedInvoice.customerName}</strong></span>
                  {selectedInvoice.customerPhone && (
                    <span style={{ color: '#687588' }}>Phone: {selectedInvoice.customerPhone}</span>
                  )}
                </div>
              )}

              {/* Items Table */}
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2D9CC', textAlign: 'left', color: '#718096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '8px 4px' }}>Fabric Item</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F0EAE1' }}>
                      <td style={{ padding: '10px 4px' }}>
                        <div style={{ fontWeight: 700, color: '#1A202C' }}>{item.fullCode}</div>
                        {item.subVariantLabel && (
                          <div style={{ fontSize: '11px', color: '#718096' }}>{item.subVariantLabel}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 600, color: '#4A5568' }}>
                        {item.quantity} pc{item.quantity > 1 ? 's' : ''}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', color: '#4A5568' }}>
                        KES {item.unitPrice.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700, color: '#4A1032' }}>
                        KES {item.subtotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #3D0B28 0%, #5B1A3E 100%)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  color: '#FFFFFF',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(61, 11, 40, 0.25)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#E6CA65', display: 'block', fontWeight: 600 }}>
                    TOTAL AMOUNT
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                    {selectedInvoice.items.reduce((acc, i) => acc + i.quantity, 0)} total fabric pieces
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#FCD34D', letterSpacing: '0.5px' }}>
                  KES {selectedInvoice.totalAmount.toLocaleString()}
                </div>
              </div>

              {/* Interactive WhatsApp Sender Section (Direct Delivery + Fallback Link) */}
              <div
                style={{
                  background: '#F0FDF4',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '14px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>💬</span>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#14532D' }}>
                      Send Receipt via WhatsApp
                    </h4>
                    <span style={{ fontSize: '11px', color: '#166534' }}>
                      Enter customer mobile number to open direct WhatsApp DM
                    </span>
                  </div>
                </div>

                {/* Styled Kenyan Phone Input with Fixed Prefix */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#FFFFFF',
                      border: '1.5px solid #BBF7D0',
                      borderRadius: '8px',
                      padding: '0 10px',
                      flex: 1,
                      overflow: 'hidden',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🇰🇪 +254
                    </span>
                    <input
                      type="tel"
                      placeholder="e.g. 0725 996 394 or 725 996 394"
                      value={modalPhone}
                      onChange={e => setModalPhone(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSendWhatsApp()
                        }
                      }}
                      style={{
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        padding: '10px 0',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1F2937',
                      }}
                    />
                    {modalPhone.trim() && (
                      <button
                        type="button"
                        onClick={() => setModalPhone('')}
                        style={{ border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '14px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    style={{
                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(37, 211, 102, 0.4)',
                    }}
                  >
                    <span>💬 Send WhatsApp</span>
                  </button>
                </div>

                {/* Live Kenyan Phone Helper */}
                <div style={{ marginTop: '8px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isValidKenyanPhone(modalPhone) ? (
                    <span style={{ color: '#15803D', fontWeight: 700 }}>
                      ✓ Ready for {formatKenyanPhoneDisplay(modalPhone)}
                    </span>
                  ) : modalPhone.trim() ? (
                    <span style={{ color: '#B45309' }}>
                      ℹ Type full 9 or 10 digits (e.g. 0725996394)
                    </span>
                  ) : (
                    <span style={{ color: '#6B7280' }}>
                      Type Kenyan number starting with 07, 01, 7, or +254
                    </span>
                  )}
                  <span style={{ color: '#15803D', fontSize: '11px' }}>Press Enter ↵ to send</span>
                </div>

                {/* Instant Fallback Link in case browser pop-up was blocked */}
                {lastWaUrl && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 12px',
                      background: '#DCFCE7',
                      borderRadius: '8px',
                      border: '1px solid #86EFAC',
                      fontSize: '12px',
                      color: '#14532D',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '2px' }}>✓ WhatsApp link ready!</div>
                    <div>
                      If the chat didn&apos;t pop up automatically,{' '}
                      <a
                        href={lastWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#047857', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        👉 Click here to open WhatsApp directly ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: PDF & Print */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => generateInvoicePdf(selectedInvoice)}
                  style={{
                    background: 'linear-gradient(135deg, #5B1A3E 0%, #84235B 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '11px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(91, 26, 62, 0.25)',
                  }}
                >
                  <span>📄 Download PDF Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: '#FAF8F5',
                    color: '#4A1032',
                    border: '1.5px solid #D4AF37',
                    borderRadius: '10px',
                    padding: '11px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🖨️ Print Counter Slip</span>
                </button>
              </div>

              {/* Void Sale / Delete Action */}
              <div style={{ borderTop: '1px solid #F0EAE1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={isVoidingInvoice}
                  onClick={handleVoidInvoice}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#DC2626',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isVoidingInvoice ? 'Voiding transaction...' : '🗑️ Void / Cancel this Sale (Restores Stock)'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectInvoice(null)}
                  style={{
                    background: '#EDE8DF',
                    border: 'none',
                    color: '#4A5568',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
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
