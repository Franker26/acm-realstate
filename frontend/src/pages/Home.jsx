import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteACM, listACMs, updateACM } from '../api.js'
import { useAuth, useWizard } from '../App.jsx'
import { LoadingState, StateCard } from '../components/StatusState.jsx'

const COLUMNS = [
  { key: 'nuevo', title: 'Nuevo', description: 'Tasaciones recién creadas o pendientes de completar.', tone: 'blue' },
  { key: 'en_progreso', title: 'En progreso', description: 'Trabajos con comparables o ajustes en análisis.', tone: 'violet' },
  { key: 'finalizado', title: 'Finalizado', description: 'Tasaciones listas para exportar o compartir.', tone: 'green' },
  { key: 'cancelado', title: 'Cancelado', description: 'Análisis descartados o pausados.', tone: 'slate' },
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

function statusMeta(acm) {
  const label = statusLabel(acm)
  const normalized = String(label).toLowerCase()

  if (normalized.includes('cambio')) {
    return {
      label,
      tone: 'danger',
      hint: 'Requiere cambios antes de poder aprobarse.',
    }
  }

  if (normalized.includes('aprob')) {
    return {
      label,
      tone: 'success',
      hint: 'Tasacion aprobada y lista para continuar o exportar.',
    }
  }

  if (normalized.includes('pendiente')) {
    return {
      label,
      tone: 'warning',
      hint: 'Pendiente de revision y aprobacion.',
    }
  }

  return {
    label,
    tone: 'neutral',
    hint: 'Esta tasacion no requiere aprobacion.',
  }
}

function stageProgress(acm) {
  const order = ['nuevo', 'en_progreso', 'finalizado', 'cancelado']
  const index = order.indexOf(acm.stage || 'nuevo')
  if (index <= 0) return 'Paso inicial'
  if (index === 1) return 'Carga y ajuste en curso'
  if (index === 2) return 'Lista para exportar'
  return 'Flujo detenido'
}

function comparablesLabel(acm) {
  const count = acm.cantidad_comparables || 0
  return `${count} comparable${count === 1 ? '' : 's'}`
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Home() {
  const [acms, setAcms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [activeMobileStage, setActiveMobileStage] = useState('all')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const { dispatch } = useWizard()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    listACMs()
      .then(setAcms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleWindowClick() {
      setOpenMenuId(null)
    }
    window.addEventListener('click', handleWindowClick)
    return () => window.removeEventListener('click', handleWindowClick)
  }, [])

  const grouped = useMemo(() => {
    const base = Object.fromEntries(COLUMNS.map((column) => [column.key, []]))
    for (const acm of acms) {
      const key = acm.stage || 'nuevo'
      if (!base[key]) base[key] = []
      base[key].push(acm)
    }
    Object.values(base).forEach((items) => {
      items.sort((a, b) => new Date(b.updated_at || b.fecha_creacion) - new Date(a.updated_at || a.fecha_creacion))
    })
    return base
  }, [acms])

  const mobileFeed = useMemo(() => {
    const items = [...acms].sort((a, b) => new Date(b.updated_at || b.fecha_creacion) - new Date(a.updated_at || a.fecha_creacion))
    if (activeMobileStage === 'all') return items
    return items.filter((item) => (item.stage || 'nuevo') === activeMobileStage)
  }, [acms, activeMobileStage])

  const summary = useMemo(() => {
    const pendingApprovals = acms.filter((acm) => String(acm.approval_status || '').toLowerCase() === 'pendiente').length
    const completed = grouped.finalizado?.length || 0
    const inFlight = (grouped.nuevo?.length || 0) + (grouped.en_progreso?.length || 0)
    const comparables = acms.reduce((total, acm) => total + (acm.cantidad_comparables || 0), 0)
    return [
      { label: 'Tasaciones activas', value: inFlight, tone: 'blue', note: 'Casos en trabajo real' },
      { label: 'Finalizadas', value: completed, tone: 'green', note: 'Listas para cierre o entrega' },
      { label: 'Pendientes de aprobación', value: pendingApprovals, tone: 'amber', note: 'Esperando revisión del equipo' },
      { label: 'Comparables cargados', value: comparables, tone: 'violet', note: 'Base de mercado acumulada' },
    ]
  }, [acms, grouped])

  function handleNew() {
    dispatch({ type: 'RESET' })
    navigate('/acm/tipo')
  }

  function handleMobileNavigate(path) {
    setMobilePanelOpen(false)
    navigate(path)
  }

  function handleMobileLogout() {
    setMobilePanelOpen(false)
    logout()
    navigate('/login')
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
        <div className="home-kanban-hero__copy">
          <span className="page-eyebrow">Workspace operativo</span>
          <div className="home-mobile-greeting">{greeting()}{user?.username ? `, ${user.username}` : ''}</div>
          <h1>Tablero de tasaciones</h1>
          <p>
            {user?.is_admin
              ? 'Vista general del flujo de trabajo con todas las tasaciones del equipo, aprobación incluida.'
              : 'Seguí tus tasaciones, retomá el paso correcto y mové cada caso entre etapas con menos fricción.'}
          </p>
          <div className="home-kanban-hero__signals">
            <div className="home-kanban-signal">
              <span className="home-kanban-signal__label">Vista</span>
              <strong>{user?.is_admin ? 'Equipo completo' : 'Seguimiento personal'}</strong>
            </div>
            <div className="home-kanban-signal">
              <span className="home-kanban-signal__label">Estado del panel</span>
              <strong>{acms.length} tasaciones en workspace</strong>
            </div>
          </div>
        </div>
        <div className="home-kanban-hero__actions">
          <div className="home-kanban-hero__hint">Arrastrá cards entre columnas o abrí cada caso para retomarlo desde el paso correcto.</div>
          <button className="btn btn-primary" onClick={handleNew}>+ Nueva tasación</button>
        </div>
      </div>

      {loading && (
        <LoadingState
          eyebrow="Carga de panel"
          title="Estamos preparando el tablero"
          subtitle="Sincronizamos tasaciones, métricas y etapas del equipo."
          messages={['Cargando tablero...', 'Preparando workspace...', 'Sincronizando datos...']}
        />
      )}

      {error && !loading && (
        <StateCard
          eyebrow="No pudimos cargar el tablero"
          title="El panel no respondió como esperábamos"
          description={error}
          tone="error"
          mode="inline"
          actions={<button className="btn btn-primary" onClick={() => window.location.reload()}>Reintentar</button>}
        />
      )}

      {!loading && !error && (
        <>
          <section className="home-mobile-shell">
            <div className="home-mobile-topbar">
              <div>
                <span className="page-eyebrow">Workspace operativo</span>
                <div className="home-mobile-greeting">{greeting()}{user?.username ? `, ${user.username}` : ''}</div>
                <p className="home-mobile-copy">
                  {user?.is_admin
                    ? 'Priorizá, retomá y desbloqueá tasaciones del equipo desde un feed continuo.'
                    : 'Retomá rápido tus tasaciones y entrá directo a la etapa que importa.'}
                </p>
              </div>
              <button
                type="button"
                className="home-mobile-panel-toggle"
                onClick={() => setMobilePanelOpen((value) => !value)}
                aria-expanded={mobilePanelOpen}
                aria-label="Abrir panel de utilidades"
              >
                <span />
                <span />
                <span />
              </button>
            </div>

            <div className="home-mobile-composer">
              <button className="btn btn-primary home-mobile-create" onClick={handleNew}>
                + Nueva tasación
              </button>
              <div className="home-mobile-stats">
                {summary.slice(0, 3).map((item) => (
                  <article key={item.label} className={`dashboard-metric dashboard-metric--${item.tone}`}>
                    <span className="dashboard-metric__label">{item.label}</span>
                    <strong className="dashboard-metric__value">{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>

            <div className="home-mobile-stage-rail">
              <button
                type="button"
                className={`home-mobile-stage-pill${activeMobileStage === 'all' ? ' is-active' : ''}`}
                onClick={() => setActiveMobileStage('all')}
              >
                <span>Todo</span>
                <strong>{acms.length}</strong>
              </button>
              {COLUMNS.map((column) => (
                <button
                  key={column.key}
                  type="button"
                  className={`home-mobile-stage-pill home-mobile-stage-pill--${column.tone}${activeMobileStage === column.key ? ' is-active' : ''}`}
                  onClick={() => setActiveMobileStage(column.key)}
                >
                  <span>{column.title}</span>
                  <strong>{grouped[column.key]?.length || 0}</strong>
                </button>
              ))}
            </div>

            <div className={`home-mobile-utility-panel${mobilePanelOpen ? ' is-open' : ''}`}>
              <div className="home-mobile-utility-panel__header">
                <div>
                  <span className="home-mobile-utility-panel__eyebrow">Accesos</span>
                  <strong>Panel operativo</strong>
                </div>
                <button type="button" className="home-mobile-utility-close" onClick={() => setMobilePanelOpen(false)}>×</button>
              </div>
              <div className="home-mobile-utility-list">
                {user?.is_approver && (
                  <button type="button" className="settings-sidebar-item settings-sidebar-item--active" onClick={() => handleMobileNavigate('/approvals')}>
                    Aprobaciones
                  </button>
                )}
                <button type="button" className="settings-sidebar-item" onClick={() => handleMobileNavigate('/settings')}>
                  Configuración
                </button>
                <button type="button" className="settings-sidebar-item" onClick={() => handleMobileNavigate('/')}>
                  Refrescar tablero
                </button>
                <button type="button" className="settings-sidebar-item" onClick={handleMobileLogout}>
                  Cerrar sesión
                </button>
              </div>
            </div>

            <div className="home-mobile-feed">
              <div className="home-mobile-feed__header">
                <span className="home-mobile-section-label">Feed activo</span>
                <span className="home-mobile-feed__count">{mobileFeed.length} casos</span>
              </div>
              {mobileFeed.map((acm) => {
                const status = statusMeta(acm)
                return (
                  <article
                    key={acm.id}
                    className="kanban-card home-mobile-card"
                    onClick={() => handleOpen(acm)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleOpen(acm)
                      }
                    }}
                  >
                    <div className="kanban-card__top">
                      <div>
                        <div className="kanban-card__title">{acm.nombre}</div>
                        <div className="kanban-card__address">{acm.direccion}</div>
                      </div>
                      <span className={`kanban-card__status kanban-card__status--${status.tone}`}>{status.label}</span>
                    </div>
                    <div className="home-mobile-card__meta">
                      <div className="kanban-card__owner">
                        <div
                          className="kanban-card__avatar"
                          style={{ background: avatarColor(acm.owner_username || acm.nombre) }}
                        >
                          {initials(acm.owner_username || acm.nombre)}
                        </div>
                        <span>{acm.owner_username || 'Sin asignar'}</span>
                      </div>
                      <span>{new Date(acm.updated_at || acm.fecha_creacion).toLocaleDateString('es-AR')}</span>
                    </div>
                    <div className="kanban-card__insights">
                      <span className="kanban-card__chip">{comparablesLabel(acm)}</span>
                      <span className="kanban-card__chip">{stageProgress(acm)}</span>
                    </div>
                  </article>
                )
              })}
              {mobileFeed.length === 0 && (
                <div className="kanban-empty">
                  No hay tasaciones en esta vista por ahora.
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-metrics">
            {summary.map((item) => (
              <article key={item.label} className={`dashboard-metric dashboard-metric--${item.tone}`}>
                <span className="dashboard-metric__label">{item.label}</span>
                <strong className="dashboard-metric__value">{item.value}</strong>
                <span className="dashboard-metric__note">{item.note}</span>
              </article>
            ))}
          </section>

          <div className="home-mobile-section-label">Recientes</div>

          <div className="kanban-board home-desktop-board">
            {COLUMNS.map((column) => {
              const isDragTarget = dragOverCol === column.key
              const isCancelled = column.key === 'cancelado'
              return (
                <section
                  key={column.key}
                  className={`kanban-column kanban-column--${column.tone}${isDragTarget ? ' kanban-column--drop-target' : ''}${isCancelled ? ' kanban-column--cancelled' : ''}`}
                  onDragOver={(e) => handleDragOver(e, column.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.key)}
                >
                  <div className="kanban-column__header">
                    <div>
                      <span className="kanban-column__eyebrow">Etapa</span>
                      <h2>{column.title}</h2>
                      <p>{column.description}</p>
                    </div>
                    <span>{grouped[column.key]?.length || 0}</span>
                  </div>

                  <div className="kanban-column__body">
                    {(grouped[column.key] || []).map((acm) => {
                      const isBeingDragged = draggedId === acm.id
                      const status = statusMeta(acm)
                      return (
                        <article
                          key={acm.id}
                          className={`kanban-card${isCancelled ? ' kanban-card--cancelled' : ''}`}
                          draggable={!updatingId}
                          onDragStart={(e) => handleDragStart(e, acm)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleOpen(acm)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleOpen(acm)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          style={{ opacity: isBeingDragged ? 0.4 : 1, cursor: 'grab' }}
                        >
                          <div className="kanban-card__top">
                            <div>
                              <div className="kanban-card__title">{acm.nombre}</div>
                              <div className="kanban-card__address">{acm.direccion}</div>
                            </div>
                            <div className="kanban-card__top-actions">
                              <span
                                className={`kanban-card__status kanban-card__status--${status.tone}`}
                                title={status.hint}
                              >
                                {status.label}
                              </span>
                              <div className="kanban-card__menu-wrap">
                                <button
                                  type="button"
                                  className="kanban-card__menu-trigger"
                                  aria-label="Más acciones"
                                  aria-expanded={openMenuId === acm.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenMenuId((current) => current === acm.id ? null : acm.id)
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  ⋯
                                </button>
                                {openMenuId === acm.id && (
                                  <div className="kanban-card__menu" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="kanban-card__menu-item kanban-card__menu-item--danger"
                                      onClick={() => handleDelete(acm.id, acm.nombre)}
                                    >
                                      Eliminar tasación
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
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
                            <span>Act. {new Date(acm.updated_at || acm.fecha_creacion).toLocaleDateString('es-AR')}</span>
                          </div>

                          <div className="kanban-card__insights">
                            <span className="kanban-card__chip">{comparablesLabel(acm)}</span>
                            <span className="kanban-card__chip">{stageProgress(acm)}</span>
                          </div>

                          <div className="kanban-card__footer">
                            <div className="kanban-card__footer-note">
                              Abrí la ficha o arrastrá para mover de etapa.
                            </div>
                          </div>
                        </article>
                      )
                    })}

                    {(!grouped[column.key] || grouped[column.key].length === 0) && (
                      <div className={`kanban-empty${isDragTarget ? ' kanban-empty--highlight' : ''}`}>
                        {isDragTarget ? 'Soltá aquí para mover la tasación.' : 'Todavía no hay tasaciones en esta etapa.'}
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
