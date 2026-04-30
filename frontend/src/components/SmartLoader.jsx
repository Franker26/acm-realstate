import React from 'react'
import { LoadingState } from './StatusState.jsx'

const MESSAGES = [
  'Leyendo publicación...',
  'Extrayendo superficie...',
  'Analizando precio...',
  'Verificando datos...',
  'Casi listo...',
]

export default function SmartLoader({ loading }) {
  if (!loading) return null

  return (
    <div className="smart-loader-overlay">
      <LoadingState
        eyebrow="Extrayendo comparable"
        title="Procesamos la publicación para completar los datos base"
        subtitle="Dejá esta ventana abierta mientras terminamos de leer la fuente."
        messages={MESSAGES}
        step="Paso 2 - Comparables"
        source="zonaprop.com.ar"
        mode="overlay"
      />
    </div>
  )
}
