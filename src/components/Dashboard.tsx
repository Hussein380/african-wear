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
  const router = useRouter()

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/dashboard')
        if (res.ok) {
          const data = await res.json()
          setMetrics(data)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard metrics:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchMetrics()
  }, [])

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
            <div className="dashboard-card dashboard-card--primary">
              <div className="dashboard-card__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Total Stock Volume</span>
                <span className="dashboard-card__value">{metrics?.totalStock || 0}</span>
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

            <div className="dashboard-card">
              <div className="dashboard-card__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
              </div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Active Categories</span>
                <span className="dashboard-card__value">{metrics?.activeCategoriesCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Phase 2: Actionable Sections */}
          {metrics && (
            <>
              <div className="dashboard__sections">
              {/* Low Stock Alerts */}
              <section className="dashboard-section">
                <h3 className="dashboard-section__title" style={{ display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  Low Stock Alerts
                </h3>
                
                {metrics.totalStock === 0 ? (
                  <div className="empty-state empty-state--sm" style={{ padding: 'var(--space-md)' }}>
                    <h4 style={{ color: 'var(--color-text-secondary)' }}>Your inventory is completely empty.</h4>
                  </div>
                ) : metrics.lowStockItems.length === 0 ? (
                  <div className="empty-state empty-state--sm" style={{ padding: 'var(--space-md)' }}>
                    <h4 style={{ color: 'var(--color-success)' }}>All stock levels are healthy.</h4>
                  </div>
                ) : (
                  <div className="low-stock-list">
                    {metrics.lowStockItems.map(item => (
                      <div 
                        key={item._id} 
                        className="low-stock-item"
                        onClick={() => router.push(`/classify/${item.designCodeId}`)}
                      >
                        <div className="low-stock-item__image">
                          {item.photos?.[0]?.url ? (
                            <img src={item.photos[0].url} alt={item.fullCode} />
                          ) : item.designCodeThumbnail ? (
                            <img src={item.designCodeThumbnail} alt={item.fullCode} />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          )}
                        </div>
                        <div className="low-stock-item__info">
                          <span className="low-stock-item__code">{item.fullCode}</span>
                          <span className="low-stock-item__design">{item.designCodeName}</span>
                        </div>
                        <div className="low-stock-item__qty">
                          {item.quantityAvailable} left
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Stock Distribution */}
              <section className="dashboard-section">
                <h3 className="dashboard-section__title" style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                  Stock Distribution
                </h3>
                
                <div className="distribution-list">
                  {metrics.stockDistribution.map(dist => (
                    <div 
                      key={dist.category} 
                      className="distribution-item"
                      onClick={() => onCategoryChange(dist.category as ViewState)}
                    >
                      <div className="distribution-item__label">{dist.category}</div>
                      <div className="distribution-item__bar-container">
                        <div 
                          className="distribution-item__bar" 
                          style={{ width: `${Math.max(2, (dist.totalQuantity / metrics.totalStock) * 100)}%` }} 
                        />
                      </div>
                      <div className="distribution-item__value">{dist.totalQuantity} items</div>
                    </div>
                  ))}
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
