import React from 'react'
import { useParams } from 'react-router-dom'
import { ErrorState } from '../components/ErrorState.jsx'

function buildActions(code) {
  switch (code) {
    case '401':
      return [
        { label: 'Ir al login', to: '/login' },
        { label: 'Volver al tablero', to: '/', variant: 'secondary' },
      ]
    case '403':
      return [
        { label: 'Ir al tablero', to: '/' },
        { label: 'Entrar al admin', to: '/admin', variant: 'secondary' },
      ]
    case '503':
      return [
        { label: 'Reintentar', onClick: () => window.location.reload() },
        { label: 'Volver al tablero', to: '/', variant: 'secondary' },
      ]
    case '500':
      return [
        { label: 'Recargar pagina', onClick: () => window.location.reload() },
        { label: 'Ir al tablero', to: '/', variant: 'secondary' },
      ]
    default:
      return [
        { label: 'Ir al tablero', to: '/' },
        { label: 'Ir al login', to: '/login', variant: 'secondary' },
      ]
  }
}

export default function ErrorPage({ code: forcedCode, technicalMessage, config, actions }) {
  const params = useParams()
  const code = forcedCode || params.code || '404'

  return (
    <ErrorState
      code={code}
      config={config}
      technicalMessage={technicalMessage}
      actions={actions || buildActions(code)}
    />
  )
}
