'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { ActivityLog } from '@/types'
import Sidebar from '@/components/Sidebar'

export default function HistoryPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  
  // Date Filters
  const [datePreset, setDatePreset] = useState<'7days' | '30days' | 'all' | 'custom'>('7days')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Helper to set dates based on preset
  const applyPreset = (preset: '7days' | '30days' | 'all') => {
    setDatePreset(preset)
    const today = new Date()
    let start = new Date()
    
    if (preset === '7days') {
      start.setDate(today.getDate() - 7)
    } else if (preset === '30days') {
      start.setDate(today.getDate() - 30)
    } else if (preset === 'all') {
      setStartDate('')
      setEndDate('')
      return
    }
    
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }

  // Initial load
  useEffect(() => {
    applyPreset('7days')
  }, [])

  // Fetch data when dates or page 1 changes
  useEffect(() => {
    if (datePreset === 'custom' && (!startDate || !endDate)) return;
    
    async function fetchHistory() {
      setIsLoading(true)
      try {
        let url = `/api/activities?page=1&limit=20&t=${new Date().getTime()}`
        if (startDate) url += `&startDate=${startDate}`
        if (endDate) url += `&endDate=${endDate}`

        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setActivities(data.activities)
          setHasMore(data.pagination.page < data.pagination.totalPages)
          setPage(1)
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchHistory()
  }, [datePreset, startDate, endDate])

  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      let url = `/api/activities?page=${nextPage}&limit=20&t=${new Date().getTime()}`
      if (startDate) url += `&startDate=${startDate}`
      if (endDate) url += `&endDate=${endDate}`

      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setActivities(prev => [...prev, ...data.activities])
        setHasMore(data.pagination.page < data.pagination.totalPages)
        setPage(nextPage)
      }
    } catch (error) {
      console.error('Failed to load more:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const exportToExcel = async () => {
    setIsExporting(true)
    try {
      // Fetch ALL data for the selected date range (limit=10000 to get everything)
      let url = `/api/activities?page=1&limit=10000&t=${new Date().getTime()}`
      if (startDate) url += `&startDate=${startDate}`
      if (endDate) url += `&endDate=${endDate}`

      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch export data')
      
      const data = await res.json()
      const allActivities: ActivityLog[] = data.activities

      // Transform data for Excel
      const excelData = allActivities.map(activity => {
        const dateObj = new Date(activity.timestamp)
        return {
          'Date': dateObj.toLocaleDateString(),
          'Time': dateObj.toLocaleTimeString(),
          'Action': activity.type === 'IN' ? 'Stock Added' : activity.type === 'OUT' ? 'Stock Removed' : 'System Event',
          'Colorway Code': activity.fullCode || '-',
          'Sub-Variant': activity.subVariantLabel || '-',
          'Quantity Changed': activity.type === 'IN' ? `+${activity.quantityChange}` : `-${activity.quantityChange}`,
          'Final Stock': activity.newQuantity,
          'Previous Stock': activity.previousQuantity,
        }
      })

      // Create Worksheet
      const ws = XLSX.utils.json_to_sheet(excelData)
      
      // Auto-size columns nicely
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 12 }, // Time
        { wch: 15 }, // Action
        { wch: 15 }, // Code
        { wch: 15 }, // SubVariant
        { wch: 18 }, // Qty Changed
        { wch: 12 }, // Final Stock
        { wch: 15 }, // Prev Stock
      ]
      ws['!cols'] = colWidths

      // Create Workbook and append sheet
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transaction History')

      // Generate filename based on dates
      let filename = 'Mandera_Transactions'
      if (datePreset === 'all') {
        filename += '_All_Time.xlsx'
      } else {
        const safeStart = startDate || 'Start'
        const safeEnd = endDate || 'End'
        filename += `_${safeStart}_to_${safeEnd}.xlsx`
      }

      // Trigger download
      XLSX.writeFile(wb, filename)
      
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to generate Excel file. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <>
      <header className="appbar">
        <div className="appbar__left">
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsSidebarOpen(prev => !prev)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <div>
            <h1 className="appbar__title">Transaction History</h1>
            <p className="appbar__subtitle">Mandera African Wear</p>
          </div>
        </div>
      </header>

      <Sidebar
        activeCategory="History"
        onCategoryChange={() => {}}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="main-content">
        <div style={{ padding: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: '16px' }}>
        <h1 className="main-content__title" style={{ margin: 0 }}>Transaction History</h1>
        <button 
          onClick={exportToExcel}
          disabled={isExporting || activities.length === 0}
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#107c41' }} // Excel Green
        >
          {isExporting ? (
            <span>Exporting...</span>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Export to Excel
            </>
          )}
        </button>
      </div>

      {/* Filter Controls */}
      <div style={{ background: 'var(--color-bg-card)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, marginRight: '8px' }}>Filter by Date:</div>
          <button 
            onClick={() => applyPreset('7days')}
            className={`btn btn--sm ${datePreset === '7days' ? 'btn--primary' : 'btn--secondary'}`}
          >
            Last 7 Days
          </button>
          <button 
            onClick={() => applyPreset('30days')}
            className={`btn btn--sm ${datePreset === '30days' ? 'btn--primary' : 'btn--secondary'}`}
          >
            Last 30 Days
          </button>
          <button 
            onClick={() => applyPreset('all')}
            className={`btn btn--sm ${datePreset === 'all' ? 'btn--primary' : 'btn--secondary'}`}
          >
            All Time
          </button>
          
          <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', margin: '0 8px' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px' }}>Custom:</span>
            <input 
              type="date" 
              className="form-group__input" 
              style={{ padding: '6px 12px', minHeight: 'unset', maxWidth: '140px' }}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setDatePreset('custom')
              }}
            />
            <span style={{ fontSize: '14px' }}>to</span>
            <input 
              type="date" 
              className="form-group__input" 
              style={{ padding: '6px 12px', minHeight: 'unset', maxWidth: '140px' }}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setDatePreset('custom')
              }}
            />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading history...</div>
        ) : activities.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <h3>No Transactions Found</h3>
            <p>There is no activity for the selected date range.</p>
          </div>
        ) : (
          <div className="inventory-list">
            <div className="inventory-header">
              <div className="inventory-col" style={{ flex: '1.5' }}>Date & Time</div>
              <div className="inventory-col">Action</div>
              <div className="inventory-col" style={{ flex: '2' }}>Item</div>
              <div className="inventory-col">Qty Change</div>
              <div className="inventory-col">Final Stock</div>
            </div>
            
            <div className="inventory-body">
              {activities.map(activity => (
                <div key={activity._id} className="inventory-row" onClick={() => router.push(`/classify/${activity.designCodeId}`)} style={{ cursor: 'pointer' }}>
                  <div className="inventory-col" style={{ flex: '1.5' }}>
                    <span className="inventory-mobile-label">Date:</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{new Date(activity.timestamp).toLocaleDateString()}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="inventory-col">
                    <span className="inventory-mobile-label">Action:</span>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      color: activity.type === 'IN' ? 'var(--color-success)' : 'var(--color-danger)',
                      fontWeight: 600,
                      fontSize: '13px'
                    }}>
                      {activity.type === 'IN' ? '↓ IN' : '↑ OUT'}
                    </span>
                  </div>
                  
                  <div className="inventory-col" style={{ flex: '2' }}>
                    <span className="inventory-mobile-label">Item:</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{activity.fullCode}</div>
                      {activity.subVariantLabel && (
                        <div style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
                          Variant: {activity.subVariantLabel}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="inventory-col">
                    <span className="inventory-mobile-label">Change:</span>
                    <strong style={{ fontSize: '16px', color: activity.type === 'IN' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {activity.type === 'IN' ? '+' : '-'}{activity.quantityChange}
                    </strong>
                  </div>
                  
                  <div className="inventory-col">
                    <span className="inventory-mobile-label">Final Stock:</span>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                      {activity.previousQuantity} → <strong style={{ color: 'var(--color-text)', fontSize: '15px' }}>{activity.newQuantity}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div style={{ padding: 'var(--space-md)', textAlign: 'center', borderTop: '1px solid var(--color-border)' }}>
                <button 
                  onClick={handleLoadMore} 
                  disabled={isLoadingMore}
                  className="btn btn--secondary"
                >
                  {isLoadingMore ? 'Loading...' : 'Load More Transactions'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      </main>
    </>
  )
}
