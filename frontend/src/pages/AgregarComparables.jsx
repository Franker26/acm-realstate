import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addComparable, deleteComparable, extractZonaprop, getACM, updateComparable } from '../api.js'
import { useWizard, WizardNav } from '../App.jsx'
import PropertyForm from '../components/PropertyForm.jsx'
import SmartLoader from '../components/SmartLoader.jsx'

const EMPTY_COMP = {
  url: '',
  precio: '',
  dias_mercado: '',
  oportunidad_mercado: false,
  direccion: '',
  tipo: '',
  superficie_cubierta: '',
  superficie_semicubierta: '',
  superficie_descubierta: '',
  piso: '',
  antiguedad: '',
  orientacion: '',
  estado: '',
  calidad: '',
  distribucion: '',
  cochera: false,
  pileta: false,
}

function toPayload(v) {
  return {
    url: v.url.trim() || null,
    precio: Number(v.precio),
    dias_mercado: v.dias_mercado ? Number(v.dias_mercado) : null,
    oportunidad_mercado: v.oportunidad_mercado,
    direccion: v.direccion.trim() || null,
    tipo: v.tipo || null,
    superficie_cubierta: Number(v.superficie_cubierta),
    superficie_semicubierta: v.superficie_semicubierta ? Number(v.superficie_semicubierta) : null,
    superficie_descubierta: v.superficie_descubierta ? Number(v.superficie_descubierta) : null,
    piso: v.piso ? Number(v.piso) : null,
    antiguedad: v.antiguedad ? Number(v.antiguedad) : null,
    orientacion: v.orientacion || null,
    estado: v.estado || null,
    calidad: v.calidad || null,
    distribucion: v.distribucion || null,
    cochera: v.cochera,
    pileta: v.pileta,
  }
}

function homoM2(comp) {
  const h = comp.superficie_cubierta
    + 0.5 * (comp.superficie_semicubierta || 0)
    + 0.3 * (comp.superficie_descubierta || 0)
  return h > 0 ? h : comp.superficie_cubierta
}

