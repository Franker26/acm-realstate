import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeMlCode } from '../api.js'

export default function MlCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      setStatus('error')
      setMessage(`MercadoLibre rechazó la autorización: ${error}`)
      return
    }

    if (!code) {
      setStatus('error')
      setMessage('No se recibió código de autorización.')
      return
    }

    exchangeMlCode(code)
      .then((data) => {
        setStatus('success')
        setMessage(`Cuenta conectada${data.nickname ? `: ${data.nickname}` : ''}.`)
        setTimeout(() => navigate('/settings'), 2000)
      })
      .catch((e) => {
        setStatus('error')
        setMessage(e.message)
      })
  }, [])

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3, marginBottom: 16 }} />
            <p style={styles.text}>Conectando con MercadoLibre...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={styles.icon}>✓</div>
            <p style={styles.text}>{message}</p>
            <p style={styles.sub}>Redirigiendo a Configuración...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ ...styles.icon, background: '#fee2e2', color: '#dc2626' }}>✕</div>
            <p style={styles.text}>No se pudo conectar la cuenta</p>
            <p style={styles.sub}>{message}</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => navigate('/settings')}
            >
              Volver a Configuración
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '40px 48px',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: 400,
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: '#dcfce7',
    color: '#16a34a',
    fontSize: 24,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  text: { fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 6 },
  sub: { fontSize: 13, color: '#666' },
}
