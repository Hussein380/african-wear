'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import SaleBasketFloating from '@/components/SaleBasketFloating'
import ReceiptFormModal, { SaleLine } from '@/components/ReceiptFormModal'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import { useGoBack } from '@/lib/useGoBack'
import { historyPresetRange, shopDateString } from '@/lib/stockRules'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

interface SaleRow {
  _id: string
  fullCode: string
  subVariantLabel?: string
  quantityChange: number
  timestamp: string
  receipt?: {
    _id: string
    invoiceNumber: string
    customerName?: string
    totalAmount?: number
  }
}

type Period = 'today' | '7days' | 'all'

const PAGE_SIZE = 50

export default function SalesReceiptsPage() {
  const goBack = useGoBack()
  const [sales, setSales] = useState<SaleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [period, setPeriod] = useState<Period>('7days')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [formSales, setFormSales] = useState<SaleLine[] | null>(null)
  const [formInvoiceId, setFormInvoiceId] = useState<string | null>(null)

  const fetchPage = useCallback(async (pageToLoad: number) => {
    let url = `/api/activities?sold=1&page=${pageToLoad}&limit=${PAGE_SIZE}&t=${Date.now()}`
    if (period === 'today') {
      const today = shopDateString()
      url += `&startDate=${today}&endDate=${today}`
    } else if (period === '7days') {
      const { start, end } = historyPresetRange('7days')
      url += `&startDate=${start}&endDate=${end}`
    }
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    setTotalCount(json.pagination?.total || 0)
    setPage(pageToLoad)
    return (json.activities || []).map((a: SaleRow & { _id: unknown }) => ({ ...a, _id: String(a._id) })) as SaleRow[]
  }, [period])

  const loadSales = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setSales(await fetchPage(1))
      setSelected(new Set())
    } catch (err) {
      console.error('Failed to load sales:', err)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [fetchPage])

  // Quiet refresh after a receipt is saved: reload what is already on screen
  const refreshLoaded = useCallback(async () => {
    try {
      const pages = await Promise.all(Array.from({ length: page }, (_, i) => fetchPage(i + 1)))
      const rows = pages.flat()
      setSales(rows)
      // Keep ticks on sales that still have no receipt
      const open = new Set(rows.filter(r => !r.receipt).map(r => r._id))
      setSelected(prev => new Set([...prev].filter(id => open.has(id))))
    } catch (err) {
      console.error('Failed to refresh sales:', err)
    }
  }, [page, fetchPage])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  useAutoRefresh(refreshLoaded)

  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    try {
      const more = await fetchPage(page + 1)
      setSales(prev => [...prev, ...more])
    } catch (err) {
      console.error('Failed to load more sales:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const visibleSales = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return sales
    return sales.filter(s =>
      s.fullCode.toLowerCase().includes(q) ||
      (s.subVariantLabel || '').toLowerCase().includes(q) ||
      (s.receipt?.invoiceNumber || '').toLowerCase().includes(q) ||
      (s.receipt?.customerName || '').toLowerCase().includes(q)
    )
  }, [sales, searchTerm])

  const toLine = (s: SaleRow): SaleLine => ({
    activityId: s._id,
    fullCode: s.fullCode,
    subVariantLabel: s.subVariantLabel,
    quantity: s.quantityChange,
  })

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCombined = () => {
    // Oldest first, so the receipt lists items in the order they were sold
    const rows = sales.filter(s => selected.has(s._id) && !s.receipt).reverse()
    if (rows.length) setFormSales(rows.map(toLine))
  }

  const closeForm = () => {
    setFormSales(null)
    setFormInvoiceId(null)
  }

  const unreceiptedCount = visibleSales.filter(s => !s.receipt).length
  const totalBales = visibleSales.reduce((sum, s) => sum + s.quantityChange, 0)

  const formatWhen = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return {
      date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
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
            onClick={goBack}
            type="button"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            <span>Back</span>
          </button>
          <div>
            <h1 className="appbar__title">Sales &amp; Receipts</h1>
            <p className="appbar__subtitle">
              Newest sales first • Tap Send receipt to share a PDF on WhatsApp
            </p>
          </div>
        </div>
        <div className="appbar__right">
          <ExpandingSearchDock
            onSearch={(val) => setSearchTerm(val)}
            placeholder="Search code, receipt #, customer..."
          />
        </div>
      </header>

      {/* Navigation Sidebar */}
      <Sidebar
        activeCategory="Receipts"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="main-content sales-page">
        {/* Toolbar */}
        <div className="sales-toolbar">
          <div className="sales-toolbar__periods" role="tablist" aria-label="Period">
            {([
              ['today', 'Today'],
              ['7days', 'Last 7 days'],
              ['all', 'All'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={period === key}
                className={`sales-chip ${period === key ? 'sales-chip--active' : ''}`}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {!isLoading && !loadError && (
            <div className="sales-toolbar__summary">
              <strong>{totalCount}</strong> {totalCount === 1 ? 'sale' : 'sales'} • <strong>{totalBales}</strong> bales shown
              {unreceiptedCount > 0 && <> • <span className="sales-toolbar__pending">{unreceiptedCount} without receipt</span></>}
            </div>
          )}
        </div>

        {isLoading && <p className="sales-state">Loading sales…</p>}

        {!isLoading && loadError && (
          <div className="sales-state sales-state--error">
            <strong>Could not load sales.</strong> Check the internet connection and try again.
            <button type="button" className="receipt-form__btn receipt-form__btn--primary" onClick={loadSales}>Retry</button>
          </div>
        )}

        {!isLoading && !loadError && visibleSales.length === 0 && (
          <div className="sales-state">
            {searchTerm
              ? <>No sales match &ldquo;{searchTerm}&rdquo;.</>
              : 'No sales in this period. Sales appear here when stock is removed as Sold.'}
          </div>
        )}

        {!isLoading && !loadError && visibleSales.length > 0 && (
          <div className="sales-sheet" role="table" aria-label="Sales">
            <div className="sales-sheet__row sales-sheet__row--head" role="row">
              <span role="columnheader" className="sel" aria-label="Select" />
              <span role="columnheader">When</span>
              <span role="columnheader">Fabric</span>
              <span role="columnheader" className="num">Bales</span>
              <span role="columnheader">Receipt</span>
            </div>
            {visibleSales.map(s => {
              const when = formatWhen(s.timestamp)
              const isSelected = selected.has(s._id)
              return (
                <div
                  key={s._id}
                  role="row"
                  className={`sales-sheet__row ${isSelected ? 'sales-sheet__row--selected' : ''}`}
                >
                  <span role="cell" className="sel">
                    {!s.receipt && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(s._id)}
                        aria-label={`Select ${s.fullCode} to combine into one receipt`}
                      />
                    )}
                  </span>
                  <span role="cell" className="when">
                    {typeof when === 'string' ? when : <><b>{when.date}</b><small>{when.time}</small></>}
                  </span>
                  <span role="cell" className="code">
                    {s.fullCode}
                    {s.subVariantLabel && <small>{s.subVariantLabel}</small>}
                  </span>
                  <span role="cell" className="num">{s.quantityChange}</span>
                  <span role="cell" className="action">
                    {s.receipt ? (
                      <button
                        type="button"
                        className="sales-receipt-chip"
                        onClick={() => setFormInvoiceId(s.receipt!._id)}
                        title="Open this receipt to change the price or send it again"
                      >
                        <b>{s.receipt.invoiceNumber}</b>
                        <small>{s.receipt.customerName || 'Walk-in'} • Resend</small>
                      </button>
                    ) : (
                      <button type="button" className="sales-send-btn" onClick={() => setFormSales([toLine(s)])}>
                        Send receipt
                      </button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {!isLoading && !loadError && sales.length < totalCount && (
          <div className="sales-more">
            <button type="button" className="receipt-form__btn" onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? 'Loading…' : `Show older sales (${totalCount - sales.length} more)`}
            </button>
          </div>
        )}
      </main>

      {/* Combine several sales into one receipt */}
      {selected.size > 0 && !formSales && (
        <div className="sales-selection-bar">
          <span>{selected.size} {selected.size === 1 ? 'sale' : 'sales'} selected</span>
          <button type="button" className="receipt-form__btn receipt-form__btn--ghost" onClick={() => setSelected(new Set())}>Clear</button>
          <button type="button" className="receipt-form__btn receipt-form__btn--primary" onClick={openCombined}>
            One receipt for {selected.size}
          </button>
        </div>
      )}

      {(formSales || formInvoiceId) && (
        <ReceiptFormModal
          sales={formSales || undefined}
          invoiceId={formInvoiceId || undefined}
          onClose={closeForm}
          onSaved={refreshLoaded}
        />
      )}

      <SaleBasketFloating />
    </>
  )
}
