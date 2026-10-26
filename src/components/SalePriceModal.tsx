'use client'

import React, { useState, useEffect } from 'react'
import { Colorway } from '@/types'

interface SalePriceModalProps {
  isOpen: boolean
  colorway: Colorway
  quantity: number
  subVariantLabel?: string
  onConfirm: (soldPrice?: number) => void
  onCancel: () => void
}

export default function SalePriceModal({
  isOpen,
  colorway,
  quantity,
  subVariantLabel,
  onConfirm,
  onCancel,
}: SalePriceModalProps) {
  const systemSellingPrice = colorway.sellingPrice
  const systemBuyingPrice = colorway.buyingPrice

  const [inputPrice, setInputPrice] = useState<string>(
    systemSellingPrice !== undefined ? systemSellingPrice.toString() : ''
  )
  const [lossAcknowledged, setLossAcknowledged] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setInputPrice(systemSellingPrice !== undefined ? systemSellingPrice.toString() : '')
      setLossAcknowledged(false)
    }
  }, [isOpen, systemSellingPrice])

  if (!isOpen) return null

  const parsedPrice = parseFloat(inputPrice)
  const hasEnteredPrice = !isNaN(parsedPrice) && parsedPrice >= 0
  const isBelowCost =
    systemBuyingPrice !== undefined && hasEnteredPrice && parsedPrice < systemBuyingPrice
  const unitLoss = isBelowCost ? systemBuyingPrice - parsedPrice : 0
  const totalLoss = unitLoss * Math.abs(quantity)

  const handleProceed = () => {
    if (isBelowCost && !lossAcknowledged) {
      setLossAcknowledged(true)
      return
    }

    if (hasEnteredPrice) {
      onConfirm(parsedPrice)
    } else if (systemSellingPrice !== undefined) {
      onConfirm(systemSellingPrice)
    } else {
      onConfirm(undefined)
    }
  }

  const handleUseSystem = () => {
    onConfirm(systemSellingPrice)
  }

  const handleSkip = () => {
    onConfirm(undefined)
  }

  const itemName = subVariantLabel
    ? `${colorway.fullCode} (${subVariantLabel})`
    : colorway.fullCode

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '92%' }}
      >
        <div className="modal__header">
          <div>
            <h3 className="modal__title" style={{ fontSize: '18px' }}>
              Confirm Sale Price
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)', margin: '2px 0 0' }}>
              Selling {Math.abs(quantity)} pc{Math.abs(quantity) > 1 ? 's' : ''} of <strong>{itemName}</strong>
            </p>
          </div>
          <button className="modal__close-btn" onClick={onCancel} type="button">
            ✕
          </button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {systemSellingPrice !== undefined && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'var(--color-surface, #f3f4f6)',
                fontSize: '13px',
              }}
            >
              <span style={{ color: 'var(--color-text-secondary, #4b5563)' }}>Standard Retail Price:</span>
              <strong>KES {systemSellingPrice.toLocaleString()}</strong>
            </div>
          )}

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-group__label" style={{ fontWeight: 600 }}>
              Agreed / Negotiated Price per Piece <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '12px' }}>(Optional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                className="form-group__input"
                placeholder={systemSellingPrice ? `e.g. ${systemSellingPrice}` : 'Enter agreed price (KES)'}
                min="0"
                value={inputPrice}
                onChange={e => {
                  setInputPrice(e.target.value)
                  setLossAcknowledged(false)
                }}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleProceed()
                  }
                }}
              />
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              Leave blank or skip if price is unrecorded or not agreed yet.
            </p>
          </div>

          {/* Under-Cost Loss Warning */}
          {isBelowCost && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '12px',
                lineHeight: 1.4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                <span>⚠️ Warning: Selling Below Buying Cost!</span>
              </div>
              <div>
                Wholesale cost is <strong>KES {systemBuyingPrice?.toLocaleString()}</strong>. Selling at{' '}
                <strong>KES {parsedPrice.toLocaleString()}</strong> causes a loss of{' '}
                <strong>KES {unitLoss.toLocaleString()}</strong> per piece
                {Math.abs(quantity) > 1 ? ` (KES ${totalLoss.toLocaleString()} total loss)` : ''}.
              </div>
              {!lossAcknowledged ? (
                <div style={{ marginTop: '8px', fontWeight: 600, color: '#b91c1c' }}>
                  Tap &ldquo;Proceed Anyway&rdquo; below to confirm selling at a discount/clearance loss.
                </div>
              ) : (
                <div style={{ marginTop: '8px', fontWeight: 600, color: '#047857' }}>
                  ✓ Loss acknowledged. Ready to confirm.
                </div>
              )}
            </div>
          )}

          {/* Profit Preview if above cost */}
          {!isBelowCost && systemBuyingPrice !== undefined && hasEnteredPrice && parsedPrice >= systemBuyingPrice && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Estimated Profit:</span>
              <strong>
                +KES {((parsedPrice - systemBuyingPrice) * Math.abs(quantity)).toLocaleString()}{' '}
                (+{(((parsedPrice - systemBuyingPrice) / systemBuyingPrice) * 100).toFixed(1)}%)
              </strong>
            </div>
          )}
        </div>

        <div className="modal__footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn--secondary"
            onClick={handleSkip}
            type="button"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            title="Record quantity removal without logging a price"
          >
            Skip Price
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn--secondary"
              onClick={onCancel}
              type="button"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleProceed}
              type="button"
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                background: isBelowCost && !lossAcknowledged ? '#dc2626' : undefined,
              }}
            >
              {isBelowCost && !lossAcknowledged ? 'Proceed Anyway' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
