import React from 'react'
import { Link } from 'react-router-dom'
import { StateCard } from '../components/StatusState.jsx'

export default function NotFound() {
  return (
    <StateCard
      eyebrow="Error de navegación"
      title="Esta página no existe"
      description="La ruta que intentaste abrir no está disponible o cambió de ubicación dentro del workspace."
      tone="empty"
      mode="fullscreen"
      actions={(
        <>
          <Link className="btn btn-primary" to="/">Ir al tablero</Link>
          <Link className="btn btn-secondary" to="/login">Ir al acceso</Link>
        </>
      )}
    />
  )
}
