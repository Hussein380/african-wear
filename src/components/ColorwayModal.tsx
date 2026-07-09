'use client'

import { useState } from 'react'
import ImageUploader from './ImageUploader'

interface ColorwayModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
  }) => void
  initialData?: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
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
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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
            <label className="form-group__label">Available Quantity</label>
            <input
              type="number"
              className="form-group__input"
              min="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
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
