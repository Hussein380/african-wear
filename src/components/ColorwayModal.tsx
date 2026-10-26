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
    buyingPrice?: number
    sellingPrice?: number
  }) => void
  initialData?: {
    fullCode: string
    photos: { url: string; publicId: string }[]
    quantityAvailable: number
    breakdown?: { id: string; label: string; quantity: number }[]
    buyingPrice?: number
    sellingPrice?: number
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
  const [buyingPrice, setBuyingPrice] = useState<string>(
    initialData?.buyingPrice !== undefined ? initialData.buyingPrice.toString() : ''
  )
  const [sellingPrice, setSellingPrice] = useState<string>(
    initialData?.sellingPrice !== undefined ? initialData.sellingPrice.toString() : ''
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
      const bVal = buyingPrice.trim() !== '' && !isNaN(Number(buyingPrice)) ? Number(buyingPrice) : undefined
      const sVal = sellingPrice.trim() !== '' && !isNaN(Number(sellingPrice)) ? Number(sellingPrice) : undefined

      await onSave({
        fullCode: fullCode.trim().toUpperCase(),
        photos,
        quantityAvailable: parseInt(quantity) || 0,
        breakdown,
        buyingPrice: bVal,
        sellingPrice: sVal,
      })
      onClose()
    } catch {
      setError('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const bPrice = parseFloat(buyingPrice) || 0
  const sPrice = parseFloat(sellingPrice) || 0

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

          {/* Pricing Section (100% Optional) */}
          <div className="form-group" style={{ 
            background: 'var(--color-surface, #f9fafb)', 
            padding: '12px', 
            borderRadius: '8px', 
            border: '1px solid var(--color-border, #e5e7eb)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-group__label" style={{ marginBottom: 0, fontWeight: 600 }}>
                Pricing <span style={{ fontWeight: 400, color: 'var(--color-text-secondary, #6b7280)', fontSize: '12px' }}>(Optional)</span>
              </label>
              {(buyingPrice || sellingPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    setBuyingPrice('')
                    setSellingPrice('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 500,
                    textDecoration: 'underline'
                  }}
                >
                  Clear / Remove Pricing
                </button>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', display: 'block', marginBottom: '4px' }}>
                  Buying Price (Cost)
                </span>
                <input
                  type="number"
                  className="form-group__input"
                  placeholder="e.g. 1500 (KES)"
                  min="0"
                  value={buyingPrice}
                  onChange={e => setBuyingPrice(e.target.value)}
                />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', display: 'block', marginBottom: '4px' }}>
                  Selling Price (Retail)
                </span>
                <input
                  type="number"
                  className="form-group__input"
                  placeholder="e.g. 2200 (KES)"
                  min="0"
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Dynamic Live Profit & Margin Indicator */}
            {bPrice > 0 && sPrice > 0 && (
              <div style={{ 
                marginTop: '10px', 
                padding: '8px 12px', 
                borderRadius: '6px', 
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: sPrice >= bPrice ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: sPrice >= bPrice ? '#047857' : '#b91c1c',
                border: `1px solid ${sPrice >= bPrice ? '#a7f3d0' : '#fecaca'}`
              }}>
                <span>
                  {sPrice >= bPrice ? 'Expected Profit:' : '⚠️ Below Cost (Loss):'}
                  <strong> KES {Math.abs(sPrice - bPrice).toLocaleString()}</strong>
                </span>
                <span style={{ fontWeight: 600 }}>
                  {sPrice >= bPrice ? '+' : ''}{((sPrice - bPrice) / bPrice * 100).toFixed(1)}%
                </span>
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
