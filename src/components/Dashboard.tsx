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
        <h2 className="main-content__title">Top-Level Calculator</h2>
        <p className="dashboard__subtitle">
          This dashboard gives you an instant overview of your entire inventory. 
          Use these metrics to track the overall physical volume of your store.
        </p>
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
              <div className="dashboard-card__icon">📦</div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Total Stock Volume</span>
                <span className="dashboard-card__value">{metrics?.totalStock || 0}</span>
                <p className="dashboard-card__hint">Total individual pieces across all colorways in the entire store.</p>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card__icon">🎨</div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Total Design Codes</span>
                <span className="dashboard-card__value">{metrics?.totalDesigns || 0}</span>
                <p className="dashboard-card__hint">Number of unique designs currently tracked in your catalog.</p>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card__icon">📁</div>
              <div className="dashboard-card__content">
                <span className="dashboard-card__label">Active Categories</span>
                <span className="dashboard-card__value">{metrics?.activeCategoriesCount || 0}</span>
                <p className="dashboard-card__hint">Number of main categories that currently hold stock.</p>
              </div>
            </div>
          </div>

          {/* Phase 2: Actionable Sections */}
          {metrics && (
            <>
              <div className="dashboard__sections">
              {/* Low Stock Alerts */}
              <section className="dashboard-section">
                <h3 className="dashboard-section__title">⚠️ Low Stock Alerts</h3>
                <p className="dashboard-section__desc">These specific variants have less than 5 items remaining. Tap one to view or restock.</p>
                
                {metrics.lowStockItems.length === 0 ? (
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
                            <span style={{opacity: 0.3, fontSize: '20px'}}>📸</span>
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
                <h3 className="dashboard-section__title">📊 Stock Distribution</h3>
                <p className="dashboard-section__desc">See exactly where your inventory is concentrated. Tap a category to view its items.</p>
                
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
                <h3 className="dashboard-section__title">📝 Recent Transactions</h3>
                <p className="dashboard-section__desc">Your automatic receipt of all stock movements (In / Out).</p>

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
                          {activity.type === 'IN' ? '↓' : activity.type === 'OUT' ? '↑' : '+'}
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
