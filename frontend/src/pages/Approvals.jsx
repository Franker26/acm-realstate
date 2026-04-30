import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getACM, listPendingApprovals, reviewACM } from '../api.js'
import { useAuth, useWizard } from '../App.jsx'
import { LoadingState, StateCard } from '../components/StatusState.jsx'

const SECTION_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'sujeto', label: 'Propiedad sujeto' },
  { value: 'comparables', label: 'Comparables' },
  { value: 'ponderadores', label: 'Ponderadores' },
  { value: 'resultados', label: 'Resultados' },
  { value: 'pdf', label: 'Exportación PDF' },
]

function emptyComment() {
  return { section: 'general', message: '' }
}

export default function Approvals() {
  const { user } = useAuth()
  const { dispatch } = useWizard()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [comments, setComments] = useState([emptyComment()])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!user?.is_approver) return
    listPendingApprovals()
      .then((data) => {
        setItems(data)
        if (data[0]) setSelectedId(data[0].id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!selectedId) {
      setSelected(null)
      return
    }
    setDetailLoading(true)
    getACM(selectedId)
      .then((data) => {
        setSelected(data)
        setComments(data.approval_comments?.length ? data.approval_comments.map((c) => ({
          section: c.section,
          message: c.message,
        })) : [emptyComment()])
      })
      .catch((e) => setError(e.message))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  if (!user?.is_approver) {
    return (
      <StateCard
        eyebrow="Acceso restringido"
        title="No tenés permisos para revisar aprobaciones"
        description="Necesitás un perfil aprobador para entrar en esta cola de revisión."
        tone="error"
        actions={<button className="btn btn-primary" onClick={() => navigate('/')}>Volver al tablero</button>}
      />
    )
  }

  async function handleReview(status) {
    if (!selected) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        status,
        comments: comments.filter((c) => c.message.trim()).map((c) => ({
          section: c.section,
          message: c.message.trim(),
        })),
      }
      await reviewACM(selected.id, payload)
      setItems((prev) => prev.filter((item) => item.id !== selected.id))
      setMessage(status === 'Aprobado' ? 'Tasación aprobada.' : 'Cambios solicitados al tasador.')
      setSelectedId((prev) => {
        const rest = items.filter((item) => item.id !== prev)
        return rest[0]?.id || null
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="step-header">
        <h1>Cola de aprobaciones</h1>
        <p>Revisá tasaciones pendientes, dejá observaciones por sección y aprobá cuando estén listas.</p>
      </div>

      {error && (
        <StateCard
          eyebrow="No pudimos cargar la cola"
          title="La revisión quedó interrumpida"
          description={error}
          tone="error"
          mode="inline"
        />
      )}
      {message && <div className="alert alert-success">{message}</div>}

      {loading ? (
        <LoadingState
          eyebrow="Aprobaciones"
          title="Estamos cargando las tasaciones pendientes"
          subtitle="Armamos la cola de revisión con detalle, comentarios y estado."
          messages={['Cargando pendientes...', 'Preparando revisión...', 'Recuperando observaciones...']}
        />
      ) : (
        <div className="approvals-layout">
          <div className="card">
            <h2>Pendientes</h2>
            {items.length === 0 ? (
              <StateCard
                eyebrow="Cola vacía"
                title="No hay tasaciones pendientes"
                description="Cuando el equipo envíe casos a revisión, los vas a ver listados acá."
                tone="empty"
                mode="inline"
              />
            ) : (
              <div className="approvals-list">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`approvals-list__item${selectedId === item.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <strong>{item.nombre}</strong>
                    <span>{item.direccion}</span>
                    <span>{item.owner_username || 'Sin usuario'} · {item.cantidad_comparables} comp.</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Detalle</h2>
            {detailLoading && (
              <LoadingState
                eyebrow="Detalle"
                title="Cargando la tasación seleccionada"
                subtitle="Traemos comparables, superficie y comentarios para revisar en contexto."
                messages={['Cargando tasación...', 'Preparando detalle...', 'Abriendo revisión...']}
                mode="inline"
              />
            )}
            {!detailLoading && !selected && (
              <StateCard
                eyebrow="Sin selección"
                title="Elegí una tasación para revisar"
                description="Cuando selecciones un caso de la columna izquierda, vas a ver su detalle acá."
                tone="empty"
                mode="inline"
              />
            )}

            {!detailLoading && selected && (
              <div className="approvals-detail">
                <div className="approvals-detail__hero">
                  <div className="approvals-detail__title">{selected.nombre}</div>
                  <div className="approvals-detail__address">{selected.direccion}</div>
                  <div className="approvals-detail__meta">
                    {selected.owner_username} · {selected.comparables.length} comparables · etapa {selected.stage}
                  </div>
                </div>

                <div className="approval-summary">
                  <div>
                    <span className="approval-summary__label">Sujeto</span>
                    <strong>{selected.tipo} · {selected.superficie_homogeneizada.toFixed(1)} m²</strong>
                  </div>
                  <div>
                    <span className="approval-summary__label">Estado actual</span>
                    <strong>{selected.approval_status}</strong>
                  </div>
                </div>

                <div>
                  <div className="approvals-comments-header">
                    <h3 className="approvals-comments-header__title">Observaciones</h3>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => setComments((prev) => [...prev, emptyComment()])}
                    >
                      + Agregar warning
                    </button>
                  </div>

                  <div className="approvals-comments-list">
                    {comments.map((comment, index) => (
                      <div key={`${comment.section}-${index}`} className="approval-comment-row">
                        <select
                          value={comment.section}
                          onChange={(e) => setComments((prev) => prev.map((item, i) => (
                            i === index ? { ...item, section: e.target.value } : item
                          )))}
                        >
                          {SECTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <textarea
                          rows={2}
                          value={comment.message}
                          placeholder="Detalle del warning o ajuste requerido..."
                          onChange={(e) => setComments((prev) => prev.map((item, i) => (
                            i === index ? { ...item, message: e.target.value } : item
                          )))}
                        />
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setComments((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="btn-group approvals-actions">
                  <button className="btn btn-secondary" onClick={() => {
                    dispatch({ type: 'SET_ACM_ID', payload: selected.id })
                    navigate(`/acm/${selected.id}/step/4`)
                  }}>
                    Abrir resultados
                  </button>
                  <div className="approvals-actions__group">
                    <button className="btn btn-secondary" onClick={() => handleReview('Cambios solicitados')} disabled={saving}>
                      Solicitar cambios
                    </button>
                    <button className="btn btn-primary" onClick={() => handleReview('Aprobado')} disabled={saving}>
                      {saving && <span className="spinner" />}
                      Aprobar tasación
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
