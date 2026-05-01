import React from 'react'
import { LoadingState } from './StatusState.jsx'

const MESSAGES = [
  'Leyendo publicación...',
  'Extrayendo superficie...',
  'Analizando precio...',
  'Verificando datos...',
  'Casi listo...',
]

const MESSAGES_RETRY = [
  'Conectando con servidor de respaldo...',
  'Reintentando extracción...',
  'Procesando desde backup...',
  'Casi listo...',
]

export default function SmartLoader({ loading, message }) {
  if (!loading) return null

  const isRetrying = Boolean(message)

  return (
    <div className="smart-loader-overlay">
      <LoadingState
        eyebrow={isRetrying ? 'Reconectando' : 'Extrayendo comparable'}
        title={isRetrying ? 'El servidor principal no respondió, reintentando con backup' : 'Procesamos la publicación para completar los datos base'}
        subtitle={isRetrying ? 'Usamos el servidor de respaldo. Esto puede tardar unos segundos más.' : 'Dejá esta ventana abierta mientras terminamos de leer la fuente.'}
        messages={isRetrying ? MESSAGES_RETRY : MESSAGES}
        step="Paso 2 - Comparables"
        source="zonaprop.com.ar"
        mode="overlay"
      />
    </div>
  )
}
