'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import ColorwayModal from '@/components/ColorwayModal'
import DesignCodeModal from '@/components/DesignCodeModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Colorway, DesignCode } from '@/types'

export default function DesignCodeDetailPage({
  params,
}: {
  params: Promise<{ designCodeId: string }>
}) {
  const { designCodeId } = use(params)
  const [colorways, setColorways] = useState<Colorway[]>([])
  const [designCode, setDesignCode] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingColorway, setEditingColorway] = useState<Colorway | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Colorway | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  
  // Design Code specific state
  const [designCodeObj, setDesignCodeObj] = useState<DesignCode | null>(null)
  const [showEditDesignModal, setShowEditDesignModal] = useState(false)
  const [showDeleteDesignConfirm, setShowDeleteDesignConfirm] = useState(false)
  
  const router = useRouter()

  const fetchColorways = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/colorways?designCodeId=${designCodeId}&t=${new Date().getTime()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      if (res.ok) {
        const data = await res.json()
        setColorways(data)
      }
    } catch (error) {
      console.error('Failed to fetch colorways:', error)
    } finally {
      setIsLoading(false)
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
  }) => {
    const res = await fetch('/api/colorways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, designCodeId }),
    })
    if (res.ok) {
      fetchColorways()
    }
  }

  const handleEditColorway = async (data: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
    breakdown?: { id: string; label: string; quantity: number }[]
  }) => {
    if (!editingColorway) return
    const res = await fetch(`/api/colorways/${editingColorway._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setEditingColorway(null)
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
        fetchColorways()
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleQuantityChange = async (colorwayId: string, newQuantity: number) => {
    if (newQuantity < 0) return
    try {
      const res = await fetch(`/api/colorways/${colorwayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityAvailable: newQuantity }),
      })
      if (res.ok) {
        setColorways(prev =>
          prev.map(cw =>
            cw._id === colorwayId ? { ...cw, quantityAvailable: newQuantity } : cw
          )
        )
      }
    } catch (error) {
      console.error('Failed to update quantity:', error)
    }
  }

  const handleBreakdownQuantityChange = async (colorway: Colorway, breakdownId: string, newQuantity: number) => {
    if (newQuantity < 0 || !colorway.breakdown) return
    try {
      const newBreakdown = colorway.breakdown.map(item => 
        item.id === breakdownId ? { ...item, quantity: newQuantity } : item
      )
      const newTotalQuantity = newBreakdown.reduce((sum, item) => sum + item.quantity, 0)

      const res = await fetch(`/api/colorways/${colorway._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityAvailable: newTotalQuantity, breakdown: newBreakdown }),
      })
      if (res.ok) {
        setColorways(prev =>
          prev.map(cw =>
            cw._id === colorway._id ? { ...cw, quantityAvailable: newTotalQuantity, breakdown: newBreakdown } : cw
          )
        )
      }
    } catch (error) {
      console.error('Failed to update breakdown quantity:', error)
    }
  }

  return (
    <>
      {/* App Bar */}
      <header className="appbar">
        <div className="appbar__left">
          <button
            className="appbar__back-btn"
            onClick={() => router.push('/classify')}
            type="button"
          >
            ←
          </button>
          <div>
            <h1 className="appbar__title">{designCode || 'Loading...'} Colorways</h1>
            <p className="appbar__subtitle">{colorways.length} variant{colorways.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="appbar__right">
          <button className="appbar__action-btn" onClick={() => setShowEditDesignModal(true)} type="button" title="Edit Design">
            ✏️
          </button>
          <button className="appbar__action-btn" onClick={() => setShowDeleteDesignConfirm(true)} type="button" title="Delete Design">
            🗑️
          </button>
          <button className="appbar__action-btn" onClick={fetchColorways} type="button" title="Refresh">
            ↻
          </button>
        </div>
      </header>

      {/* Main Content (no sidebar on detail page) */}
      <main className="main-content" style={{ marginLeft: 0 }}>
        {/* Loading */}
        {isLoading && (
          <div className="colorway-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="colorway-card">
                <div className="skeleton" style={{ aspectRatio: '4/3' }} />
                <div style={{ padding: 'var(--space-md)' }}>
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
            <div className="empty-state__icon">🎨</div>
            <h3 className="empty-state__title">No Colorways Yet</h3>
            <p className="empty-state__text">
              Add your first colorway for {designCode} by tapping the + button below.
            </p>
          </div>
        )}

        {/* Colorway Cards */}
        {!isLoading && colorways.length > 0 && (
          <div className="colorway-list">
            {colorways.map(cw => (
              <div key={cw._id} className="colorway-card">
                {/* Hero Image */}
                <div
                  className="colorway-card__hero"
                  onClick={() => {
                    if (cw.photos?.[0]?.url) setExpandedPhoto(cw.photos[0].url)
                  }}
                  style={{ cursor: cw.photos?.[0] ? 'pointer' : 'default' }}
                >
                  {cw.photos?.[0] ? (
                    <img src={cw.photos[0].url} alt={cw.fullCode} />
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      fontSize: '48px',
                      opacity: 0.2,
                    }}>
                      🖼️
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="colorway-card__body">
                  <h3 className="colorway-card__code">{cw.fullCode}</h3>

                  {cw.breakdown && cw.breakdown.length > 0 ? (
                    <div className="colorway-card__breakdowns">
                      {cw.breakdown.map(item => (
                        <div key={item.id} className="colorway-card__quantity" style={{ marginTop: '8px' }}>
                          <span className="colorway-card__quantity-label">{item.label}:</span>
                          <div className="colorway-card__quantity-controls">
                            <button
                              className="colorway-card__qty-btn"
                              onClick={() => handleBreakdownQuantityChange(cw, item.id, item.quantity - 1)}
                              type="button"
                            >
                              −
                            </button>
                            <span className="colorway-card__quantity-value">
                              {item.quantity}
                            </span>
                            <button
                              className="colorway-card__qty-btn"
                              onClick={() => handleBreakdownQuantityChange(cw, item.id, item.quantity + 1)}
                              type="button"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="colorway-card__quantity" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', opacity: 0.8 }}>
                        <span className="colorway-card__quantity-label">Total in Stock:</span>
                        <span className="colorway-card__quantity-value">{cw.quantityAvailable}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="colorway-card__quantity">
                      <span className="colorway-card__quantity-label">In Stock:</span>
                      <div className="colorway-card__quantity-controls">
                        <button
                          className="colorway-card__qty-btn"
                          onClick={() => handleQuantityChange(cw._id, cw.quantityAvailable - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <span className="colorway-card__quantity-value">
                          {cw.quantityAvailable}
                        </span>
                        <button
                          className="colorway-card__qty-btn"
                          onClick={() => handleQuantityChange(cw._id, cw.quantityAvailable + 1)}
                          type="button"
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
                          <img src={photo.url} alt={`${cw.fullCode} photo ${i + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="colorway-card__footer">
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => setEditingColorway(cw)}
                      type="button"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeleteTarget(cw)}
                      type="button"
                    >
                      🗑️ Delete
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
    </>
  )
}
