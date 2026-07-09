'use client'

import { useState } from 'react'
import ImageUploader from './ImageUploader'

interface DesignCodeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    code: string
    category: string
    thumbnailUrl: string
    thumbnailPublicId: string
  }) => void
  initialData?: {
    code: string
    category: string
    thumbnailUrl: string
    thumbnailPublicId: string
  }
  currentCategory: string
}

export default function DesignCodeModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentCategory,
}: DesignCodeModalProps) {
  const [code, setCode] = useState(initialData?.code || '')
  const [category, setCategory] = useState(initialData?.category || currentCategory)
  const [images, setImages] = useState<{ url: string; publicId: string }[]>(
    initialData?.thumbnailUrl
      ? [{ url: initialData.thumbnailUrl, publicId: initialData.thumbnailPublicId }]
      : []
  )
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Design code is required')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        code: code.trim().toUpperCase(),
        category,
        thumbnailUrl: images[0]?.url || '',
        thumbnailPublicId: images[0]?.publicId || '',
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
            {initialData ? 'Edit Design Code' : 'Add Design Code'}
          </h3>
          <button className="modal__close-btn" onClick={onClose} type="button">✕</button>
        </div>

        <div className="modal__body">
          <div className="form-group">
            <label className="form-group__label">Design Code *</label>
            <input
              type="text"
              className={`form-group__input ${error ? 'form-group__input--error' : ''}`}
              placeholder="e.g. ANFX"
              value={code}
              onChange={e => {
                setCode(e.target.value)
                setError('')
              }}
              autoFocus
            />
            {error && <p className="form-group__error">{error}</p>}
          </div>

          <div className="form-group">
            <label className="form-group__label">Category</label>
            <select
              className="form-group__select"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="PrintedC">PrintedC</option>
              <option value="PrintedP">PrintedP</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-group__label">Thumbnail Photo</label>
            <ImageUploader
              images={images}
              onImagesChange={setImages}
              multiple={false}
              folder="mandera/design-codes"
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
