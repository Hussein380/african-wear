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
}

interface DashboardProps {
  onCategoryChange: (category: ViewState) => void
}

export default function Dashboard({ onCategoryChange }: DashboardProps) {
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

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h2 className="main-content__title">Overview</h2>
      </div>

      {isLoading ? (
        <div className="dashboard__grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dashboard-card skeleton" style={{ height: '140px' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="dashboard__grid">
            <div 
              className="dashboard-card dashboard-card--primary" 
              onClick={() => router.push('/inventory')}
              style={{ cursor: 'pointer' }}
              title="View Current Inventory"
            >
              <div className="dashboard-card__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Total Stock Volume</span>
                <span className="dashboard-card__value">{metrics?.totalStock || 0}</span>
                <span style={{ fontSize: '12px', color: 'white', fontWeight: 600, marginTop: 'auto' }}>View Current Inventory →</span>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Total Design Codes</span>
                <span className="dashboard-card__value">{metrics?.totalDesigns || 0}</span>
              </div>
            </div>
          </div>

          {/* Phase 2: Actionable Sections */}
          {metrics && (
            <>
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
                          <span className="activity-item__action">
                            {activity.type === 'IN' ? 'Stock Added' : activity.type === 'OUT' ? 'Stock Removed' : 'New Item Added'}
                          </span>
                          <span className="activity-item__context">
                            <strong>{activity.quantityChange}</strong> items for <strong>{activity.fullCode}</strong>
                            {activity.subVariantLabel && (
                              <span style={{ color: 'var(--color-primary)', marginLeft: '4px' }}>
                                ({activity.subVariantLabel})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="activity-item__meta">
                          <span className="activity-item__time">
                            {new Date(activity.timestamp).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <span className="activity-item__qty-change">
                            {activity.previousQuantity} → {activity.newQuantity}
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
