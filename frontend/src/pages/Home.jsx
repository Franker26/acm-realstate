import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteACM, listACMs, updateACM } from '../api.js'
import { useAuth, useWizard } from '../App.jsx'

const COLUMNS = [
  { key: 'Borrador',     title: 'Borrador' },
  { key: 'En progreso',  title: 'En progreso' },
  { key: 'Finalizado',   title: 'Finalizado' },
  { key: 'Cancelado',    title: 'Cancelado' },
]

function initials(name = '') {
  return name.slice(0, 2).toUpperCase() || 'AC'
}

function avatarColor(seed = '') {
  let hash = 0
  for (const char of seed) hash = char.charCodeAt(0) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 46%)`
}

function statusLabel(acm) {
  if (!acm.requires_approval) return 'Sin aprobación'
  return acm.approval_status || 'Pendiente'
}

export default function Home() {
  const [acms, setAcms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const { dispatch } = useWizard()
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    listACMs()
      .then(setAcms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const base = Object.fromEntries(COLUMNS.map((column) => [column.key, []]))
    for (const acm of acms) {
      const key = acm.stage || 'Borrador'
      if (!base[key]) base[key] = []
      base[key].push(acm)
    }
    return base
  }, [acms])

  function handleNew() {
    dispatch({ type: 'RESET' })
    navigate('/acm/tipo')
  }

  async function handleDelete(id, nombre) {
    if (!window.confirm(`¿Eliminar el ACM "${nombre}"?`)) return
    try {
      await deleteACM(id)
      setAcms((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      window.alert('Error al eliminar: ' + e.message)
    }
  }

  function handleOpen(acm) {
    dispatch({ type: 'SET_ACM_ID', payload: acm.id })
    const nextStep = acm.cantidad_comparables > 0 ? 2 : 1
    navigate(`/acm/${acm.id}/step/${nextStep}`)
  }

  async function handleStageChange(acm, stage) {
    if (acm.stage === stage) return
    setUpdatingId(acm.id)
    // Optimistic update
    setAcms((prev) => prev.map((item) => (item.id === acm.id ? { ...item, stage } : item)))
    try {
      const updated = await updateACM(acm.id, { stage })
      setAcms((prev) => prev.map((item) => (item.id === acm.id ? { ...item, ...updated } : item)))
    } catch (e) {
      // Revert on failure
      setAcms((prev) => prev.map((item) => (item.id === acm.id ? { ...item, stage: acm.stage } : item)))
      window.alert('No se pudo cambiar la etapa: ' + e.message)
    } finally {
      setUpdatingId(null)
    }
  }

  function handleDragStart(e, acm) {
    setDraggedId(acm.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, colKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colKey)
  }

  function handleDragLeave(e) {
    // Only clear if leaving the column entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCol(null)
    }
  }

  async function handleDrop(e, colKey) {
    e.preventDefault()
    setDragOverCol(null)
    if (!draggedId) return
    const acm = acms.find((a) => a.id === draggedId)
    setDraggedId(null)
    if (acm) await handleStageChange(acm, colKey)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverCol(null)
  }

  return (
    <div>
      <div className="home-kanban-hero">
        <div>
          <h1>Tablero de tasaciones</h1>
          <p>
            {user?.is_admin
              ? 'Vista general del flujo de trabajo con todas las tasaciones del equipo.'
              : 'Seguí el estado de tus tasaciones y movelas manualmente entre etapas.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ Nueva Tasación</button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#888' }}>Cargando tablero...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && (
        <div className="kanban-board">
          {COLUMNS.map((column) => {
            const isDragTarget = dragOverCol === column.key
            const isCancelled = column.key === 'Cancelado'
            return (
              <section
                key={column.key}
                className={`kanban-column${isDragTarget ? ' kanban-column--drop-target' : ''}${isCancelled ? ' kanban-column--cancelled' : ''}`}
                onDragOver={(e) => handleDragOver(e, column.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.key)}
              >
                <div className="kanban-column__header">
                  <h2>{column.title}</h2>
                  <span>{grouped[column.key]?.length || 0}</span>
                </div>

                <div className="kanban-column__body">
                  {(grouped[column.key] || []).map((acm) => {
                    const isBeingDragged = draggedId === acm.id
                    return (
                      <article
                        key={acm.id}
                        className={`kanban-card${isCancelled ? ' kanban-card--cancelled' : ''}`}
                        draggable={!updatingId}
                        onDragStart={(e) => handleDragStart(e, acm)}
                        onDragEnd={handleDragEnd}
                        style={{ opacity: isBeingDragged ? 0.4 : 1, cursor: 'grab' }}
                      >
                        <div className="kanban-card__top">
                          <div>
                            <div className="kanban-card__title">{acm.nombre}</div>
                            <div className="kanban-card__address">{acm.direccion}</div>
                          </div>
                          <span className="kanban-card__status">{statusLabel(acm)}</span>
                        </div>

                        <div className="kanban-card__meta">
                          <div className="kanban-card__owner">
                            <div
                              className="kanban-card__avatar"
                              style={{ background: avatarColor(acm.owner_username || acm.nombre) }}
                            >
                              {initials(acm.owner_username || acm.nombre)}
                            </div>
                            <span>{acm.owner_username || 'Sin asignar'}</span>
                          </div>
                          <span>{acm.cantidad_comparables} comp.</span>
                          <span>{new Date(acm.fecha_creacion).toLocaleDateString('es-AR')}</span>
                        </div>

                        <div className="kanban-card__footer">
                          <select
                            value={acm.stage || 'Borrador'}
                            onChange={(e) => handleStageChange(acm, e.target.value)}
                            disabled={updatingId === acm.id}
                          >
                            {COLUMNS.map((option) => (
                              <option key={option.key} value={option.key}>{option.title}</option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpen(acm)}>
                              Abrir
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(acm.id, acm.nombre)}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}

                  {(!grouped[column.key] || grouped[column.key].length === 0) && (
                    <div className={`kanban-empty${isDragTarget ? ' kanban-empty--highlight' : ''}`}>
                      {isDragTarget ? 'Soltá aquí' : 'No hay tasaciones en esta etapa.'}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
