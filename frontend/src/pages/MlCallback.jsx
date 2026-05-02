import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeMlCode } from '../api.js'
import { LoadingState, StateCard } from '../components/StatusState.jsx'
import { getFriendlyOauthError } from '../utils/feedback.js'

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
      setMessage(getFriendlyOauthError('MercadoLibre', error))
      return
    }

    if (!code) {
      setStatus('error')
      setMessage('No recibimos la autorización necesaria para vincular la cuenta. Probá nuevamente desde Configuración.')
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
    <>
      {status === 'loading' && (
        <LoadingState
          eyebrow="Integración"
          title="Estamos conectando tu cuenta de MercadoLibre"
          subtitle="Validamos la autorización y guardamos la conexión en el workspace."
          messages={['Conectando con MercadoLibre...', 'Validando autorización...', 'Finalizando conexión...']}
          mode="fullscreen"
        />
      )}

      {status === 'success' && (
        <StateCard
          eyebrow="Conexión completa"
          title="La cuenta quedó vinculada correctamente"
          description={`${message} Redirigiendo a Configuración...`}
          tone="success"
          mode="fullscreen"
          actions={<button className="btn btn-primary" onClick={() => navigate('/settings')}>Ir ahora a Configuración</button>}
        />
      )}

      {status === 'error' && (
        <StateCard
          eyebrow="No pudimos completar la integración"
          title="La cuenta no se pudo conectar"
          description={message}
          tone="error"
          mode="fullscreen"
          actions={<button className="btn btn-primary" onClick={() => navigate('/settings')}>Volver a Configuración</button>}
        />
      )}
    </>
  )
}
