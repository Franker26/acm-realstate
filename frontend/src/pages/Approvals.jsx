import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getACM, listPendingApprovals, reviewACM } from '../api.js'
import { useAuth } from '../App.jsx'

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
    return <div className="alert alert-error">No tenés permisos para revisar aprobaciones.</div>
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

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {loading ? (
        <p style={{ color: '#777' }}>Cargando pendientes...</p>
      ) : (
        <div className="approvals-layout">
          <div className="card">
            <h2>Pendientes</h2>
            {items.length === 0 ? (
              <p style={{ color: '#777', margin: 0 }}>No hay tasaciones pendientes de aprobación.</p>
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
            {detailLoading && <p style={{ color: '#777' }}>Cargando tasación...</p>}
            {!detailLoading && !selected && <p style={{ color: '#777' }}>Seleccioná una tasación para revisar.</p>}

            {!detailLoading && selected && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{selected.nombre}</div>
                  <div style={{ color: '#666', marginTop: 4 }}>{selected.direccion}</div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Observaciones</h3>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => setComments((prev) => [...prev, emptyComment()])}
                    >
                      + Agregar warning
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
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

                <div className="btn-group" style={{ justifyContent: 'space-between' }}>
                  <button className="btn btn-secondary" onClick={() => navigate(`/acm/${selected.id}/step/4`)}>
                    Abrir resultados
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
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
