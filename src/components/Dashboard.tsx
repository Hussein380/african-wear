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
                <span className="dashboard-card__label">Total Stock in Store</span>
                <span className="dashboard-card__value" style={{ color: '#ffffff' }}>
                  {metrics?.totalStock ? metrics.totalStock.toLocaleString() : 0}
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
                  View Full Inventory →
                </span>
              </div>
            </div>

            {/* Sold Stats (Pieces only, no money) */}
            <div className="dashboard-card" style={{ borderLeft: '5px solid #16a34a' }}>
              <div className="dashboard-card__icon" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                🛍️
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label" style={{ color: '#15803d' }}>
                  Pieces Sold ({dashboardPeriod === 'today' ? 'Today' : dashboardPeriod === 'week' ? 'This Week' : 'Past 30 Days'})
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
                    pcs
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                  <span>{metrics?.insights?.totals.sold.month ?? 0} sold in 30 days</span>
                  <span style={{ color: '#92400e', fontWeight: 600 }}>{metrics?.insights?.totals.returned.month ?? 0} returns</span>
                </div>
              </div>
            </div>

            {/* Arrived & Restocked */}
            <div className="dashboard-card" style={{ borderLeft: '5px solid #2563eb' }}>
              <div className="dashboard-card__icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                📦
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label" style={{ color: '#1d4ed8' }}>
                  Stock Arrived ({dashboardPeriod === 'today' ? 'Today' : dashboardPeriod === 'week' ? 'This Week' : 'Past 30 Days'})
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
                    pcs
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                  <span>+{metrics?.insights?.totals.arrived.month ?? 0} arrived in 30 days</span>
                  <span style={{ color: '#6b7280' }}>{metrics?.insights?.totals.ownUse.month ?? 0} own use</span>
                </div>
              </div>
            </div>

            {/* Finance & Invoices (Hybrid Link) */}
            <div 
              className="dashboard-card" 
              style={{ borderLeft: '5px solid #8b5cf6', cursor: 'pointer' }}
              onClick={() => router.push('/finance')}
              title="Open Finance & Invoices"
            >
              <div className="dashboard-card__icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                🧾
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label" style={{ color: '#6d28d9' }}>
                  Finance & Invoices
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#6d28d9' }}>
                    Sales & Invoices
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                  <span>Track receipts & profit</span>
                  <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Manage →</span>
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
                      🔥 Top Selling Fabrics
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
                      ⏳ Slow-Moving Stock
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
                            <strong style={{ fontSize: '15px' }}>{activity.quantityChange} pcs</strong> of <strong style={{ color: 'var(--color-primary)' }}>{activity.fullCode}</strong>
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
    </div>
  )
}
