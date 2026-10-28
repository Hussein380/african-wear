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
                <h2 className="main-content__title">{activeCategory}</h2>
                <p className="main-content__meta">
                  <strong>{filteredDesignCodes.length}</strong> {filteredDesignCodes.length === 1 ? 'Design' : 'Designs'} • <strong>{filteredDesignCodes.reduce((sum, item) => sum + (item.colorwayCount || 0), 0)}</strong> Styles • <strong>{filteredDesignCodes.reduce((sum, item) => sum + (item.totalStock !== undefined ? item.totalStock : (item.colorwayCount || 0)), 0)}</strong> Pieces in stock
                </p>
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
        {!isLoading && filteredDesignCodes.length > 0 && (
          <div className={`design-grid ${activeCategory === 'PrintTC' ? 'design-grid--compact' : ''}`}>
            {filteredDesignCodes.map(dc => {
              const isPrintTC = activeCategory === 'PrintTC'
              const stockPieces = dc.totalStock !== undefined ? dc.totalStock : (dc.colorwayCount || 0)
              const stylesCount = dc.colorwayCount || 0
              return (
                <div
                  key={dc._id}
                  className={`design-tile ${isPrintTC ? 'design-tile--compact' : ''}`}
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
                      ✏️
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
                      🗑️
                    </button>
                  </div>

                  {(!isPrintTC || dc.thumbnailUrl) && (
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
                        <div className="design-tile__placeholder">
                          <img src="/mandera-logo.png" alt="Placeholder" style={{ width: '60%', height: '60%', objectFit: 'contain', opacity: 0.25 }} />
                        </div>
                      )}
                      <span className="design-tile__badge" title={`${stockPieces} pieces in stock`}>
                        {stockPieces}
                      </span>
                    </div>
                  )}

                  <span className="design-tile__code">{dc.code}</span>
                  <span className="design-tile__sub">
                    {stockPieces} in stock • {stylesCount} {stylesCount === 1 ? 'style' : 'styles'}
                  </span>

                  {isPrintTC && !dc.thumbnailUrl && (
                    <span style={{ order: 3, padding: '0 8px', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                      {stockPieces} in stock
                    </span>
                  )}
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
