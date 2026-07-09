'use client'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  isLoading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="confirm-dialog">
          <div className="confirm-dialog__icon">⚠️</div>
          <h3 className="confirm-dialog__title">{title}</h3>
          <p className="confirm-dialog__message">{message}</p>
          <div className="confirm-dialog__actions">
            <button className="btn btn--secondary" onClick={onClose} type="button" disabled={isLoading}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={onConfirm}
              disabled={isLoading}
              type="button"
              style={{ background: 'var(--color-danger)' }}
            >
              {isLoading ? 'Deleting...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
