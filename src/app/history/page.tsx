'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { ActivityLog } from '@/types'
import Sidebar from '@/components/Sidebar'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import { useGoBack } from '@/lib/useGoBack'
import { historyPresetRange } from '@/lib/stockRules'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

export default function HistoryPage() {
  const router = useRouter()
  const goBack = useGoBack()
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')
  
  // Date Filters
  const [datePreset, setDatePreset] = useState<
    'this_week' | '7days' | 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom'
  >('this_week')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Helper to set dates based on calendar periods
  const applyPreset = (preset: 'this_week' | '7days' | 'this_month' | 'last_month' | 'this_year' | 'all') => {
    setDatePreset(preset)
    if (preset === 'all') {
      setStartDate('')
      setEndDate('')
      return
    }
    const { start, end } = historyPresetRange(preset)
    setStartDate(start)
    setEndDate(end)
  }

  // Initial load: default to This Week
  useEffect(() => {
    applyPreset('this_week')
  }, [])

  const fetchHistory = useCallback(async (isBackgroundRefresh = false) => {
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
          if (datePreset === 'this_week') {
            sessionStorage.setItem('prefetch_History', JSON.stringify({ data, ts: Date.now() }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        if (!isBackgroundRefresh) setIsLoading(false)
      }
  }, [datePreset, startDate, endDate])

  // Fetch data when dates or page 1 changes
  useEffect(() => {
    if (datePreset === 'custom' && (!startDate || !endDate)) return;

    // Stale-while-revalidate: show cached data instantly, refresh in background
    if (datePreset === 'this_week') {
      const cached = sessionStorage.getItem('prefetch_History')
      if (cached) {
        try {
          const { data, ts } = JSON.parse(cached)
          const age = Date.now() - ts
          if (age < 60_000) { // Cache valid for 60 seconds
            setActivities(data.activities)
            setHasMore(data.pagination.page < data.pagination.totalPages)
            setPage(1)
            setIsLoading(false)
            // Always refresh in background so a just-made change is never missing
            fetchHistory(true)
            return
          }
        } catch { /* ignore bad cache */ }
      }
    }

    fetchHistory()
  }, [datePreset, startDate, endDate, fetchHistory])

  // Live history; paused once older entries have been loaded so the list doesn't jump back
  useAutoRefresh(
    () => fetchHistory(true),
    page === 1 && !(datePreset === 'custom' && (!startDate || !endDate))
  )

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
        let actionLabel = 'Stock Added'
        if (activity.kind === 'sold') actionLabel = 'Sold'
        else if (activity.kind === 'own_use') actionLabel = 'Own Use'
        else if (activity.kind === 'arrived') actionLabel = 'New Stock Arrived'
        else if (activity.kind === 'returned') actionLabel = 'Customer Return'
        else if (activity.kind === 'count_diff') actionLabel = 'Stock Count Adjustment'
        else if (activity.kind === 'deleted') actionLabel = 'Deleted with Stock'
        else if (activity.type === 'OUT') actionLabel = 'Sold / Removed'
        else if (activity.type === 'NEW') actionLabel = 'New Item'

        return {
          'Date': dateObj.toLocaleDateString(),
          'Time': dateObj.toLocaleTimeString(),
          'Direction': activity.type === 'OUT' ? 'Outflow' : 'Inflow',
          'Transaction Type': actionLabel,
          'Colorway Code': activity.fullCode || '-',
          'Sub-Variant': activity.subVariantLabel || '-',
          'Quantity Changed': activity.type === 'OUT' ? -activity.quantityChange : activity.quantityChange,
          'Final Stock': activity.newQuantity,
          'Previous Stock': activity.previousQuantity,
          'Receipt ID': activity.invoiceId ? String(activity.invoiceId) : '-',
          'Corrected': activity.edited ? 'Yes' : 'No',
        }
      })

      // Create Worksheet
      const ws = XLSX.utils.json_to_sheet(excelData)
      
      // Auto-size columns nicely
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 12 }, // Time
        { wch: 12 }, // Direction
        { wch: 22 }, // Transaction Type
        { wch: 15 }, // Code
        { wch: 15 }, // SubVariant
        { wch: 16 }, // Qty Changed
        { wch: 15 }, // Unit Price
        { wch: 18 }, // Total Revenue
        { wch: 12 }, // Final Stock
        { wch: 14 }, // Prev Stock
        { wch: 26 }, // Invoice ID
        { wch: 10 }, // Corrected
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

  const handleVoidActivity = async (e: React.MouseEvent, activity: ActivityLog) => {
    e.stopPropagation()
    const isOut = activity.type === 'OUT'
    const promptMsg = isOut
      ? `Undo / Void this ${activity.kind || 'sale'} of ${activity.quantityChange} pc(s) of ${activity.fullCode}?\n\n• The item will be restored back into stock (+${activity.quantityChange}).\n• Any sales revenue will be erased from financial reports.`
      : `Undo / Void this stock addition of ${activity.quantityChange} pc(s) of ${activity.fullCode}?\n\n• The item will be deducted from stock (-${activity.quantityChange}).`

    if (!window.confirm(promptMsg)) return

    try {
      const res = await fetch(`/api/activities/${activity._id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        alert(`✓ Action undone. Stock for ${activity.fullCode} restored.`)
        setActivities(prev => prev.filter(a => a._id !== activity._id))
        sessionStorage.removeItem('prefetch_History')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to undo action')
      }
    } catch (err) {
      console.error('Error undoing activity:', err)
      alert('Network error')
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
          <button
            className="appbar__back-btn"
            onClick={goBack}
            type="button"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            <span>Back</span>
          </button>
          <div>
            <h1 className="appbar__title">Activity History</h1>
            <p className="appbar__subtitle">Audit trail of sales, bale arrivals, and stock updates</p>
          </div>
        </div>
        <div className="appbar__right">
          <ExpandingSearchDock onSearch={(val) => setGlobalSearchTerm(val)} />
        </div>
      </header>

      <Sidebar
        activeCategory="History"
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

      {/* Filter Controls & Calendar Presets */}
      <div style={{ background: 'var(--color-bg-card)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, marginRight: '4px' }}>Period:</div>
          <button 
            onClick={() => applyPreset('this_week')}
            className={`btn btn--sm ${datePreset === 'this_week' ? 'btn--primary' : 'btn--secondary'}`}
          >
            This Week
          </button>
          <button 
            onClick={() => applyPreset('this_month')}
            className={`btn btn--sm ${datePreset === 'this_month' ? 'btn--primary' : 'btn--secondary'}`}
          >
            This Month
          </button>
          <button 
            onClick={() => applyPreset('last_month')}
            className={`btn btn--sm ${datePreset === 'last_month' ? 'btn--primary' : 'btn--secondary'}`}
          >
            Last Month
          </button>
          <button 
            onClick={() => applyPreset('this_year')}
            className={`btn btn--sm ${datePreset === 'this_year' ? 'btn--primary' : 'btn--secondary'}`}
          >
            Year to Date ({new Date().getFullYear()})
          </button>
          <button 
            onClick={() => applyPreset('all')}
            className={`btn btn--sm ${datePreset === 'all' ? 'btn--primary' : 'btn--secondary'}`}
          >
            All Time
          </button>
          
          <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', margin: '0 4px' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Custom:</span>
            <input 
              type="date" 
              className="form-group__input" 
              style={{ padding: '6px 10px', minHeight: 'unset', maxWidth: '140px', fontSize: '13px' }}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setDatePreset('custom')
              }}
            />
            <span style={{ fontSize: '13px' }}>to</span>
            <input 
              type="date" 
              className="form-group__input" 
              style={{ padding: '6px 10px', minHeight: 'unset', maxWidth: '140px', fontSize: '13px' }}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setDatePreset('custom')
              }}
            />
          </div>
        </div>

        {/* Dynamic Period Summary Card */}
        {activities.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--color-border)',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Summary for <strong>{startDate || 'All'}</strong> to <strong>{endDate || 'Present'}</strong>:
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', fontSize: '13px', fontWeight: 700 }}>
                🛍️ {filteredActivities
                  .filter(a => a.type === 'OUT' && (a.kind === 'sold' || !a.kind))
                  .reduce((sum, a) => sum + (a.quantityChange || 0), 0)} Pieces Sold
              </span>
              <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', fontSize: '13px', fontWeight: 700 }}>
                📦 {filteredActivities
                  .filter(a => a.type === 'IN' || a.type === 'NEW')
                  .reduce((sum, a) => sum + (a.quantityChange || 0), 0)} Pieces Received
              </span>
              {filteredActivities.some(a => a.kind === 'returned') && (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', fontSize: '13px', fontWeight: 700 }}>
                  ↩️ {filteredActivities
                    .filter(a => a.kind === 'returned')
                    .reduce((sum, a) => sum + (a.quantityChange || 0), 0)} Returns
                </span>
              )}
            </div>
          </div>
        )}
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
                  <th style={{ textAlign: 'right' }}>Action</th>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span className={`badge ${activity.type === 'OUT' ? 'badge--out' : 'badge--in'}`}>
                          {activity.kind === 'sold'
                            ? '− SOLD'
                            : activity.kind === 'own_use'
                            ? '− OWN USE'
                            : activity.kind === 'arrived'
                            ? '+ ARRIVED'
                            : activity.kind === 'returned'
                            ? '+ RETURN'
                            : activity.kind === 'count_diff'
                            ? '⚖ COUNT'
                            : activity.kind === 'deleted'
                            ? '🗑 DELETED'
                            : activity.type === 'IN'
                            ? '↓ IN'
                            : activity.type === 'OUT'
                            ? '↑ OUT'
                            : '★ NEW'}
                        </span>
                        {activity.edited && (
                          <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600 }}>
                            (corrected)
                          </span>
                        )}
                      </div>
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
                      <strong style={{ fontSize: '15px', color: activity.type === 'OUT' ? '#991b1b' : '#166534' }}>
                        {activity.type === 'OUT' ? '-' : '+'}{activity.quantityChange}
                      </strong>
                    </td>
                    
                    <td>
                      <span className="text-muted">
                        {activity.previousQuantity} → <strong style={{ color: 'var(--color-text-primary)', fontSize: '14px' }}>{activity.newQuantity}</strong>
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={e => handleVoidActivity(e, activity)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          color: '#dc2626',
                          borderColor: '#fca5a5',
                          background: '#fff5f5',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Undo this transaction and restore original stock count"
                      >
                        ↺ Undo
                      </button>
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

    </>
  )
}
