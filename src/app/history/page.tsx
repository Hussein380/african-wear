'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { ActivityLog } from '@/types'
import Sidebar from '@/components/Sidebar'
import SearchOverlay from '@/components/SearchOverlay'

export default function HistoryPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')
  
  // Date Filters
  const [datePreset, setDatePreset] = useState<'7days' | '30days' | 'all' | 'custom'>('7days')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Delete history
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearMode, setClearMode] = useState<'all' | 'older30' | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<string | null>(null)

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
    
    async function fetchHistory(isBackgroundRefresh = false) {
      if (!isBackgroundRefresh) setIsLoading(true)
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
          // Update cache after fresh fetch
          if (datePreset === '7days') {
            sessionStorage.setItem('history_cache_7days', JSON.stringify({ data, ts: Date.now() }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        if (!isBackgroundRefresh) setIsLoading(false)
      }
    }

    // Stale-while-revalidate: show cached data instantly, refresh in background
    if (datePreset === '7days') {
      const cached = sessionStorage.getItem('history_cache_7days')
      if (cached) {
        try {
          const { data, ts } = JSON.parse(cached)
          const age = Date.now() - ts
          if (age < 60_000) { // Cache valid for 60 seconds
            setActivities(data.activities)
            setHasMore(data.pagination.page < data.pagination.totalPages)
            setPage(1)
            setIsLoading(false)
            // Still refresh in background if older than 15s
            if (age > 15_000) fetchHistory(true)
            return
          }
        } catch { /* ignore bad cache */ }
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

  const filteredActivities = activities.filter(activity => {
    if (!globalSearchTerm.trim()) return true
    const term = globalSearchTerm.toLowerCase()
    return (
      (activity.fullCode && activity.fullCode.toLowerCase().includes(term)) ||
      (activity.subVariantLabel && activity.subVariantLabel.toLowerCase().includes(term)) ||
      (activity.type && activity.type.toLowerCase().includes(term)) ||
      (new Date(activity.timestamp).toLocaleDateString().toLowerCase().includes(term))
    )
  })

  const handleClearHistory = async () => {
    if (!clearMode) return
    setIsClearing(true)
    try {
      const url = clearMode === 'all'
        ? '/api/activities?mode=all'
        : '/api/activities?mode=older&days=30'
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setClearResult(`✅ ${data.message}`)
        setActivities([])
        setHasMore(false)
        // Reload fresh data
        setTimeout(() => {
          setShowClearModal(false)
          setClearResult(null)
          setClearMode(null)
          applyPreset('7days')
        }, 1500)
      } else {
        setClearResult(`❌ Error: ${data.error}`)
      }
    } catch {
      setClearResult('❌ Failed to clear history. Try again.')
    } finally {
      setIsClearing(false)
    }
  }

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
        <div className="appbar__right">
          <button 
            className="appbar__action-btn" 
            onClick={() => setIsSearchOpen(true)} 
            type="button" 
            aria-label="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button 
            className="appbar__action-btn" 
            onClick={() => { setShowClearModal(true); setClearResult(null) }} 
            type="button"
            style={{ color: '#fca5a5' }}
            title="Clear History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="m10 11 0 6"/><path d="m14 11 0 6"/><path d="m9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            <span className="desktop-only">Clear History</span>
          </button>
        </div>
      </header>

      <Sidebar
        activeCategory="History"
        onCategoryChange={(category) => router.push(`/classify?category=${category}`)}
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
        ) : filteredActivities.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h3>No Results Found</h3>
            <p>No transactions match <strong>&quot;{globalSearchTerm}&quot;</strong>. Try a different code or date.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Act</th>
                  <th>Item</th>
                  <th>Change</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map(activity => (
                  <tr 
                    key={activity._id} 
                    onClick={() => router.push(`/classify/${activity.designCodeId}`)} 
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ fontWeight: 500 }}>{new Date(activity.timestamp).toLocaleDateString()}</div>
                      <div className="text-muted">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    
                    <td>
                      <span className={`badge ${activity.type === 'IN' ? 'badge--in' : 'badge--out'}`}>
                        {activity.type === 'IN' ? '↓ IN' : '↑ OUT'}
                      </span>
                    </td>
                    
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{activity.fullCode}</div>
                      {activity.subVariantLabel && (
                        <div className="text-muted">
                          Variant: {activity.subVariantLabel}
                        </div>
                      )}
                    </td>
                    
                    <td>
                      <strong style={{ fontSize: '15px', color: activity.type === 'IN' ? '#166534' : '#991b1b' }}>
                        {activity.type === 'IN' ? '+' : '-'}{activity.quantityChange}
                      </strong>
                    </td>
                    
                    <td>
                      <span className="text-muted">
                        {activity.previousQuantity} → <strong style={{ color: 'var(--color-text-primary)', fontSize: '14px' }}>{activity.newQuantity}</strong>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Bug 6 fix: hide Load More when search is active to avoid mixing filtered/unfiltered data */}
            {hasMore && !globalSearchTerm.trim() && (
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

      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={() => { setIsSearchOpen(false); setGlobalSearchTerm('') }} 
        onSearch={(term) => setGlobalSearchTerm(term)}
      />

      {/* Clear History Modal */}
      {showClearModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-xl)', maxWidth: '420px', width: '100%',
            boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-border)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗑️</div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Clear Transaction History</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                This action cannot be undone. Choose what to delete:
              </p>
            </div>

            {clearResult ? (
              <div style={{
                padding: '16px', borderRadius: 'var(--radius-md)',
                background: clearResult.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                textAlign: 'center', fontWeight: 600
              }}>
                {clearResult}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Option 1: Older than 30 days */}
                <button
                  onClick={() => setClearMode(clearMode === 'older30' ? null : 'older30')}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    border: `2px solid ${clearMode === 'older30' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                    background: clearMode === 'older30' ? 'rgba(251,191,36,0.1)' : 'var(--color-bg)',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>📅</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Clear records older than 30 days</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Keeps recent history intact</div>
                  </div>
                </button>

                {/* Option 2: Clear All */}
                <button
                  onClick={() => setClearMode(clearMode === 'all' ? null : 'all')}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    border: `2px solid ${clearMode === 'all' ? '#ef4444' : 'var(--color-border)'}`,
                    background: clearMode === 'all' ? 'rgba(239,68,68,0.1)' : 'var(--color-bg)',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#ef4444' }}>Clear ALL history</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Permanently deletes every transaction record</div>
                  </div>
                </button>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    onClick={() => { setShowClearModal(false); setClearMode(null) }}
                    className="btn btn--secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearHistory}
                    disabled={!clearMode || isClearing}
                    className="btn"
                    style={{
                      flex: 1,
                      background: clearMode === 'all' ? '#ef4444' : 'var(--color-warning)',
                      color: 'white', opacity: !clearMode ? 0.4 : 1
                    }}
                  >
                    {isClearing ? 'Clearing...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
