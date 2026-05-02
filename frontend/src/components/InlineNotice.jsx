import React from 'react'

export default function InlineNotice({
  tone = 'info',
  title,
  description,
  children,
  className = '',
  compact = false,
}) {
  return (
    <div className={`notice notice--${tone}${compact ? ' notice--compact' : ''}${className ? ` ${className}` : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className={`notice__icon notice__icon--${tone}`} aria-hidden="true">
        {tone === 'error' ? '!' : tone === 'success' ? 'OK' : tone === 'warning' ? '!' : 'i'}
      </div>
      <div className="notice__body">
        {title ? <strong className="notice__title">{title}</strong> : null}
        {description ? <p className="notice__description">{description}</p> : null}
        {children}
      </div>
    </div>
  )
}
