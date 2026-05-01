import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteACM, listACMs, updateACM } from '../api.js'
import { useAuth, useWizard } from '../App.jsx'
import { LoadingState, MobileWorkspaceLoading, StateCard } from '../components/StatusState.jsx'

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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [quickDraft, setQuickDraft] = useState({ nombre: '', direccion: '' })
  const [quickErrors, setQuickErrors] = useState({})
  const [routeTransition, setRouteTransition] = useState(null)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 820
  })
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
    function handleResize() {
      setIsMobile(window.innerWidth <= 820)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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

  const recentAcms = useMemo(() => {
    return [...acms].sort((a, b) => new Date(b.updated_at || b.fecha_creacion) - new Date(a.updated_at || a.fecha_creacion))
  }, [acms])

  const spotlightAcms = useMemo(() => {
    return recentAcms.filter((item) => (item.stage || 'nuevo') !== 'cancelado').slice(0, 6)
  }, [recentAcms])

  const actionableAcms = useMemo(() => {
    const pending = recentAcms.filter((item) => {
      const approvalPending = String(item.approval_status || '').toLowerCase() === 'pendiente'
      const activeStage = ['nuevo', 'en_progreso'].includes(item.stage || 'nuevo')
      return approvalPending || activeStage
    })
    return (pending.length ? pending : recentAcms).slice(0, 4)
  }, [recentAcms])

  const mobileOverview = useMemo(() => {
    const pendingApprovals = acms.filter((acm) => String(acm.approval_status || '').toLowerCase() === 'pendiente').length
    const completed = grouped.finalizado?.length || 0
    const inFlight = (grouped.nuevo?.length || 0) + (grouped.en_progreso?.length || 0)
    const comparables = acms.reduce((total, acm) => total + (acm.cantidad_comparables || 0), 0)
    return {
      total: acms.length,
      pendingApprovals,
      completed,
      inFlight,
      comparables,
    }
  }, [acms, grouped])

  const summary = useMemo(() => {
    return [
      { label: 'Tasaciones activas', value: mobileOverview.inFlight, tone: 'blue', note: 'Casos en trabajo real' },
      { label: 'Finalizadas', value: mobileOverview.completed, tone: 'green', note: 'Listas para cierre o entrega' },
      { label: 'Pendientes de aprobación', value: mobileOverview.pendingApprovals, tone: 'amber', note: 'Esperando revisión del equipo' },
      { label: 'Comparables cargados', value: mobileOverview.comparables, tone: 'violet', note: 'Base de mercado acumulada' },
    ]
  }, [mobileOverview])

  function handleNew() {
    dispatch({ type: 'RESET' })
    navigate('/acm/tipo')
  }

  function handleQuickDraftChange(key, value) {
    setQuickDraft((prev) => ({ ...prev, [key]: value }))
    setQuickErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleQuickCreate() {
    const nextErrors = {}
    if (!quickDraft.nombre.trim()) nextErrors.nombre = 'Requerido'
    if (!quickDraft.direccion.trim()) nextErrors.direccion = 'Requerido'
    if (Object.keys(nextErrors).length) {
      setQuickErrors(nextErrors)
      return
    }
    dispatch({ type: 'RESET' })
    setQuickCreateOpen(false)
    navigate('/acm/new', {
      state: {
        tipo: 'Departamento',
        quickDraft: {
          nombre: quickDraft.nombre.trim(),
          direccion: quickDraft.direccion.trim(),
        },
      },
    })
  }

  function handleMobileNavigate(path) {
    setMobileDrawerOpen(false)
    const isDashboardSwap = path === '/approvals' || path === '/'
    if (isDashboardSwap) {
      setRouteTransition(path === '/approvals' ? 'approvals' : 'dashboard')
      window.setTimeout(() => navigate(path), 140)
      return
    }
    navigate(path)
  }

  function handleMobileLogout() {
    setMobileDrawerOpen(false)
    logout()
    navigate('/login')
  }

  if (routeTransition) {
    return (
      <MobileWorkspaceLoading
        eyebrow="Cambiando de vista"
        title={routeTransition === 'approvals' ? 'Abriendo aprobaciones' : 'Volviendo al dashboard'}
        subtitle={routeTransition === 'approvals'
          ? 'Preparamos la cola rápida con las tasaciones pendientes para revisar desde el celular.'
          : 'Estamos restaurando el tablero operativo con tus ACMs, métricas y accesos rápidos.'}
        messages={routeTransition === 'approvals'
          ? ['Entrando a aprobaciones...', 'Buscando tasaciones pendientes...', 'Preparando revisión rápida...']
          : ['Volviendo al dashboard...', 'Sincronizando tasaciones...', 'Ordenando el tablero móvil...']}
      />
    )
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
        isMobile ? (
          <MobileWorkspaceLoading
            eyebrow="Carga de panel"
            title="Estamos preparando el dashboard"
            subtitle="Sincronizamos tasaciones, métricas y etapas del equipo para que el tablero abra listo en mobile."
            messages={['Cargando tablero...', 'Preparando workspace...', 'Sincronizando datos...']}
          />
        ) : (
          <LoadingState
            eyebrow="Carga de panel"
            title="Estamos preparando el dashboard"
            subtitle="Sincronizamos tasaciones, métricas y etapas del equipo para que el tablero abra listo en escritorio."
            messages={['Cargando tablero...', 'Preparando workspace...', 'Sincronizando datos...']}
            mode="inline"
          />
        )
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
            <button
              type="button"
              className={`home-mobile-modal-backdrop${quickCreateOpen ? ' is-open' : ''}`}
              onClick={() => setQuickCreateOpen(false)}
              aria-label="Cerrar alta rápida"
            />

            <div className={`home-mobile-quick-modal${quickCreateOpen ? ' is-open' : ''}`} aria-hidden={!quickCreateOpen}>
              <div className="home-mobile-quick-modal__header">
                <div>
                  <span className="home-mobile-section-label">Tasación rápida</span>
                  <strong>Creá el ACM con lo mínimo</strong>
                </div>
                <button type="button" className="home-mobile-quick-modal__close" onClick={() => setQuickCreateOpen(false)}>
                  ×
                </button>
              </div>
              <div className="home-mobile-quick-modal__body">
                <label className="home-mobile-quick-field">
                  <span>Nombre</span>
                  <input
                    type="text"
                    value={quickDraft.nombre}
                    onChange={(e) => handleQuickDraftChange('nombre', e.target.value)}
                    placeholder="Ej: Av. Libertador 2450"
                  />
                  {quickErrors.nombre && <small>{quickErrors.nombre}</small>}
                </label>
                <label className="home-mobile-quick-field">
                  <span>Dirección</span>
                  <input
                    type="text"
                    value={quickDraft.direccion}
                    onChange={(e) => handleQuickDraftChange('direccion', e.target.value)}
                    placeholder="Ej: Av. Libertador 2450, CABA"
                  />
                  {quickErrors.direccion && <small>{quickErrors.direccion}</small>}
                </label>
              </div>
              <button type="button" className="btn btn-primary home-mobile-quick-modal__submit" onClick={handleQuickCreate}>
                Continuar con tasación rápida
              </button>
            </div>

            <button
              type="button"
              className={`home-mobile-drawer-backdrop${mobileDrawerOpen ? ' is-open' : ''}`}
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Cerrar panel lateral"
            />

            <aside className={`home-mobile-drawer${mobileDrawerOpen ? ' is-open' : ''}`} aria-hidden={!mobileDrawerOpen}>
              <div className="home-mobile-drawer__header">
                <div className="home-mobile-drawer__identity">
                  <div className="home-mobile-drawer__avatar" style={{ background: avatarColor(user?.username || 'Usuario') }}>
                    {initials(user?.username || 'Usuario')}
                  </div>
                  <div>
                    <strong>{user?.username || 'Usuario'}</strong>
                    <span>{user?.is_admin ? 'Administrador' : 'Workspace operativo'}</span>
                  </div>
                </div>
                <button type="button" className="home-mobile-drawer__close" onClick={() => setMobileDrawerOpen(false)}>
                  ×
                </button>
              </div>

              <div className="home-mobile-drawer__actions">
                <button type="button" className="settings-sidebar-item settings-sidebar-item--active" onClick={() => handleMobileNavigate('/settings')}>
                  Configuración
                </button>
                <button type="button" className="settings-sidebar-item" onClick={() => handleMobileNavigate('/settings')}>
                  Cambiar contraseña
                </button>
                {user?.is_approver && (
                  <button type="button" className="settings-sidebar-item" onClick={() => handleMobileNavigate('/approvals')}>
                    Aprobaciones
                  </button>
                )}
                <button type="button" className="settings-sidebar-item" onClick={handleMobileLogout}>
                  Cerrar sesión
                </button>
              </div>
            </aside>

            <section className="home-mobile-topband">
              <header className="home-mobile-header">
                <button
                  type="button"
                  className="home-mobile-user-trigger"
                  onClick={() => setMobileDrawerOpen(true)}
                  aria-expanded={mobileDrawerOpen}
                  aria-label="Abrir panel de usuario"
                >
                  <span className="home-mobile-user-trigger__avatar" style={{ background: avatarColor(user?.username || 'Usuario') }}>
                    {initials(user?.username || 'Usuario')}
                  </span>
                  <span className="home-mobile-user-trigger__body">
                    <span className="home-mobile-user-trigger__name">{user?.username || 'Usuario'}</span>
                    <span className="home-mobile-user-trigger__meta">Workspace Reval</span>
                  </span>
                </button>
                <div className="home-mobile-header__utilities">
                  {user?.is_approver && (
                    <button type="button" className="home-mobile-utility-pill" onClick={() => handleMobileNavigate('/approvals')}>
                      Aprobaciones
                    </button>
                  )}
                  <button type="button" className="home-mobile-utility-icon" onClick={() => setMobileDrawerOpen(true)} aria-label="Abrir perfil">
                    ≡
                  </button>
                </div>
              </header>

              <section className="home-mobile-overview">
                <span className="home-mobile-overview__eyebrow">Resumen operativo</span>
                <h1>{greeting()}{user?.username ? `, ${user.username}` : ''}</h1>
                <p>
                  {mobileOverview.total > 0
                    ? `Tenés ${mobileOverview.inFlight} ACM activos y ${mobileOverview.pendingApprovals} pendiente${mobileOverview.pendingApprovals === 1 ? '' : 's'} de aprobación.`
                    : 'Todavía no hay ACMs activos para seguir desde el celular.'}
                </p>
                <div className="home-mobile-overview__metrics">
                  <article className="home-mobile-metric-card">
                    <span>Activos</span>
                    <strong>{mobileOverview.inFlight}</strong>
                  </article>
                  <article className="home-mobile-metric-card">
                    <span>Pendientes</span>
                    <strong>{mobileOverview.pendingApprovals}</strong>
                  </article>
                  <article className="home-mobile-metric-card">
                    <span>Finalizados</span>
                    <strong>{mobileOverview.completed}</strong>
                  </article>
                </div>
              </section>
            </section>

            <section className="home-mobile-carousel-block">
              <div className="home-mobile-block-header">
                <div>
                  <span className="home-mobile-section-label">ACMs</span>
                  <strong>Deslizá y retomá rápido</strong>
                </div>
              </div>

              {spotlightAcms.length > 0 ? (
                <div className="home-mobile-carousel" role="list" aria-label="ACMs recientes">
                  {spotlightAcms.map((acm) => {
                    const status = statusMeta(acm)
                    return (
                      <article key={acm.id} className={`home-mobile-carousel-card home-mobile-carousel-card--${status.tone}`} role="listitem">
                        <div className="home-mobile-carousel-card__top">
                          <span className="home-mobile-carousel-card__stage">{(acm.stage || 'nuevo').replace('_', ' ')}</span>
                          <span className={`kanban-card__status kanban-card__status--${status.tone}`}>{status.label}</span>
                        </div>
                        <div className="home-mobile-carousel-card__body">
                          <strong>{acm.nombre}</strong>
                          <p>{acm.direccion}</p>
                        </div>
                        <div className="home-mobile-carousel-card__stats">
                          <div>
                            <span>Comparables</span>
                            <strong>{acm.cantidad_comparables || 0}</strong>
                          </div>
                          <div>
                            <span>Actualizado</span>
                            <strong>{new Date(acm.updated_at || acm.fecha_creacion).toLocaleDateString('es-AR')}</strong>
                          </div>
                        </div>
                        <button type="button" className="btn btn-primary home-mobile-carousel-card__cta" onClick={() => handleOpen(acm)}>
                          Retomar ACM
                        </button>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="kanban-empty">
                  No hay ACMs activos para mostrar en el carrusel.
                </div>
              )}
            </section>

            <section className="home-mobile-queue">
              <div className="home-mobile-block-header">
                <div>
                  <span className="home-mobile-section-label">En foco</span>
                  <strong>Lo más urgente</strong>
                </div>
                <span className="home-mobile-feed__count">{actionableAcms.length} casos</span>
              </div>

              {actionableAcms.map((acm) => {
                const status = statusMeta(acm)
                return (
                  <article
                    key={acm.id}
                    className="home-mobile-list-card"
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
                    <div className="home-mobile-list-card__main">
                      <div>
                        <div className="kanban-card__title">{acm.nombre}</div>
                        <div className="kanban-card__address">{acm.direccion}</div>
                      </div>
                      <span className={`kanban-card__status kanban-card__status--${status.tone}`}>{status.label}</span>
                    </div>
                    <div className="home-mobile-list-card__meta">
                      <span>{comparablesLabel(acm)}</span>
                      <span>{new Date(acm.updated_at || acm.fecha_creacion).toLocaleDateString('es-AR')}</span>
                    </div>
                    <div className="kanban-card__insights">
                      <span className="kanban-card__chip">{stageProgress(acm)}</span>
                      <span className="kanban-card__chip">{acm.owner_username || 'Sin asignar'}</span>
                    </div>
                  </article>
                )
              })}
              {actionableAcms.length === 0 && (
                <div className="kanban-empty">
                  No hay casos urgentes en este momento.
                </div>
              )}
            </section>

            <nav className="home-mobile-dock" aria-label="Acciones rápidas">
              <button type="button" className="home-mobile-dock__primary home-mobile-dock__primary--solo" onClick={() => setQuickCreateOpen(true)}>
                + Tasación rápida
              </button>
            </nav>
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
