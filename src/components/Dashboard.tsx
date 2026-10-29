'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ViewState } from './Sidebar'

import { ActivityLog } from '@/types'

interface LowStockItem {
  _id: string
  designCodeId: string
  fullCode: string
  quantityAvailable: number
  photos: { url: string }[]
  designCodeThumbnail?: string
  designCodeName: string
}

interface StockDistribution {
  category: string
  totalQuantity: number
}

interface DashboardMetrics {
  totalDesigns: number
  totalStock: number
  activeCategoriesCount: number
  lowStockItems: LowStockItem[]
  stockDistribution: StockDistribution[]
  recentActivities: ActivityLog[]
  insights?: {
    totals: {
      sold: { today: number; week: number; month: number }
      arrived: { today: number; week: number; month: number }
      returned: { month: number }
      ownUse: { month: number }
      countMissing: { month: number }
      countExtra: { month: number }
    }
    bestSellers: { fullCode: string; sold: number }[]
    notSelling: { _id: string; designCodeId: string; fullCode: string; quantityAvailable: number }[]
    notSellingDays: number
  }
}

interface DashboardProps {
  onCategoryChange: (category: ViewState) => void
  onOpenSearch?: () => void
}

export default function Dashboard({ onCategoryChange, onOpenSearch }: DashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showReorderModal, setShowReorderModal] = useState(false)
  const [reorderSelections, setReorderSelections] = useState<{ [id: string]: { selected: boolean; qty: number } }>({})
  const [supplierPhone, setSupplierPhone] = useState('')
  const [copiedOrder, setCopiedOrder] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchMetrics(isBackgroundRefresh = false) {
      try {
        const res = await fetch('/api/dashboard?t=' + new Date().getTime(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (res.ok) {
          const data = await res.json()
          setMetrics(data)
          // Update cache
          sessionStorage.setItem('prefetch_Dashboard', JSON.stringify({ data, ts: Date.now() }))
        }
      } catch (error) {
        console.error('Failed to fetch dashboard metrics:', error)
      } finally {
        if (!isBackgroundRefresh) setIsLoading(false)
      }
    }

    // Stale-while-revalidate: show cached data instantly
    const cached = sessionStorage.getItem('prefetch_Dashboard')
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached)
        const age = Date.now() - ts
        if (age < 60_000) {
          setMetrics(data)
          setIsLoading(false)
          if (age > 15_000) fetchMetrics(true)
          return
        }
      } catch { /* ignore */ }
    }

    fetchMetrics()
  }, [])

  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await fetch(`/api/activities?page=${nextPage}&limit=15&t=${new Date().getTime()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.activities.length < 15) {
          setHasMore(false)
        }
        if (metrics) {
          setMetrics({
            ...metrics,
            recentActivities: [...metrics.recentActivities, ...data.activities]
          })
        }
        setPage(nextPage)
      }
    } catch (error) {
      console.error('Failed to load more activities:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const [dashboardPeriod, setDashboardPeriod] = useState<'today' | 'week' | 'month'>('week')

  // Initialize reorder selections whenever lowStockItems change
  useEffect(() => {
    if (metrics?.lowStockItems) {
      const initial: { [id: string]: { selected: boolean; qty: number } } = {}
      metrics.lowStockItems.forEach(item => {
        initial[item._id] = { selected: true, qty: 10 }
      })
      setReorderSelections(initial)
    }
  }, [metrics?.lowStockItems])

  // Load saved supplier phone
  useEffect(() => {
    const saved = localStorage.getItem('mandera_supplier_phone')
    if (saved) setSupplierPhone(saved)
  }, [])

  const handleToggleItemSelection = (id: string) => {
    setReorderSelections(prev => ({
      ...prev,
      [id]: {
        selected: !prev[id]?.selected,
        qty: prev[id]?.qty || 10,
      },
    }))
  }

  const handleUpdateItemQty = (id: string, qty: number) => {
    setReorderSelections(prev => ({
      ...prev,
      [id]: {
        selected: prev[id]?.selected ?? true,
        qty: Math.max(1, qty),
      },
    }))
  }

  const handleSendReorderWhatsApp = () => {
    const activeItems = (metrics?.lowStockItems || []).filter(item => reorderSelections[item._id]?.selected)
    if (activeItems.length === 0) {
      alert('Please select at least one low-stock fabric to reorder.')
      return
    }

    if (supplierPhone.trim()) {
      localStorage.setItem('mandera_supplier_phone', supplierPhone.trim())
    }

    let phoneClean = supplierPhone.trim().replace(/[^0-9]/g, '')
    if (phoneClean.startsWith('0')) {
      phoneClean = '254' + phoneClean.slice(1)
    } else if ((phoneClean.startsWith('7') || phoneClean.startsWith('1')) && phoneClean.length === 9) {
      phoneClean = '254' + phoneClean
    }

    const itemsText = activeItems
      .map((item, idx) => {
        const qty = reorderSelections[item._id]?.qty || 10
        return `${idx + 1}. *${item.fullCode}* — ${qty} bales (Current shop stock: ${item.quantityAvailable} bales)`
      })
      .join('\n')

    const totalBales = activeItems.reduce((acc, item) => acc + (reorderSelections[item._id]?.qty || 10), 0)

    const message =
`Assalaam Alaykum / Hello, this is *Mandera African Wear* (Mandera Town).

We would like to place a wholesale fabric reorder for our store:

*FABRIC WHOLESALE REORDER LIST:*
${itemsText}

───────────────────
*TOTAL DESIGNS:* ${activeItems.length}
*TOTAL BALES REQUESTED:* ${totalBales} bales
───────────────────

Kindly confirm availability, current bale wholesale prices, and dispatch schedule to Mandera. Thank you!`

    if (phoneClean) {
      const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`
      window.open(waUrl, '_blank')
    } else {
      // Direct WhatsApp share allowing user to pick any contact/supplier from their chat list
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
      try {
        navigator.clipboard.writeText(message)
        setCopiedOrder(true)
        setTimeout(() => setCopiedOrder(false), 3000)
      } catch (e) {
        // clipboard might be blocked in some insecure contexts
      }
      window.open(waUrl, '_blank')
    }
  }

  const handleCopyOrder = () => {
    const activeItems = (metrics?.lowStockItems || []).filter(item => reorderSelections[item._id]?.selected)
    if (activeItems.length === 0) {
      alert('Please select at least one low-stock fabric to reorder.')
      return
    }

    const itemsText = activeItems
      .map((item, idx) => {
        const qty = reorderSelections[item._id]?.qty || 10
        return `${idx + 1}. *${item.fullCode}* — ${qty} bales (Current shop stock: ${item.quantityAvailable} bales)`
      })
      .join('\n')

    const totalBales = activeItems.reduce((acc, item) => acc + (reorderSelections[item._id]?.qty || 10), 0)

    const message =
`Assalaam Alaykum / Hello, this is *Mandera African Wear* (Mandera Town).

We would like to place a wholesale fabric reorder for our store:

*FABRIC WHOLESALE REORDER LIST:*
${itemsText}

───────────────────
*TOTAL DESIGNS:* ${activeItems.length}
*TOTAL BALES REQUESTED:* ${totalBales} bales
───────────────────

Kindly confirm availability, current bale wholesale prices, and dispatch schedule to Mandera. Thank you!`

    navigator.clipboard.writeText(message)
    setCopiedOrder(true)
    setTimeout(() => setCopiedOrder(false), 3000)
  }

  return (
    <div className="dashboard">

      <div className="dashboard__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="main-content__title" style={{ margin: 0 }}>Store Overview</h2>
        
        {/* Calendar Quick Toggle */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            className={`btn btn--sm ${dashboardPeriod === 'today' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setDashboardPeriod('today')}
            style={{ padding: '4px 12px', fontSize: '13px' }}
          >
            Today
          </button>
          <button
            type="button"
            className={`btn btn--sm ${dashboardPeriod === 'week' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setDashboardPeriod('week')}
            style={{ padding: '4px 12px', fontSize: '13px' }}
          >
            This Week
          </button>
          <button
            type="button"
            className={`btn btn--sm ${dashboardPeriod === 'month' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setDashboardPeriod('month')}
            style={{ padding: '4px 12px', fontSize: '13px' }}
          >
            Past 30 Days
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="dashboard__grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dashboard-card skeleton" style={{ height: '140px' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="dashboard__grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Total Stock */}
            <div 
              className="dashboard-card dashboard-card--primary" 
              onClick={() => router.push('/inventory')}
              style={{ cursor: 'pointer' }}
              title="View Current Inventory"
            >
              <div className="dashboard-card__icon" style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Total Bales in Store</span>
                <span className="dashboard-card__value" style={{ color: '#ffffff' }}>
                  {metrics?.totalStock ? metrics.totalStock.toLocaleString() : 0}
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
                  View Full Inventory →
                </span>
              </div>
            </div>

            {/* Sold Stats (Bales only, no money) */}
            <div className="dashboard-card" style={{ borderLeft: '5px solid #16a34a' }}>
              <div className="dashboard-card__icon" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                  <path d="M3 6h18"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label" style={{ color: '#15803d' }}>
                  Bales Sold ({dashboardPeriod === 'today' ? 'Today' : dashboardPeriod === 'week' ? 'This Week' : 'Past 30 Days'})
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                  <span className="dashboard-card__value" style={{ color: '#16a34a' }}>
                    {dashboardPeriod === 'today'
                      ? metrics?.insights?.totals.sold.today ?? 0
                      : dashboardPeriod === 'week'
                      ? metrics?.insights?.totals.sold.week ?? 0
                      : metrics?.insights?.totals.sold.month ?? 0}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    bales
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                  <span>{metrics?.insights?.totals.sold.month ?? 0} bales sold in 30 days</span>
                  <span style={{ color: '#92400e', fontWeight: 600 }}>{metrics?.insights?.totals.returned.month ?? 0} returns</span>
                </div>
              </div>
            </div>

            {/* Arrived & Restocked */}
            <div className="dashboard-card" style={{ borderLeft: '5px solid #2563eb' }}>
              <div className="dashboard-card__icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m7.5 4.27 9 5.15"/>
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                  <path d="m3.3 7 8.7 5 8.7-5"/>
                  <path d="M12 22V12"/>
                </svg>
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label" style={{ color: '#1d4ed8' }}>
                  Bales Arrived ({dashboardPeriod === 'today' ? 'Today' : dashboardPeriod === 'week' ? 'This Week' : 'Past 30 Days'})
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                  <span className="dashboard-card__value" style={{ color: '#2563eb' }}>
                    +{dashboardPeriod === 'today'
                      ? metrics?.insights?.totals.arrived.today ?? 0
                      : dashboardPeriod === 'week'
                      ? metrics?.insights?.totals.arrived.week ?? 0
                      : metrics?.insights?.totals.arrived.month ?? 0}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    bales
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                  <span>+{metrics?.insights?.totals.arrived.month ?? 0} bales arrived in 30 days</span>
                  <span style={{ color: '#6b7280' }}>{metrics?.insights?.totals.ownUse.month ?? 0} own use</span>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 2: Actionable Sections */}
          {metrics && (
            <>
              {/* Best Sellers & Not Selling Insights */}
              <div className="dashboard__sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '24px' }}>
                {/* Best Sellers */}
                <section className="dashboard-section" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 className="dashboard-section__title" style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                      </svg>
                      Top Selling Fabrics
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Past 30 Days</span>
                  </div>
                  {(!metrics.insights?.bestSellers || metrics.insights.bestSellers.length === 0) ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No sales recorded yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {metrics.insights.bestSellers.map((item, idx) => (
                        <div key={item.fullCode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: idx === 0 ? '#fef08a' : idx === 1 ? '#e2e8f0' : '#ffedd5', color: '#854d0e', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {idx + 1}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '15px' }}>{item.fullCode}</span>
                          </div>
                          <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '15px', background: 'rgba(34, 197, 94, 0.1)', padding: '3px 10px', borderRadius: '999px' }}>
                            {item.sold} sold
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Not Selling / Dead Stock */}
                <section className="dashboard-section" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 className="dashboard-section__title" style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      Slow-Moving Stock
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>No sales in {metrics.insights?.notSellingDays || 60}d</span>
                  </div>
                  {(!metrics.insights?.notSelling || metrics.insights.notSelling.length === 0) ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>All stocked items have recent movement.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {metrics.insights.notSelling.map(item => (
                        <div
                          key={item._id}
                          onClick={() => router.push(`/classify/${item.designCodeId}`)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                          title="Click to view card"
                        >
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>{item.fullCode}</span>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                            {item.quantityAvailable} in store →
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Low Stock & Wholesale Reorder Card */}
                <section className="dashboard-section" style={{ boxShadow: 'var(--shadow-sm)', borderTop: '3px solid #ef4444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <h3 className="dashboard-section__title" style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🚨 Low Stock Fabrics
                      </h3>
                      <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                        {metrics.lowStockItems.length} design{metrics.lowStockItems.length === 1 ? '' : 's'} running out
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowReorderModal(true)}
                      className="btn"
                      style={{
                        background: '#128C7E',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(18, 140, 126, 0.25)',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.058.376-.058c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.939l-1.564 5.889 6.088-1.597c1.706.929 3.659 1.469 5.735 1.469 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span>Reorder via WA</span>
                    </button>
                  </div>

                  {metrics.lowStockItems.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>All fabric lines are well-stocked.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {metrics.lowStockItems.slice(0, 5).map(item => (
                        <div
                          key={item._id}
                          onClick={() => router.push(`/classify/${item.designCodeId}`)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: item.quantityAvailable === 0 ? '#fef2f2' : 'var(--color-bg)',
                            border: `1px solid ${item.quantityAvailable === 0 ? '#fecaca' : 'var(--color-border-light)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                          }}
                          title="Click to view card"
                        >
                          <span style={{ fontWeight: 700, fontSize: '14px', color: item.quantityAvailable === 0 ? '#b91c1c' : 'inherit' }}>
                            {item.fullCode}
                          </span>
                          <span style={{
                            color: item.quantityAvailable === 0 ? '#b91c1c' : '#d97706',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: item.quantityAvailable === 0 ? '#fee2e2' : '#fef3c7',
                            padding: '2px 8px',
                            borderRadius: '999px',
                          }}>
                            {item.quantityAvailable === 0 ? 'OUT OF STOCK' : `${item.quantityAvailable} left`}
                          </span>
                        </div>
                      ))}

                      {metrics.lowStockItems.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowReorderModal(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'center',
                            padding: '4px 0',
                            textDecoration: 'underline',
                          }}
                        >
                          + View all {metrics.lowStockItems.length} low stock & create supplier order
                        </button>
                      )}
                    </div>
                  )}
                </section>
              </div>
              <div className="dashboard__sections">              {/* Stock Distribution */}
              <section className="dashboard-section">
                <h3 className="dashboard-section__title" style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                  Stock Distribution
                </h3>
                
                <div className="distribution-list">
                  {['PrintedC', 'PrintedP', 'PrintTC'].map(cat => {
                    const dist = metrics.stockDistribution.find(d => d.category === cat) || { category: cat, totalQuantity: 0 }
                    return (
                      <div 
                        key={cat} 
                        className="distribution-item"
                        onClick={() => onCategoryChange(cat as ViewState)}
                      >
                        <div className="distribution-item__label">{cat}</div>
                        <div className="distribution-item__bar-container">
                          <div 
                            className="distribution-item__bar" 
                            style={{ width: metrics.totalStock === 0 ? '0%' : `${Math.max(2, (dist.totalQuantity / metrics.totalStock) * 100)}%` }} 
                          />
                        </div>
                        <div className="distribution-item__value">{dist.totalQuantity} items</div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            {/* Phase 3: Activity Log */}
            <div className="dashboard__sections" style={{ marginTop: 'var(--space-xl)' }}>
              <section className="dashboard-section" style={{ width: '100%' }}>
                <h3 className="dashboard-section__title" style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  Recent Transactions
                </h3>

                {metrics.recentActivities.length === 0 ? (
                  <div className="empty-state empty-state--sm">
                    <p>No recent stock changes.</p>
                  </div>
                ) : (
                  <div className="activity-list">
                    {metrics.recentActivities.map(activity => (
                      <div 
                        key={activity._id} 
                        className="activity-item"
                        onClick={() => router.push(`/classify/${activity.designCodeId}`)}
                      >
                        <div className={`activity-item__icon activity-item__icon--${activity.type.toLowerCase()}`}>
                          {activity.type === 'IN' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                          ) : activity.type === 'OUT' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                          )}
                        </div>
                        <div className="activity-item__details">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                            <span className="activity-item__action" style={{
                              color: activity.type === 'IN' ? '#15803d' : activity.type === 'OUT' ? '#b91c1c' : '#1d4ed8',
                              fontWeight: 700,
                            }}>
                              {activity.kind === 'sold'
                                ? '🛍️ Sold'
                                : activity.kind === 'own_use'
                                ? '👤 Own/Shop Use'
                                : activity.kind === 'arrived'
                                ? '📦 Stock Arrived'
                                : activity.kind === 'returned'
                                ? '↩️ Customer Return'
                                : activity.kind === 'count_diff'
                                ? '⚖️ Count Adjustment'
                                : activity.type === 'IN'
                                ? 'Stock Added'
                                : activity.type === 'OUT'
                                ? 'Stock Removed'
                                : 'New Item Created'}
                            </span>
                            {activity.edited && (
                              <span style={{ fontSize: '10px', background: 'rgba(91, 26, 62, 0.1)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                corrected
                              </span>
                            )}
                          </div>
                          <div className="activity-item__context">
                            <strong style={{ fontSize: '15px' }}>{activity.quantityChange} {Math.abs(activity.quantityChange) === 1 ? 'bale' : 'bales'}</strong> of <strong style={{ color: 'var(--color-primary)' }}>{activity.fullCode}</strong>
                            {activity.subVariantLabel && (
                              <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px', fontSize: '13px' }}>
                                (Variant: {activity.subVariantLabel})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="activity-item__meta">
                          <span className="activity-item__time">
                            {new Date(activity.timestamp).toLocaleDateString(undefined, {
                              weekday: 'short', month: 'short', day: 'numeric'
                            })}
                          </span>
                          <span className="activity-item__time-sub">
                            {new Date(activity.timestamp).toLocaleTimeString(undefined, {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <span className="activity-item__qty-change">
                            {activity.previousQuantity} → <strong>{activity.newQuantity}</strong> in store
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {hasMore && metrics.recentActivities.length >= 15 && (
                      <button 
                        onClick={handleLoadMore} 
                        disabled={isLoadingMore}
                        className="btn btn--secondary"
                        style={{ width: '100%', marginTop: '16px' }}
                      >
                        {isLoadingMore ? 'Loading...' : 'Load More Transactions'}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>
            </>
          )}
        </>
      )}

      {/* 1-Click Wholesale Supplier Reorder Modal */}
      {showReorderModal && (
        <div className="modal-overlay" onClick={() => setShowReorderModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal__header">
              <div>
                <h3 className="modal__title" style={{ fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📦 Wholesale Supplier Reorder List</span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                  Select low-stock fabrics & generate a 1-tap WhatsApp purchase order for Nairobi or Dubai agents.
                </p>
              </div>
              <button className="modal__close-btn" onClick={() => setShowReorderModal(false)} type="button">
                ✕
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Supplier Contact */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Supplier / Agent WhatsApp Number:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    className="form-group__input"
                    placeholder="e.g. 0712 345 678 (Nairobi) or 97150... (Dubai)"
                    value={supplierPhone}
                    onChange={e => setSupplierPhone(e.target.value)}
                    style={{ fontSize: '13px', padding: '8px 12px' }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Saved automatically for future reorders
                </span>
              </div>

              {/* Items List */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>
                    Low Stock Fabrics ({metrics?.lowStockItems.length || 0})
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Edit quantity per design below
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {(metrics?.lowStockItems || []).map(item => {
                    const sel = reorderSelections[item._id] || { selected: true, qty: 10 }
                    return (
                      <div
                        key={item._id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1.8fr 1fr 1fr',
                          gap: '10px',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${sel.selected ? '#bbf7d0' : '#e2e8f0'}`,
                          background: sel.selected ? '#f0fdf4' : '#ffffff',
                          fontSize: '12px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={sel.selected}
                          onChange={() => handleToggleItemSelection(item._id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />

                        <div>
                          <strong style={{ fontSize: '13px', color: '#1e293b' }}>{item.fullCode}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                            {item.designCodeName}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>In Store</span>
                          <span style={{
                            fontWeight: 700,
                            color: item.quantityAvailable === 0 ? '#dc2626' : '#d97706',
                          }}>
                            {item.quantityAvailable} {item.quantityAvailable === 1 ? 'bale' : 'bales'}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Reorder Bales</span>
                          <input
                            type="number"
                            min="1"
                            disabled={!sel.selected}
                            value={sel.qty}
                            onChange={e => handleUpdateItemQty(item._id, parseInt(e.target.value) || 1)}
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              fontSize: '12px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', width: '100%' }}>
                <button
                  type="button"
                  onClick={handleSendReorderWhatsApp}
                  style={{
                    background: '#128C7E',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(18, 140, 126, 0.25)',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.058.376-.058c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.939l-1.564 5.889 6.088-1.597c1.706.929 3.659 1.469 5.735 1.469 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>Send Order via WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyOrder}
                  className="btn btn--secondary"
                  style={{
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                  <span>{copiedOrder ? 'Copied to Clipboard!' : 'Copy Order Text'}</span>
                </button>
              </div>

              <div style={{ textAlign: 'right', width: '100%', paddingTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowReorderModal(false)}
                  style={{ fontSize: '12px', padding: '6px 16px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
