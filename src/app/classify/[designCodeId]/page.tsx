'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { use } from 'react'
import ColorwayModal from '@/components/ColorwayModal'
import DesignCodeModal from '@/components/DesignCodeModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import Toast, { ToastData } from '@/components/Toast'
import { Colorway, DesignCode } from '@/types'
import { CacheKeys, getCached, getCacheAge, setCached, bustCache, bustAllDesignCodesCache } from '@/lib/cache'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import SaleBasketFloating from '@/components/SaleBasketFloating'
import { useSaleBasket } from '@/lib/useSaleBasket'
import StaffGuideModal from '@/components/StaffGuideModal'
import { useGoBack } from '@/lib/useGoBack'

export default function DesignCodeDetailPage({
  params,
}: {
  params: Promise<{ designCodeId: string }>
}) {
  const { designCodeId } = use(params)
  const { addItem } = useSaleBasket()
  const [colorways, setColorways] = useState<Colorway[]>([])
  const [designCode, setDesignCode] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingColorway, setEditingColorway] = useState<Colorway | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Colorway | null>(null)
  const [pickColourFor, setPickColourFor] = useState<Colorway | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  
  // Design Code specific state
  const [designCodeObj, setDesignCodeObj] = useState<DesignCode | null>(null)
  const [showEditDesignModal, setShowEditDesignModal] = useState(false)
  const [showDeleteDesignConfirm, setShowDeleteDesignConfirm] = useState(false)
  
  const router = useRouter()
  const goBack = useGoBack()
  const searchParams = useSearchParams()
  
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState(searchParams.get('search') || '')
  const [showGuideModal, setShowGuideModal] = useState(false)

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{
    visible: boolean
    message: string
    onUndo: () => void
  }>({ visible: false, message: '', onUndo: () => {} })
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const term = searchParams.get('search')
    if (term !== null) {
      setGlobalSearchTerm(term)
    }
  }, [searchParams])

  // Global '/' keyboard shortcut to open search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const fetchColorways = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setIsLoading(true)
    const cacheKey = CacheKeys.colorways(designCodeId)
    try {
      // SWR: serve cached data instantly, then refresh in background
      if (!isBackgroundRefresh) {
        const cached = getCached<Colorway[]>(cacheKey)
        if (cached) {
          setColorways(cached)
          setIsLoading(false)
          if (getCacheAge(cacheKey) > 15_000) fetchColorways(true)
          return
        }
      }

      const res = await fetch(`/api/colorways?designCodeId=${designCodeId}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setColorways(data)
        setCached(cacheKey, data)
      }
    } catch (error) {
      console.error('Failed to fetch colorways:', error)
    } finally {
      if (!isBackgroundRefresh) setIsLoading(false)
    }
  }, [designCodeId])

  // Fetch design code name
  useEffect(() => {
    async function fetchDesignCode() {
      try {
        const res = await fetch(`/api/design-codes/${designCodeId}?t=${new Date().getTime()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (res.ok) {
          const data = await res.json()
          setDesignCode(data.code)
          setDesignCodeObj(data)
        }
      } catch (error) {
        console.error('Failed to fetch design code:', error)
      }
    }
    fetchDesignCode()
    fetchColorways()
  }, [designCodeId, fetchColorways])

  // --- Design Code Actions ---
  const handleEditDesignCode = async (data: { code: string, category: string, thumbnailUrl: string, thumbnailPublicId: string }) => {
    const res = await fetch(`/api/design-codes/${designCodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setShowEditDesignModal(false)
      const updated = await fetch(`/api/design-codes/${designCodeId}`)
      if (updated.ok) {
        const d = await updated.json()
        setDesignCode(d.code)
        setDesignCodeObj(d)
      }
    }
  }

  const handleDeleteDesignCode = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/design-codes/${designCodeId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/classify')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // --- Colorway Actions ---
  const handleAddColorway = async (data: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
    breakdown?: { id: string; label: string; quantity: number }[]
    location?: string
  }) => {
    const res = await fetch('/api/colorways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, designCodeId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Could not save. Please try again.')
    }
    {
      bustCache(CacheKeys.colorways(designCodeId))
      bustAllDesignCodesCache()
      fetchColorways()
    }
  }

  const handleEditColorway = async (data: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
    breakdown?: { id: string; label: string; quantity: number }[]
    location?: string
  }) => {
    if (!editingColorway) return
    const res = await fetch(`/api/colorways/${editingColorway._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // stockBase = the numbers this form opened with, so the server can refuse to
      // overwrite stock that changed on another phone in the meantime
      body: JSON.stringify({
        ...data,
        stockBase: {
          quantityAvailable: editingColorway.quantityAvailable,
          breakdown: editingColorway.breakdown || [],
        },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      bustCache(CacheKeys.colorways(designCodeId))
      fetchColorways()
      throw new Error(err.error || 'Could not save. Please try again.')
    }
    {
      setEditingColorway(null)
      bustCache(CacheKeys.colorways(designCodeId))
      bustAllDesignCodesCache()
      fetchColorways()
    }
  }

  const handleDeleteColorway = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/colorways/${deleteTarget._id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteTarget(null)
        bustCache(CacheKeys.colorways(designCodeId))
        bustAllDesignCodesCache()
        fetchColorways()
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const [activeToast, setActiveToast] = useState<ToastData | null>(null)

  // Add to the sale basket. Items with colours must be sold from a named colour,
  // otherwise the item total and its colours would stop agreeing.
  const addToSale = (cw: Colorway, colour?: { id: string; label: string; quantity: number }) => {
    if (colour) {
      addItem({
        colorwayId: cw._id,
        designCodeId,
        fullCode: cw.fullCode,
        subVariantId: colour.id,
        subVariantLabel: colour.label,
        available: colour.quantity,
      })
      setPickColourFor(null)
      return
    }
    const inStock = (cw.breakdown || []).filter(b => b.quantity > 0)
    if ((cw.breakdown || []).length === 0) {
      if (cw.quantityAvailable > 0) {
        addItem({ colorwayId: cw._id, designCodeId, fullCode: cw.fullCode, available: cw.quantityAvailable })
      } else {
        alert(`${cw.fullCode} is out of stock.`)
      }
    } else if (inStock.length === 0) {
      alert(`${cw.fullCode} is out of stock.`)
    } else if (inStock.length === 1) {
      addToSale(cw, inStock[0])
    } else {
      setPickColourFor(cw)
    }
  }
  const pendingUpdatesRef = useRef<Map<string, { delta: number; timer: ReturnType<typeof setTimeout> }>>(new Map())
  const [directCountTarget, setDirectCountTarget] = useState<{
    cw: Colorway
    subVariantId?: string
    currentQty: number
    label: string
  } | null>(null)
  const [directCountInput, setDirectCountInput] = useState('')

  // Clean timers on unmount
  useEffect(() => {
    const currentMap = pendingUpdatesRef.current
    return () => {
      currentMap.forEach(item => clearTimeout(item.timer))
    }
  }, [])

  // Send the batched delta to /api/stock atomically
  const commitStockChange = async (
    cw: Colorway,
    delta: number,
    subVariantId?: string,
    subVariantLabel?: string
  ) => {
    if (delta === 0) return
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colorwayId: cw._id,
          change: delta,
          subVariantId,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        // Sync fresh authoritative quantities
        setColorways(prev => {
          const updated = prev.map(item =>
            item._id === cw._id
              ? {
                  ...item,
                  quantityAvailable: data.quantityAvailable,
                  breakdown: data.breakdown || item.breakdown,
                }
              : item
          )
          setCached(CacheKeys.colorways(designCodeId), updated)
          bustAllDesignCodesCache()
          return updated
        })

        // Show Toast with 1-tap tag and Undo option
        const itemDisplayName = subVariantLabel ? `${cw.fullCode} (${subVariantLabel})` : cw.fullCode
        setActiveToast({
          id: `${Date.now()}_${Math.random()}`,
          message: `${delta > 0 ? '+' : ''}${delta} ${itemDisplayName}`,
          itemCode: itemDisplayName,
          activityId: data.activityId,
          colorwayId: cw._id,
          change: delta,
          subVariantId,
          currentKind: data.kind,
          onUndo: async () => {
            await fetch('/api/stock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                colorwayId: cw._id,
                change: -delta,
                subVariantId,
                undoOf: data.activityId,
              }),
            })
            bustCache(CacheKeys.colorways(designCodeId))
            bustAllDesignCodesCache()
            fetchColorways()
          },
        })
      } else {
        alert(data.error || 'Failed to update stock')
        bustCache(CacheKeys.colorways(designCodeId))
        fetchColorways()
      }
    } catch (err) {
      console.error('Error committing stock change:', err)
      alert('Network error. Refreshing stock...')
      bustCache(CacheKeys.colorways(designCodeId))
      fetchColorways()
    }
  }

  // Batched rapid-tap quantity change: smooth local UI, one batched network request after 1.2s pause
  const handleQuantityDelta = (
    cw: Colorway,
    deltaStep: number,
    subVariantId?: string,
    subVariantLabel?: string
  ) => {
    const key = subVariantId ? `${cw._id}_${subVariantId}` : cw._id

    // Check available locally to prevent negative
    let currentQty = cw.quantityAvailable
    if (subVariantId) {
      const v = cw.breakdown?.find(b => b.id === subVariantId)
      currentQty = v ? v.quantity : 0
    }
    const existingPending = pendingUpdatesRef.current.get(key)
    const currentDelta = existingPending ? existingPending.delta : 0
    const nextDelta = currentDelta + deltaStep

    if (currentQty + nextDelta < 0) {
      alert(`Only ${currentQty} in stock`)
      return
    }

    // Optimistically update the UI numbers instantly
    setColorways(prev => {
      const updated = prev.map(item => {
        if (item._id !== cw._id) return item
        if (subVariantId && item.breakdown) {
          const newBreakdown = item.breakdown.map(b =>
            b.id === subVariantId ? { ...b, quantity: b.quantity + deltaStep } : b
          )
          const newTotal = newBreakdown.reduce((sum, b) => sum + b.quantity, 0)
          return { ...item, breakdown: newBreakdown, quantityAvailable: newTotal }
        } else {
          return { ...item, quantityAvailable: item.quantityAvailable + deltaStep }
        }
      })
      return updated
    })

    // Clear previous timer for this item
    if (existingPending) {
      clearTimeout(existingPending.timer)
    }

    // Set 1.2 second debounce timer
    const timer = setTimeout(() => {
      pendingUpdatesRef.current.delete(key)
      commitStockChange(cw, nextDelta, subVariantId, subVariantLabel)
    }, 1200)

    pendingUpdatesRef.current.set(key, { delta: nextDelta, timer })
  }

  // Direct count modal commit (for bulk arrival or physical count adjustment)
  const handleDirectCountSave = async () => {
    if (!directCountTarget) return
    const counted = parseInt(directCountInput, 10)
    if (isNaN(counted) || counted < 0) {
      alert('Please enter a valid non-negative number')
      return
    }

    try {
      const res = await fetch('/api/stock/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colorwayId: directCountTarget.cw._id,
          counted,
          subVariantId: directCountTarget.subVariantId,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setDirectCountTarget(null)
        setDirectCountInput('')
        bustCache(CacheKeys.colorways(designCodeId))
        bustAllDesignCodesCache()
        fetchColorways()
      } else {
        alert(data.error || 'Failed to save count')
      }
    } catch {
      alert('Network error')
    }
  }

  const filteredColorways = colorways.filter(cw => {
    if (!globalSearchTerm.trim()) return true
    return cw.fullCode.toLowerCase().includes(globalSearchTerm.toLowerCase())
  })

  const totalStock = colorways.reduce((sum, cw) => sum + (cw.quantityAvailable || 0), 0)
  const isPrintTC = designCodeObj?.category === 'PrintTC'

  return (
    <>
      {/* App Bar */}
      <header className="appbar">
        <div className="appbar__left">
          <button
            className="appbar__back-btn"
            onClick={goBack}
            type="button"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Back
          </button>
          <div>
            <h1 className="appbar__title">{designCode || 'Loading...'} {isPrintTC ? 'Colors' : 'Colorways'}</h1>
            <p className="appbar__subtitle">
              <strong>{filteredColorways.length}</strong> {filteredColorways.length === 1 ? (isPrintTC ? 'Color' : 'Style') : (isPrintTC ? 'Colors' : 'Styles')} • <strong>{totalStock}</strong> {totalStock === 1 ? 'Bale' : 'Total Bales'} in Store
            </p>
          </div>
        </div>
        <div className="appbar__right">
          <ExpandingSearchDock onSearch={(val) => setGlobalSearchTerm(val)} placeholder="Search colorways..." />
          <button
            className="appbar__action-btn"
            onClick={() => setShowGuideModal(true)}
            type="button"
            title="Staff Guide & Quick Help"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="desktop-only">Guide</span>
          </button>
          <button className="appbar__action-btn" onClick={() => setShowEditDesignModal(true)} type="button" title="Edit Design">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="desktop-only">Edit</span>
          </button>
          <button className="appbar__action-btn" onClick={() => setShowDeleteDesignConfirm(true)} type="button" title="Delete Design">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            <span className="desktop-only">Delete</span>
          </button>
          <button className="appbar__action-btn" onClick={() => fetchColorways()} type="button" title="Refresh">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
            <span className="desktop-only">Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Content (no sidebar on detail page) */}
      <main className="main-content" style={{ marginLeft: 0 }}>
        {/* Loading */}
        {isLoading && (
          <div className="colorway-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`colorway-card ${isPrintTC ? 'colorway-card--compact' : ''}`}>
                <div className="skeleton" style={{ aspectRatio: isPrintTC ? '1' : '4/3', width: isPrintTC ? '80px' : '100%', height: isPrintTC ? '80px' : 'auto' }} />
                <div style={{ padding: 'var(--space-md)', flex: 1 }}>
                  <div className="skeleton" style={{ height: '20px', width: '60%', marginBottom: '8px' }} />
                  <div className="skeleton" style={{ height: '16px', width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && colorways.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3 className="empty-state__title">No Colorways Yet</h3>
            <p className="empty-state__text">
              Add your first colorway for {designCode} by tapping the + button below.
            </p>
          </div>
        )}

        {/* No search results */}
        {!isLoading && colorways.length > 0 && filteredColorways.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <h3 className="empty-state__title">No Results</h3>
            <p className="empty-state__text">No colorways match &quot;{globalSearchTerm}&quot;</p>
          </div>
        )}

        {/* Colorway Cards */}
        {!isLoading && filteredColorways.length > 0 && (
          <div className="colorway-list">
            {filteredColorways.map(cw => (
              <div key={cw._id} className={`colorway-card ${isPrintTC ? 'colorway-card--compact' : ''}`}>
                {/* Hero Image */}
                {(!isPrintTC || cw.photos?.[0]) && (
                  <div
                    className={`colorway-card__hero ${!cw.photos?.[0] ? 'colorway-card__hero--empty' : ''}`}
                    onClick={() => {
                      if (cw.photos?.[0]?.url) setExpandedPhoto(cw.photos[0].url)
                    }}
                    style={{ cursor: cw.photos?.[0] ? 'pointer' : 'default' }}
                  >
                    {cw.photos?.[0] ? (
                      <>
                        <img
                          src={getOptimizedImageUrl(cw.photos[0].url, { width: 520, quality: 'auto' })}
                          alt={cw.fullCode}
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="colorway-card__zoom-hint" title="Tap to enlarge">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                        </span>
                      </>
                    ) : (
                      <div className="colorway-card__placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>No photo added</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Body */}
                <div className="colorway-card__body">
                  <h3 className="colorway-card__code">{cw.fullCode}</h3>

                  {/* Location Badge */}
                  {cw.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, letterSpacing: '0.01em' }}>{cw.location}</span>
                    </div>
                  )}

                  {cw.breakdown && cw.breakdown.length > 0 ? (
                    <div className="colorway-card__breakdowns">
                      {cw.breakdown.map(item => (
                        <div key={item.id} className="colorway-card__quantity" style={{ marginTop: '8px' }}>
                          <span className="colorway-card__quantity-label">{item.label}:</span>
                          <div className="colorway-card__quantity-controls">
                            <button
                              className="colorway-card__qty-btn"
                              onClick={() => handleQuantityDelta(cw, -1, item.id, item.label)}
                              type="button"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span
                              className="colorway-card__quantity-value"
                              onClick={() => {
                                setDirectCountTarget({
                                  cw,
                                  subVariantId: item.id,
                                  currentQty: item.quantity,
                                  label: `${cw.fullCode} (${item.label})`,
                                })
                                setDirectCountInput(String(item.quantity))
                              }}
                              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--color-primary)' }}
                              title="Click to type exact count or bulk arrival"
                            >
                              {item.quantity}
                            </span>
                            <button
                              className="colorway-card__qty-btn"
                              onClick={() => handleQuantityDelta(cw, 1, item.id, item.label)}
                              type="button"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="colorway-card__quantity" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', opacity: 0.8 }}>
                        <span className="colorway-card__quantity-label">Total in Stock:</span>
                        <span className="colorway-card__quantity-value">{cw.quantityAvailable} {cw.quantityAvailable === 1 ? 'bale' : 'bales'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="colorway-card__quantity">
                      <span className="colorway-card__quantity-label">In Stock:</span>
                      <div className="colorway-card__quantity-controls">
                        <button
                          className="colorway-card__qty-btn"
                          onClick={() => handleQuantityDelta(cw, -1)}
                          type="button"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span
                          className="colorway-card__quantity-value"
                          onClick={() => {
                            setDirectCountTarget({
                              cw,
                              currentQty: cw.quantityAvailable,
                              label: cw.fullCode,
                            })
                            setDirectCountInput(String(cw.quantityAvailable))
                          }}
                          style={{ cursor: 'pointer', borderBottom: '1px dashed var(--color-primary)' }}
                          title="Click to type exact count or bulk arrival"
                        >
                          {cw.quantityAvailable}
                        </span>
                        <button
                          className="colorway-card__qty-btn"
                          onClick={() => handleQuantityDelta(cw, 1)}
                          type="button"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}


                  {/* Photo Thumbnails */}
                  {cw.photos && cw.photos.length > 1 && (
                    <div className="colorway-card__photos">
                      {cw.photos.map((photo, i) => (
                        <div
                          key={photo.publicId || i}
                          className="colorway-card__photo-thumb"
                          onClick={() => setExpandedPhoto(photo.url)}
                        >
                          <img
                            src={getOptimizedImageUrl(photo.url, { width: 140, quality: 'auto' })}
                            alt={`${cw.fullCode} photo ${i + 1}`}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="colorway-card__footer">
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => addToSale(cw)}
                      style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      type="button"
                      title="Add to combined customer sale receipt"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        <path d="M3 6h18" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                      <span>+ Receipt</span>
                    </button>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => setEditingColorway(cw)}
                      type="button"
                      style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeleteTarget(cw)}
                      type="button"
                      style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FAB - Add Colorway */}
      <button
        className="fab"
        onClick={() => setShowModal(true)}
        title="Add Colorway"
        type="button"
      >
        +
      </button>

      {/* Add Modal */}
      <ColorwayModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleAddColorway}
      />

      {/* Edit Modal */}
      {editingColorway && (
        <ColorwayModal
          isOpen={true}
          onClose={() => setEditingColorway(null)}
          onSave={handleEditColorway}
          initialData={{
            fullCode: editingColorway.fullCode,
            photos: editingColorway.photos,
            quantityAvailable: editingColorway.quantityAvailable,
            breakdown: editingColorway.breakdown,
            location: editingColorway.location,
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteColorway}
        title="Delete Colorway?"
        message={`Are you sure you want to delete "${deleteTarget?.fullCode}"? This cannot be undone.`}
        isLoading={isDeleting}
      />

      {/* Expanded Photo Viewer */}
      {expandedPhoto && (
        <div
          className="modal-overlay"
          onClick={() => setExpandedPhoto(null)}
          style={{ cursor: 'zoom-out' }}
        >
          <img
            src={expandedPhoto}
            alt="Expanded view"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-xl)',
            }}
          />
        </div>
      )}

      {/* Edit Design Code Modal */}
      {designCodeObj && (
        <DesignCodeModal
          isOpen={showEditDesignModal}
          onClose={() => setShowEditDesignModal(false)}
          onSave={handleEditDesignCode}
          currentCategory={designCodeObj.category}
          initialData={{
            code: designCodeObj.code,
            category: designCodeObj.category,
            thumbnailUrl: designCodeObj.thumbnailUrl,
            thumbnailPublicId: designCodeObj.thumbnailPublicId,
          }}
        />
      )}

      {/* Delete Design Code Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDesignConfirm}
        onClose={() => setShowDeleteDesignConfirm(false)}
        onConfirm={handleDeleteDesignCode}
        title="Delete Design Code?"
        message={`Are you sure you want to delete "${designCode}"? This will also delete ALL colorways under it.`}
        isLoading={isDeleting}
      />

      {/* 1-tap categorization & Undo Toast */}
      <Toast toast={activeToast} onDismiss={() => setActiveToast(null)} />

      {/* Which colour is being sold? */}
      {pickColourFor && (
        <div className="modal-overlay" onClick={() => setPickColourFor(null)} style={{ zIndex: 10000 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '92%' }}>
            <div className="modal__header">
              <h3 className="modal__title">Which colour of {pickColourFor.fullCode}?</h3>
              <button className="modal__close-btn" onClick={() => setPickColourFor(null)} type="button" aria-label="Close">✕</button>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(pickColourFor.breakdown || []).filter(b => b.quantity > 0).map(b => (
                <button
                  key={b.id}
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => addToSale(pickColourFor, b)}
                  style={{ minHeight: '52px', fontSize: '16px', fontWeight: 700, justifyContent: 'space-between', display: 'flex', alignItems: 'center', padding: '0 16px' }}
                >
                  <span>{b.label}</span>
                  <span style={{ fontWeight: 500, color: '#6b7280' }}>{b.quantity} in stock</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Direct Count / Bulk Arrival Modal */}
      {directCountTarget && (
        <div
          className="modal-overlay"
          onClick={() => setDirectCountTarget(null)}
          style={{ zIndex: 1000 }}
        >
          <div
            className="direct-count-modal"
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>
              Set Count for {directCountTarget.label}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Current stock: <strong>{directCountTarget.currentQty}</strong>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Exact Total in Stock:
              </label>
              <input
                type="number"
                min="0"
                value={directCountInput}
                onChange={e => setDirectCountInput(e.target.value)}
                autoFocus
                className="form-group__input"
                style={{ fontSize: '18px', fontWeight: 700, padding: '10px 14px' }}
                placeholder="e.g. 50"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[+5, +10, +20, +50].map(add => (
                <button
                  key={add}
                  type="button"
                  className="btn btn--sm btn--secondary"
                  onClick={() => {
                    const base = parseInt(directCountInput, 10) || 0
                    setDirectCountInput(String(base + add))
                  }}
                >
                  +{add} Bulk
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setDirectCountTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleDirectCountSave}
              >
                Save Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Multi-Item Sale Basket */}
      <SaleBasketFloating />

      {/* Staff Guide Modal */}
      <StaffGuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
    </>
  )
}
