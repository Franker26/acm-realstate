import React, { useEffect, useState } from 'react'

function useTypewriter(phrases, speed = 62, pause = 1800) {
  const items = phrases?.length ? phrases : ['Procesando...']
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setPhraseIndex(0)
    setCharIndex(0)
    setIsDeleting(false)
  }, [items.join('|')])

  useEffect(() => {
    const current = items[phraseIndex] || ''
    let timeoutId

    if (!isDeleting && charIndex < current.length) {
      timeoutId = window.setTimeout(() => setCharIndex((value) => value + 1), speed)
    } else if (!isDeleting && charIndex === current.length) {
      timeoutId = window.setTimeout(() => setIsDeleting(true), pause)
    } else if (isDeleting && charIndex > 0) {
      timeoutId = window.setTimeout(() => setCharIndex((value) => value - 1), Math.max(24, speed * 0.45))
    } else {
      timeoutId = window.setTimeout(() => {
        setIsDeleting(false)
        setPhraseIndex((value) => (value + 1) % items.length)
      }, 240)
    }

    return () => window.clearTimeout(timeoutId)
  }, [charIndex, isDeleting, items, pause, phraseIndex, speed])

  return `${(items[phraseIndex] || '').slice(0, charIndex)}`
}

export function LoadingState({
  eyebrow = 'Cargando',
  title,
  subtitle,
  messages,
  step,
  source,
  mode = 'page',
}) {
  const typed = useTypewriter(messages)
  const shellClassName = `status-shell status-shell--${mode}`

  return (
    <section className={shellClassName} aria-live="polite" aria-busy="true">
      <div className="status-card status-card--loading">
        <div className="status-card__visual" aria-hidden="true">
          <div className="status-skeleton">
            <div className="status-skeleton__card">
              <span className="status-skeleton__title" />
              <span className="status-skeleton__line status-skeleton__line--short" />
              <span className="status-skeleton__line status-skeleton__line--glow" />
            </div>
            <div className="status-skeleton__card">
              <span className="status-skeleton__title status-skeleton__title--small" />
              <span className="status-skeleton__line" />
              <span className="status-skeleton__line status-skeleton__line--glow status-skeleton__line--wide" />
            </div>
          </div>
        </div>

        <div className="status-card__body">
          <span className="status-card__eyebrow">{eyebrow}</span>
          {step && (
            <div className="status-badge">
              <span className="status-badge__dot" />
              <span>{step}</span>
            </div>
          )}
          <div className="status-typewriter">
            {typed}
            <span className="status-typewriter__cursor" />
          </div>
          {title && <h2 className="status-card__title">{title}</h2>}
          {subtitle && <p className="status-card__description">{subtitle}</p>}
          {source && <div className="status-card__meta">{source}</div>}
          <div className="status-progress" aria-hidden="true">
            <div className="status-progress__fill" />
          </div>
        </div>
      </div>
    </section>
  )
}

export function StateCard({
  eyebrow,
  title,
  description,
  tone = 'neutral',
  actions,
  mode = 'page',
  children,
}) {
  return (
    <section className={`status-shell status-shell--${mode}`}>
      <div className={`status-card status-card--${tone}`}>
        <div className="status-card__body">
          {eyebrow && <span className="status-card__eyebrow">{eyebrow}</span>}
          <div className={`status-icon status-icon--${tone}`} aria-hidden="true">
            {tone === 'error' ? '!' : tone === 'success' ? 'OK' : tone === 'empty' ? '...' : 'i'}
          </div>
          <h2 className="status-card__title">{title}</h2>
          {description && <p className="status-card__description">{description}</p>}
          {children}
          {actions ? <div className="status-card__actions">{actions}</div> : null}
        </div>
      </div>
    </section>
  )
}
