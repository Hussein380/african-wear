'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar, { ViewState } from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'
import DesignCodeModal from '@/components/DesignCodeModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import SearchOverlay from '@/components/SearchOverlay'
import { Category, DesignCode } from '@/types'

export default function ClassifyPage() {
  const searchParams = useSearchParams()
  // Always start with Dashboard to match server render, then hydrate from sessionStorage/URL
  const [activeCategory, setActiveCategory] = useState<ViewState>('Dashboard')
  const [designCodes, setDesignCodes] = useState<DesignCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCode, setEditingCode] = useState<DesignCode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DesignCode | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')
  const router = useRouter()

  // After mount: restore last category from URL param or sessionStorage (client-only, avoids hydration mismatch)
  useEffect(() => {
    const urlCat = searchParams.get('category') as ViewState
    if (urlCat) {
      setActiveCategory(urlCat)
      return
    }
    const saved = sessionStorage.getItem('classify_last_category') as ViewState
    if (saved && saved !== 'Dashboard') {
      setActiveCategory(saved)
    }
  }, [searchParams])

  // Persist category so Back button restores it
  const handleCategoryChange = (cat: ViewState) => {
    setActiveCategory(cat)
    sessionStorage.setItem('classify_last_category', cat)
  }

  const fetchDesignCodes = useCallback(async (isBackgroundRefresh = false) => {
    if (activeCategory === 'Dashboard') return
    if (!isBackgroundRefresh) setIsLoading(true)
    try {
      // Check sessionStorage cache first (set by sidebar hover prefetch)
      const cacheKey = `prefetch_${activeCategory}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached && !isBackgroundRefresh) {
        try {
          const { data, ts } = JSON.parse(cached)
          const age = Date.now() - ts
          if (age < 60_000) {
            setDesignCodes(data)
            setIsLoading(false)
            // Refresh in background if older than 15s
            if (age > 15_000) fetchDesignCodes(true)
            return
          }
        } catch { /* ignore bad cache */ }
      }

      const res = await fetch(`/api/design-codes?category=${activeCategory}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      if (res.ok) {
        const data = await res.json()
        setDesignCodes(data)
        // Update cache after fresh fetch
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }))
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
          <button className="appbar__action-btn" onClick={() => setIsSearchOpen(true)} type="button" aria-label="Search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button className="appbar__action-btn" onClick={fetchDesignCodes} type="button">
            ↻ Refresh
          </button>
          <button className="appbar__action-btn" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="main-content">
        {activeCategory === 'Dashboard' ? (
          <Dashboard onCategoryChange={handleCategoryChange} />
        ) : (
          <>
            <div className="main-content__header">
              <h2 className="main-content__title">{activeCategory}</h2>
            </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="design-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-md)' }}>
                <div className="skeleton skeleton--tile" style={{ width: '100%' }} />
                <div className="skeleton skeleton--text" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && designCodes.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">🧵</div>
            <h3 className="empty-state__title">No Design Codes Yet</h3>
            <p className="empty-state__text">
              Add your first design code by tapping the + button below.
            </p>
          </div>
        )}

        {/* Search No Results */}
        {!isLoading && designCodes.length > 0 && filteredDesignCodes.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <h3 className="empty-state__title">No Results Found</h3>
            <p className="empty-state__text">No design codes match your search. Try a different keyword.</p>
          </div>
        )}

        {/* Design Code Grid */}
        {!isLoading && filteredDesignCodes.length > 0 && (
          <div className="design-grid">
            {filteredDesignCodes.map(dc => (
              <div
                key={dc._id}
                className="design-tile"
                onClick={() => router.push(`/classify/${dc._id}`)}
              >
                <div className="design-tile__actions">
                  <button
                    className="design-tile__action-btn"
                    onClick={e => {
                      e.stopPropagation()
                      setEditingCode(dc)
                    }}
                    title="Edit"
                    type="button"
                  >
                    ✏️
                  </button>
                  <button
                    className="design-tile__action-btn design-tile__action-btn--delete"
                    onClick={e => {
                      e.stopPropagation()
                      setDeleteTarget(dc)
                    }}
                    title="Delete"
                    type="button"
                  >
                    🗑️
                  </button>
                </div>

                <div className="design-tile__image-wrapper">
                  {dc.thumbnailUrl ? (
                    <img
                      className="design-tile__image"
                      src={dc.thumbnailUrl}
                      alt={dc.code}
                    />
                  ) : (
                    <div className="design-tile__placeholder">
                      <img src="/mandera-logo.png" alt="Placeholder" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.3 }} />
                    </div>
                  )}
                  <span className="design-tile__badge">
                    {dc.colorwayCount || 0}
                  </span>
                </div>

                <span className="design-tile__code">{dc.code}</span>
              </div>
            ))}
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
      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={() => { setIsSearchOpen(false); setGlobalSearchTerm('') }} 
        onSearch={(term) => setGlobalSearchTerm(term)}
      />
    </>
  )
}
