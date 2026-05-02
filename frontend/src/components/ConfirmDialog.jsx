import React from 'react'

export default function ConfirmDialog({
  open,
  tone = 'warning',
  eyebrow = 'Confirmación',
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="confirm-dialog-backdrop" onClick={onCancel}>
      <div className={`confirm-dialog confirm-dialog--${tone}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <span className="confirm-dialog__eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
