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
  }) => void
  initialData?: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
    breakdown?: { id: string; label: string; quantity: number }[]
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
  const [breakdown, setBreakdown] = useState<{ id: string; label: string; quantity: number }[]>(
    initialData?.breakdown || []
  )
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
        quantityAvailable: parseInt(quantity) || 0,
        breakdown,
      })
      onClose()
    } catch {
      setError('Failed to save')
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
                        const newBreakdown = [...breakdown]
                        newBreakdown[index].label = e.target.value
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
                        const newBreakdown = [...breakdown]
                        newBreakdown[index].quantity = parseInt(e.target.value) || 0
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