export default function AgregarComparables() {
  const { id } = useParams()
  const [comparables, setComparables] = useState([])
  const [form, setForm] = useState(EMPTY_COMP)
  const [editId, setEditId] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)
  const [extractPreview, setExtractPreview] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const { dispatch } = useWizard()
  const navigate = useNavigate()

  useEffect(() => {
    getACM(id).then((acm) => {
      setComparables(acm.comparables)
      dispatch({ type: 'SET_ACM_ID', payload: acm.id })
      // Show form immediately only when there are no comparables yet
      setShowForm(acm.comparables.length === 0)
      setPageReady(true)
    })
  }, [id])

  function handleChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  function validate(v) {
    const err = {}
    if (!v.precio || Number(v.precio) <= 0) err.precio = 'Requerido'
    if (!v.superficie_cubierta || Number(v.superficie_cubierta) <= 0)
      err.superficie_cubierta = 'Debe ser mayor a 0'
    return err
  }

  async function handleExtract() {
    if (!form.url || !form.url.includes('zonaprop.com.ar')) return
    setExtracting(true)
    setExtractError(null)
    try {
      const data = await extractZonaprop(form.url)
      setExtractPreview(data)
    } catch (e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  function handleConfirmExtract() {
    const data = extractPreview
    setForm((prev) => ({
      ...prev,
      ...(data.precio != null ? { precio: String(data.precio) } : {}),
      ...(data.dias_mercado != null ? { dias_mercado: String(data.dias_mercado) } : {}),
      ...(data.direccion ? { direccion: data.direccion } : {}),
      ...(data.superficie_cubierta != null ? { superficie_cubierta: String(data.superficie_cubierta) } : {}),
      ...(data.tipo ? { tipo: data.tipo } : {}),
      ...(data.orientacion ? { orientacion: data.orientacion } : {}),
      ...(data.antiguedad != null ? { antiguedad: String(data.antiguedad) } : {}),
    }))
    setExtractPreview(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate(form)
    if (Object.keys(err).length) { setErrors(err); return }
    setSubmitting(true)
    setApiError(null)
    try {
      if (editId) {
        const updated = await updateComparable(id, editId, toPayload(form))
        setComparables((prev) => prev.map((c) => (c.id === editId ? updated : c)))
      } else {
        const added = await addComparable(id, toPayload(form))
        setComparables((prev) => [...prev, added])
      }
      setForm(EMPTY_COMP)
      setEditId(null)
      setShowForm(false)
    } catch (e) {
      setApiError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(comp) {
    setForm({
      url: comp.url || '',
      precio: comp.precio || '',
      dias_mercado: comp.dias_mercado || '',
      oportunidad_mercado: comp.oportunidad_mercado || false,
      direccion: comp.direccion || '',
      tipo: comp.tipo || '',
      superficie_cubierta: comp.superficie_cubierta || '',
      superficie_semicubierta: comp.superficie_semicubierta ?? '',
      superficie_descubierta: comp.superficie_descubierta ?? '',
      piso: comp.piso ?? '',
      antiguedad: comp.antiguedad ?? '',
      orientacion: comp.orientacion || '',
      estado: comp.estado || '',
      calidad: comp.calidad || '',
      distribucion: comp.distribucion || '',
      cochera: comp.cochera || false,
      pileta: comp.pileta || false,
    })
    setEditId(comp.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(cid) {
    if (!confirm('¿Eliminar esta comparable?')) return
    try {
      await deleteComparable(id, cid)
      setComparables((prev) => prev.filter((c) => c.id !== cid))
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  function handleCancel() {
    setForm(EMPTY_COMP)
    setEditId(null)
    setShowForm(false)
  }

  const logoSrc = typeof localStorage !== 'undefined' ? localStorage.getItem('acm_theme_logo') : null

  if (!pageReady) return null

  return (
    <div>
      <SmartLoader loading={extracting} logoSrc={logoSrc} />
      <WizardNav currentStep={2} />
      <div className="step-header">
        <h1>Agregar Comparables</h1>
        <p>Cargá las propiedades comparables extraídas de ZonaProp, Argenprop, etc.</p>
      </div>

      {apiError && <div className="alert alert-error">{apiError}</div>}

      {comparables.length > 0 && (
        <div className="card">
          <h2>Comparables cargadas ({comparables.length})</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Dirección / URL</th>
                  <th>Precio USD</th>
                  <th>Sup. hom. m²</th>
                  <th>USD/m²</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((c, i) => {
                  const h = homoM2(c)
                  const pm2 = c.precio_m2_publicado ?? Math.round(c.precio / c.superficie_cubierta)
                  return (
                    <tr key={c.id}>
                      <td>{i + 1}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.direccion || c.url || '—'}
                      </td>
                      <td>USD {c.precio.toLocaleString('es-AR')}</td>
                      <td>{h.toFixed(1)} m²</td>
                      <td>USD {Math.round(pm2).toLocaleString('es-AR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(c)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>×</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm ? (
        <div className="card">
          <h2>{editId ? 'Editar comparable' : 'Nueva comparable'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group full">
                <label>URL de publicación</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="url" name="url" value={form.url} tabIndex={1}
                    style={{ flex: 1 }}
                    onChange={(e) => { handleChange('url', e.target.value); setExtractError(null) }}
                    placeholder="https://www.zonaprop.com.ar/..." />
                  {form.url.includes('zonaprop.com.ar') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleExtract}
                      disabled={extracting}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {extracting ? 'Extrayendo...' : '⬇ Extraer datos'}
                    </button>
                  )}
                </div>
                {extractError && (
                  <div className="alert alert-error" style={{ marginTop: 6, fontSize: 13 }}>
                    {extractError}
                  </div>
                )}
              </div>
              <div className="form-group full">
                <label>Dirección</label>
                <input type="text" name="direccion" value={form.direccion} tabIndex={2}
                  onChange={(e) => handleChange('direccion', e.target.value)}
                  placeholder="Ej: Av. Corrientes 1234" />
              </div>
              <div className="form-group">
                <label>Precio publicado (USD) *</label>
                <input type="number" name="precio" min="1" step="1" tabIndex={3}
                  value={form.precio} onChange={(e) => handleChange('precio', e.target.value)} />
                {errors.precio && <span className="error-msg">{errors.precio}</span>}
              </div>
              <div className="form-group">
                <label>Días en el mercado</label>
                <input type="number" name="dias_mercado" min="0" step="1" tabIndex={4}
                  value={form.dias_mercado} onChange={(e) => handleChange('dias_mercado', e.target.value)} />
              </div>
              <div className="form-group full">
                <label>Oportunidad de mercado</label>
                <div className="checkbox-row">
                  <label style={{ whiteSpace: 'nowrap' }}>
                    <input type="checkbox" tabIndex={5} checked={form.oportunidad_mercado}
                      onChange={(e) => handleChange('oportunidad_mercado', e.target.checked)} />
                    Precio competitivo (aplica ×0.95)
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <PropertyForm values={form} onChange={handleChange} errors={errors} />
            </div>

            <div className="btn-group">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && <span className="spinner" />}
                {editId ? 'Guardar cambios' : 'Agregar comparable'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn-secondary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_COMP) }}>
            + Agregar otra comparable
          </button>
        </div>
      )}

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={() => navigate(`/acm/${id}/step/1`)}>← Paso 1</button>
        <button className="btn btn-primary" disabled={comparables.length === 0}
          onClick={() => navigate(`/acm/${id}/step/3`)}>
          Continuar → Paso 3
        </button>
      </div>
      {comparables.length === 0 && (
        <p className="error-msg" style={{ textAlign: 'right', marginTop: 4 }}>Agregá al menos una comparable para continuar.</p>
      )}

      {extractPreview && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.box}>
            <h3 style={{ marginTop: 0 }}>Datos extraídos de Zonaprop</h3>
            <p style={{ color: '#666', marginBottom: 16 }}>Revisá los datos encontrados y confirmá para cargarlos en el formulario.</p>
            <table style={modalStyles.table}>
              <tbody>
                {extractPreview.precio != null && (
                  <tr><td style={modalStyles.label}>Precio</td><td><strong>USD {extractPreview.precio.toLocaleString('es-AR')}</strong></td></tr>
                )}
                {extractPreview.direccion && (
                  <tr><td style={modalStyles.label}>Dirección</td><td>{extractPreview.direccion}</td></tr>
                )}
                {extractPreview.superficie_cubierta != null && (
                  <tr><td style={modalStyles.label}>Sup. cubierta</td><td>{extractPreview.superficie_cubierta} m²</td></tr>
                )}
                {extractPreview.tipo && (
                  <tr><td style={modalStyles.label}>Tipo</td><td>{extractPreview.tipo}</td></tr>
                )}
                {extractPreview.dias_mercado != null && (
                  <tr><td style={modalStyles.label}>Días en mercado</td><td>{extractPreview.dias_mercado}</td></tr>
                )}
                {extractPreview.orientacion && (
                  <tr><td style={modalStyles.label}>Orientación</td><td>{extractPreview.orientacion}</td></tr>
                )}
                {extractPreview.antiguedad != null && (
                  <tr><td style={modalStyles.label}>Antigüedad</td><td>{extractPreview.antiguedad} años</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setExtractPreview(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleConfirmExtract}>Confirmar e insertar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  box: {
    background: '#fff', borderRadius: 12, padding: 32, maxWidth: 480, width: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
  },
  label: {
    color: '#888', paddingRight: 16, paddingBottom: 8, verticalAlign: 'top', whiteSpace: 'nowrap',
  },
}
