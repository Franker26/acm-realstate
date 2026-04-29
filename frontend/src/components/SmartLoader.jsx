import React, { useEffect, useState } from 'react'

const MESSAGES = [
  'Pensando...',
  'Calculando variables...',
  'Analizando mercado...',
  'Estimando valor...',
  'Cruzando datos...',
]

const TYPING_SPEED = 45   // ms per char
const PAUSE_AFTER   = 900 // ms to hold full message before fading out

export default function SmartLoader({ loading, logoSrc }) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!loading) return
    setDisplayed('')
    setFading(false)

    let charIndex = 0
    const msg = MESSAGES[msgIndex]

    const typer = setInterval(() => {
      charIndex++
      setDisplayed(msg.slice(0, charIndex))
      if (charIndex >= msg.length) {
        clearInterval(typer)
        setTimeout(() => {
          setFading(true)
          setTimeout(() => {
            setMsgIndex((i) => (i + 1) % MESSAGES.length)
            setFading(false)
          }, 350)
        }, PAUSE_AFTER)
      }
    }, TYPING_SPEED)

    return () => clearInterval(typer)
  }, [loading, msgIndex])

  if (!loading) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        {logoSrc && (
          <img src={logoSrc} alt="logo" style={styles.logo} />
        )}
        <div style={{ ...styles.message, opacity: fading ? 0 : 1 }}>
          {displayed}
          {!fading && <span style={styles.cursor}>|</span>}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  box: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  logo: {
    height: 52,
    width: 'auto',
    objectFit: 'contain',
    opacity: 0.9,
  },
  message: {
    fontSize: 17,
    fontWeight: 500,
    color: 'var(--primary, #1a3a5c)',
    letterSpacing: '0.01em',
    minHeight: 26,
    transition: 'opacity 0.3s ease',
  },
  cursor: {
    display: 'inline-block',
    marginLeft: 1,
    animation: 'smartloader-blink 0.7s step-start infinite',
  },
}

// Inject keyframe once
if (typeof document !== 'undefined' && !document.getElementById('smartloader-style')) {
  const s = document.createElement('style')
  s.id = 'smartloader-style'
  s.textContent = '@keyframes smartloader-blink { 50% { opacity: 0 } }'
  document.head.appendChild(s)
}
