'use client'

import React, { useState } from 'react'
import ImageUploader from './ImageUploader'

interface ColorwayModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
    breakdown?: { id: string; label: string; quantity: number }[]
    location?: string
  }) => void
  initialData?: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
    breakdown?: { id: string; label: string; quantity: number }[]
    location?: string
  }
}

export default function ColorwayModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: ColorwayModalProps) {
  const [fullCode, setFullCode] = useState(initialData?.fullCode || '')
  const [photos, setPhotos] = useState<{ url: string; publicId: string }[]>(
    initialData?.photos || []
  )
  const [quantity, setQuantity] = useState(initialData?.quantityAvailable?.toString() || '0')
  // Copy the colours so typing never changes the item shown on the page behind the form
  const [breakdown, setBreakdown] = useState<{ id: string; label: string; quantity: number }[]>(
    () => (initialData?.breakdown || []).map(b => ({ ...b }))
  )
  const [location, setLocation] = useState(initialData?.location || '')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Auto-sum quantity when breakdown changes
  React.useEffect(() => {
    if (breakdown.length > 0) {
      const sum = breakdown.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
      setQuantity(sum.toString())
    }
  }, [breakdown])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!fullCode.trim()) {
      setError('Colorway code is required')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        fullCode: fullCode.trim().toUpperCase(),
        photos,
        quantityAvailable: Math.max(0, parseInt(quantity) || 0),
        breakdown,
        location: location.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">
            {initialData ? 'Edit Colorway' : 'Add Colorway'}
          </h3>
          <button className="modal__close-btn" onClick={onClose} type="button">✕</button>
        </div>

        <div className="modal__body">
          <div className="form-group">
            <label className="form-group__label">Colorway Code *</label>
            <input
              type="text"
              className={`form-group__input ${error ? 'form-group__input--error' : ''}`}
              placeholder="e.g. ANB250818K"
              value={fullCode}
              onChange={e => {
                setFullCode(e.target.value)
                setError('')
              }}
              autoFocus
            />
            {error && <p className="form-group__error">{error}</p>}
          </div>

          <div className="form-group">
            <label className="form-group__label">Available Quantity (Total)</label>
            <input
              type="number"
              className="form-group__input"
              min="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              disabled={breakdown.length > 0}
              title={breakdown.length > 0 ? "Auto-calculated from Different Colors below" : ""}
            />
          </div>

          <div className="form-group">
            <label className="form-group__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Different Colors / Variations
              <button 
                type="button" 
                onClick={() => setBreakdown([...breakdown, { id: Date.now().toString(), label: '', quantity: 0 }])}
                style={{ background: 'var(--color-primary)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                + Add
              </button>
            </label>
            {breakdown.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Add specific colors or variations to automatically track their individual stock.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {breakdown.map((item, index) => (
                  <div key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="form-group__input" 
                      placeholder="e.g. Red, Blue, Size M" 
                      style={{ flex: 2 }}
                      value={item.label}
                      onChange={e => {
                        const newBreakdown = breakdown.map((b, i) => (i === index ? { ...b, label: e.target.value } : b))
                        setBreakdown(newBreakdown)
                      }}
                    />
                    <input 
                      type="number" 
                      className="form-group__input" 
                      min="0"
                      style={{ flex: 1 }}
                      value={item.quantity}
                      onChange={e => {
                        const qty = Math.max(0, parseInt(e.target.value) || 0)
                        const newBreakdown = breakdown.map((b, i) => (i === index ? { ...b, quantity: qty } : b))
                        setBreakdown(newBreakdown)
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const newBreakdown = [...breakdown]
                        newBreakdown.splice(index, 1)
                        setBreakdown(newBreakdown)
                      }}
                      style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '16px' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shelf / Rack Location */}
          <div className="form-group" style={{
            background: 'var(--color-surface, #f9fafb)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border, #e5e7eb)'
          }}>
            <label className="form-group__label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>Shelf / Rack Location</span>
              <span style={{ fontWeight: 400, color: 'var(--color-text-secondary, #6b7280)', fontSize: '11px' }}>(Optional)</span>
            </label>
            <input
              type="text"
              className="form-group__input"
              placeholder="e.g. Rack A-1, Shelf 3, Main Showroom"
              value={location}
              onChange={e => setLocation(e.target.value)}
              style={{ fontSize: '13px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-group__label">Photos</label>
            <ImageUploader
              images={photos}
              onImagesChange={setPhotos}
              multiple={true}
              folder="mandera/colorways"
            />
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={isSaving}
            type="button"
          >
            {isSaving ? 'Saving...' : initialData ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
