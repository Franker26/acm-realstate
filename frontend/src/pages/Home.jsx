import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listACMs, deleteACM } from '../api.js'
import { useWizard } from '../App.jsx'

export default function Home() {
  const [acms, setAcms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { dispatch } = useWizard()
  const navigate = useNavigate()

  useEffect(() => {
    listACMs()
      .then(setAcms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleNew() {
    dispatch({ type: 'RESET' })
    navigate('/acm/tipo')
  }

  async function handleDelete(id, nombre) {
    if (!confirm(`¿Eliminar el ACM "${nombre}"?`)) return
    try {
      await deleteACM(id)
      setAcms((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      alert('Error al eliminar: ' + e.message)
    }
  }

  function handleContinue(acm) {
    dispatch({ type: 'SET_ACM_ID', payload: acm.id })
    navigate(`/acm/${acm.id}/step/2`)
  }

  return (
    <div>
      <div className="home-hero">
        <h1>Análisis Comparativo de Mercado</h1>
        <p>Tasación inmobiliaria asistida — ingresá la propiedad y sus comparables para obtener el precio de mercado.</p>
        <button className="btn btn-primary" onClick={handleNew}>+ Nueva Tasación</button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && acms.length > 0 && (
        <div className="card">
          <h2>Tasaciones anteriores</h2>
          <ul className="acm-list">
            {acms.map((a) => (
              <li key={a.id} className="acm-list-item">
                <div>
                  <div className="acm-name">{a.nombre}</div>
                  <div className="acm-meta">
                    {a.direccion} · {a.cantidad_comparables} comparable{a.cantidad_comparables !== 1 ? 's' : ''} · {new Date(a.fecha_creacion).toLocaleDateString('es-AR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleContinue(a)}>Continuar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id, a.nombre)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && acms.length === 0 && !error && (
        <p style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>No hay tasaciones guardadas.</p>
      )}
    </div>
  )
}
