'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar, { ViewState } from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'
import DesignCodeModal from '@/components/DesignCodeModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import { Category, DesignCode } from '@/types'
import { CacheKeys, getCached, getCacheAge, setCached, bustCache, prefetchColorways } from '@/lib/cache'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import SaleBasketFloating from '@/components/SaleBasketFloating'
import StaffGuideModal from '@/components/StaffGuideModal'

function ClassifyPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [designCodes, setDesignCodes] = useState<DesignCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCode, setEditingCode] = useState<DesignCode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DesignCode | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  const urlCat = searchParams.get('category') as ViewState
  const activeCategory = urlCat || 'Dashboard'

  // Persist to session storage so returning to /classify remembers the view
  useEffect(() => {
    if (activeCategory !== 'Dashboard') {
      sessionStorage.setItem('classify_last_category', activeCategory)
    }
  }, [activeCategory])

  // If no category in URL, try restoring from session storage
  useEffect(() => {
    if (!urlCat) {
      const saved = sessionStorage.getItem('classify_last_category') as ViewState
      if (saved && saved !== 'Dashboard') {
        router.replace(`/classify?category=${saved}`)
      }
    }
  }, [urlCat, router])

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

  const handleCategoryChange = (cat: ViewState) => {
    router.push(`/classify?category=${cat}`)
  }

  const fetchDesignCodes = useCallback(async (isBackgroundRefresh = false) => {
    if (activeCategory === 'Dashboard') return
    if (!isBackgroundRefresh) setIsLoading(true)
    const cacheKey = CacheKeys.designCodes(activeCategory)
    try {
      // SWR: serve from cache instantly, then refresh in background
      if (!isBackgroundRefresh) {
        const cached = getCached<DesignCode[]>(cacheKey)
        if (cached) {
          setDesignCodes(cached)
          setIsLoading(false)
          // If older than 15s, also trigger a background refresh
          if (getCacheAge(cacheKey) > 15_000) fetchDesignCodes(true)
          return
        }
      }

      const res = await fetch(`/api/design-codes?category=${activeCategory}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setDesignCodes(data)
        setCached(cacheKey, data)
      }
    } catch (error) {
      console.error('Failed to fetch design codes:', error)
    } finally {
      if (!isBackgroundRefresh) setIsLoading(false)
    }
  }, [activeCategory])

  useEffect(() => {
    fetchDesignCodes()
  }, [fetchDesignCodes])

  const handleAddDesignCode = async (data: {
    code: string
    category: string
    thumbnailUrl: string
    thumbnailPublicId: string
  }) => {
    const res = await fetch('/api/design-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      bustCache(CacheKeys.designCodes(activeCategory))
      fetchDesignCodes()
    } else {
      const err = await res.json()
      throw new Error(err.error)
    }
  }

  const handleEditDesignCode = async (data: {
    code: string
    category: string
    thumbnailUrl: string
    thumbnailPublicId: string
  }) => {
    if (!editingCode) return
    const res = await fetch(`/api/design-codes/${editingCode._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setEditingCode(null)
      bustCache(CacheKeys.designCodes(activeCategory))
      fetchDesignCodes()
    }
  }

  const handleDeleteDesignCode = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/design-codes/${deleteTarget._id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDeleteTarget(null)
        bustCache(CacheKeys.designCodes(activeCategory))
        fetchDesignCodes()
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  const filteredDesignCodes = designCodes.filter(dc => {
    if (!globalSearchTerm.trim()) return true
    return dc.code.toLowerCase().includes(globalSearchTerm.toLowerCase())
  })

  return (
    <>
      {/* App Bar */}
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
            <h1 className="appbar__title">Classify</h1>
            <p className="appbar__subtitle">Mandera African Wear</p>
          </div>
        </div>
        <div className="appbar__right">
          <ExpandingSearchDock onSearch={(val) => setGlobalSearchTerm(val)} placeholder="Search designs..." />
          <button
            className="appbar__action-btn"
            onClick={() => setIsGuideOpen(true)}
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
          <button className="appbar__action-btn" onClick={() => fetchDesignCodes()} type="button" title="Refresh">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
            <span className="desktop-only">Refresh</span>
          </button>
          <button className="appbar__action-btn" onClick={handleLogout} type="button" title="Sign Out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" x2="9" y1="12" y2="12"/>
            </svg>
            <span className="desktop-only">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      <main className="main-content">
        {activeCategory === 'Dashboard' ? (
          <Dashboard
            onCategoryChange={handleCategoryChange}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        ) : (
          <>
            <div className="main-content__header">
              <div>
                <h2 className="main-content__title">
                  {activeCategory === 'PrintedC' ? 'Printed C' : activeCategory === 'PrintedP' ? 'Printed P' : activeCategory === 'PrintTC' ? 'Print TC' : activeCategory}
                </h2>
                <div className="main-content__meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span>
                    <strong>{filteredDesignCodes.length}</strong> {filteredDesignCodes.length === 1 ? 'Design' : 'Designs'}
                  </span>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span>
                    <strong>{filteredDesignCodes.reduce((sum, item) => sum + (item.colorwayCount || 0), 0)}</strong> Colorway Styles
                  </span>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span style={{ background: 'rgba(91, 26, 62, 0.08)', color: '#5B1A3E', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    {filteredDesignCodes.reduce((sum, item) => sum + (item.totalStock !== undefined ? item.totalStock : (item.colorwayCount || 0)), 0)} Total Rolls in Store
                  </span>
                </div>
              </div>
            </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="design-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="design-tile skeleton-card" style={{ padding: 'var(--space-md)' }}>
                <div className="skeleton skeleton--tile" style={{ width: '100%', aspectRatio: '1/1', borderRadius: '12px' }} />
                <div className="skeleton skeleton--text" style={{ width: '60%', marginTop: '12px' }} />
                <div className="skeleton skeleton--text" style={{ width: '40%', marginTop: '6px' }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && designCodes.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/>
                <path d="M9 3v18"/>
                <path d="M15 3v18"/>
              </svg>
            </div>
            <h3 className="empty-state__title">No Design Codes Yet</h3>
            <p className="empty-state__text">
              Add your first design code by tapping the + button below.
            </p>
          </div>
        )}

        {/* Search No Results */}
        {!isLoading && designCodes.length > 0 && filteredDesignCodes.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </div>
            <h3 className="empty-state__title">No Results Found</h3>
            <p className="empty-state__text">No design codes match your search. Try a different keyword.</p>
          </div>
        )}

        {/* Design Code Grid */}
        {/* Design Code Grid */}
        {!isLoading && filteredDesignCodes.length > 0 && (
          <div className="design-grid">
            {filteredDesignCodes.map(dc => {
              const stockPieces = dc.totalStock !== undefined ? dc.totalStock : (dc.colorwayCount || 0)
              const stylesCount = dc.colorwayCount || 0
              const isOutOfStock = stockPieces === 0

              return (
                <div
                  key={dc._id}
                  className="design-tile"
                  onClick={() => router.push(`/classify/${dc._id}`)}
                  onPointerEnter={() => {
                    router.prefetch(`/classify/${dc._id}`)
                    prefetchColorways(dc._id)
                  }}
                  onTouchStart={() => {
                    router.prefetch(`/classify/${dc._id}`)
                    prefetchColorways(dc._id)
                  }}
                >
                  <div className="design-tile__actions">
                    <button
                      className="design-tile__action-btn"
                      onClick={e => {
                        e.stopPropagation()
                        setEditingCode(dc)
                      }}
                      title="Edit Design Code"
                      type="button"
                      aria-label="Edit"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="design-tile__action-btn design-tile__action-btn--delete"
                      onClick={e => {
                        e.stopPropagation()
                        setDeleteTarget(dc)
                      }}
                      title="Delete Design Code"
                      type="button"
                      aria-label="Delete"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </div>

                  <div className="design-tile__image-wrapper">
                    {dc.thumbnailUrl ? (
                      <img
                        className="design-tile__image"
                        src={getOptimizedImageUrl(dc.thumbnailUrl, { width: 340, quality: 'auto' })}
                        alt={dc.code}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div
                        className="design-tile__placeholder"
                        style={{
                          background: 'linear-gradient(135deg, #FAF5EB 0%, #F3EAE0 60%, #E9DECE 100%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          width: '100%',
                          height: '100%',
                          opacity: 1,
                        }}
                      >
                        <div
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            background: 'rgba(91, 26, 62, 0.08)',
                            border: '2px solid rgba(212, 175, 55, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            fontWeight: 900,
                            color: '#5B1A3E',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {dc.code.slice(0, 3)}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#78350F',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            background: 'rgba(212, 175, 55, 0.15)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                          }}
                        >
                          African Fabric
                        </span>
                      </div>
                    )}

                    <span
                      className="design-tile__badge"
                      style={{
                        background: isOutOfStock ? '#dc2626' : 'rgba(91, 26, 62, 0.95)',
                      }}
                      title={`${stockPieces} pieces in stock`}
                    >
                      {stockPieces} {stockPieces === 1 ? 'pc' : 'pcs'}
                    </span>
                  </div>

                  <span className="design-tile__code">{dc.code}</span>
                  <span className="design-tile__sub">
                    {stockPieces} in stock • {stylesCount} {stylesCount === 1 ? 'style' : 'styles'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        </>
      )}
      </main>

      {/* FAB - Add Design Code (Only show if not on Dashboard) */}
      {activeCategory !== 'Dashboard' && (
        <button
          className="fab"
          onClick={() => setShowModal(true)}
          title="Add Design Code"
          type="button"
        >
          +
        </button>
      )}

      <DesignCodeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleAddDesignCode}
        currentCategory={activeCategory}
      />

      {/* Edit Modal */}
      {editingCode && (
        <DesignCodeModal
          isOpen={true}
          onClose={() => setEditingCode(null)}
          onSave={handleEditDesignCode}
          currentCategory={activeCategory}
          initialData={{
            code: editingCode.code,
            category: editingCode.category,
            thumbnailUrl: editingCode.thumbnailUrl,
            thumbnailPublicId: editingCode.thumbnailPublicId,
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDesignCode}
        title="Delete Design Code?"
        message={`Are you sure you want to delete "${deleteTarget?.code}"? This will also delete all colorways under it.`}
        isLoading={isDeleting}
      />

      {/* Floating Multi-Item Sale Basket */}
      <SaleBasketFloating />

      {/* Staff Guide Modal */}
      <StaffGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  )
}

export default function ClassifyPage() {
  return (
    <Suspense fallback={null}>
      <ClassifyPageInner />
    </Suspense>
  )
}
