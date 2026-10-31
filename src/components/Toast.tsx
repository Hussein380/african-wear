'use client'

import { useEffect, useState } from 'react'
export interface ToastData {
  id: string
  message: string
  itemCode: string
  activityId?: string
  colorwayId: string
  change: number
  subVariantId?: string
  currentKind?: 'sold' | 'own_use' | 'arrived' | 'returned'
  onUndo?: () => void
  onTagChange?: (newKind: 'sold' | 'own_use' | 'arrived' | 'returned') => void
}

interface ToastProps {
  toast: ToastData | null
  onDismiss: () => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [overrideKind, setOverrideKind] = useState<{ id: string; kind: string } | null>(null)
  const [isUpdatingTag, setIsUpdatingTag] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)

  const activeKind = (toast && overrideKind?.id === toast.id) ? overrideKind.kind : toast?.currentKind

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onDismiss()
    }, 15000) // 15 seconds visible

    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  const isOut = toast.change < 0
  const isUndoable = !!toast.onUndo

  const handleTag = async (newKind: 'sold' | 'own_use' | 'arrived' | 'returned') => {
    if (!toast.activityId || isUpdatingTag) return
    setIsUpdatingTag(true)
    setOverrideKind({ id: toast.id, kind: newKind })
    try {
      const res = await fetch(`/api/activities/${toast.activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: newKind }),
      })
      if (res.ok) {
        toast.onTagChange?.(newKind)
      }
    } catch (e) {
      console.error('Failed to update tag:', e)
    } finally {
      setIsUpdatingTag(false)
    }
  }

  const handleUndo = async () => {
    if (isUndoing || !toast.onUndo) return
    setIsUndoing(true)
    try {
      await toast.onUndo()
      onDismiss()
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <div className="stock-toast" role="status" aria-live="polite">
      <div className="stock-toast__content">
        <div className="stock-toast__main">
          <span className="stock-toast__badge" style={{
            background: isOut ? '#fee2e2' : '#dcfce7',
            color: isOut ? '#991b1b' : '#166534',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 700,
          }}>
            {isOut ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                <span>Sold (Stock Deducted)</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                <span>Stock Added</span>
              </>
            )}
          </span>
          <span className="stock-toast__text">
            <strong>{Math.abs(toast.change)} {Math.abs(toast.change) === 1 ? 'bale' : 'bales'}</strong> of <strong>{toast.itemCode}</strong>
          </span>
        </div>

        {/* Quick 1-tap tag switcher: Sold vs Own Use, or Arrived vs Returned */}
        {toast.activityId && (
          <div className="stock-toast__tags">
            {isOut ? (
              <>
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'sold' || !activeKind ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('sold')}
                  disabled={isUpdatingTag}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Sold</span>
                </button>
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'own_use' ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('own_use')}
                  disabled={isUpdatingTag}
                >
                  Own Use
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'arrived' || !activeKind ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('arrived')}
                  disabled={isUpdatingTag}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Arrived</span>
                </button>
                <button
                  type="button"
                  className={`stock-toast__tag-btn ${activeKind === 'returned' ? 'stock-toast__tag-btn--active' : ''}`}
                  onClick={() => handleTag('returned')}
                  disabled={isUpdatingTag}
                >
                  Customer Return
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="stock-toast__actions">
        {isUndoable && (
          <button
            type="button"
            className="stock-toast__undo-btn"
            onClick={handleUndo}
            disabled={isUndoing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              padding: '6px 12px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
            <span>{isUndoing ? 'Undoing…' : 'Undo'}</span>
          </button>
        )}
        <button
          type="button"
          className="stock-toast__close-btn"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
