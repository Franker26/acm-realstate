import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { createACM, getACM, updateACM } from '../api.js'
import { useWizard, WizardNav } from '../App.jsx'
import AddressAutocomplete from '../components/AddressAutocomplete.jsx'
import PropertyForm from '../components/PropertyForm.jsx'

const EMPTY = {
  nombre: '',
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
  notas: '',
}

function fromACM(acm) {
  return {
    nombre: acm.nombre || '',
    direccion: acm.direccion || '',
    tipo: acm.tipo || '',
    superficie_cubierta: acm.superficie_cubierta ?? '',
    superficie_semicubierta: acm.superficie_semicubierta ?? '',
    superficie_descubierta: acm.superficie_descubierta ?? '',
    piso: acm.piso ?? '',
    antiguedad: acm.antiguedad ?? '',
    orientacion: acm.orientacion || '',
    estado: acm.estado || '',
    calidad: acm.calidad || '',
    distribucion: acm.distribucion || '',
    cochera: acm.cochera || false,
    pileta: acm.pileta || false,
    notas: acm.notas || '',
  }
}

function validate(v) {
  const err = {}
  if (!v.nombre.trim()) err.nombre = 'Requerido'
  if (!v.direccion.trim()) err.direccion = 'Requerido'
  if (!v.tipo) err.tipo = 'Requerido'
  if (!v.superficie_cubierta || Number(v.superficie_cubierta) <= 0)
    err.superficie_cubierta = 'Debe ser mayor a 0'
  return err
}

function toPayload(v) {
  return {
    nombre: v.nombre.trim(),
    direccion: v.direccion.trim(),
    tipo: v.tipo,
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
    notas: v.notas.trim() || null,
  }
}

export default function NuevaTasacion() {
  const { id } = useParams()
  const location = useLocation()
  const preselectedTipo = location.state?.tipo || ''
  const [values, setValues] = useState({ ...EMPTY, tipo: preselectedTipo })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [loading, setLoading] = useState(!!id)
  const { dispatch } = useWizard()
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    getACM(id)
      .then((acm) => {
        setValues(fromACM(acm))
        dispatch({ type: 'SET_ACM_ID', payload: acm.id })
      })
      .catch((e) => setApiError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleChange(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate(values)
    if (Object.keys(err).length) { setErrors(err); return }
    setSubmitting(true)
    setApiError(null)
    try {
      let acm
      if (id) {
        acm = await updateACM(id, toPayload(values))
      } else {
        acm = await createACM(toPayload(values))
      }
      dispatch({ type: 'SET_ACM_ID', payload: acm.id })
      navigate(`/acm/${acm.id}/step/2`)
    } catch (e) {
      setApiError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p style={{ padding: 24 }}>Cargando...</p>

  return (
    <div>
      <WizardNav currentStep={1} />
      <div className="step-header">
        <h1>{id ? 'Editar tasación' : 'Nueva Tasación'}</h1>
        <p>Ingresá los datos de la propiedad a tasar (sujeto del ACM).</p>
      </div>

      {apiError && <div className="alert alert-error">{apiError}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>Identificación</h2>
          {preselectedTipo && !id && (
            <div className="tipo-badge-selected">
              Tipo seleccionado: <strong>{preselectedTipo}</strong>
              <button type="button" className="tipo-badge-change" onClick={() => navigate('/acm/tipo')}>Cambiar</button>
            </div>
          )}
          <div className="form-grid">
            <div className="form-group full">
              <label>Nombre del ACM *</label>
              <input type="text" name="nombre" value={values.nombre} tabIndex={0}
                onChange={(e) => handleChange('nombre', e.target.value)}
                placeholder="Ej: Tasación Av. Corrientes 1234" />
              {errors.nombre && <span className="error-msg">{errors.nombre}</span>}
            </div>
            <div className="form-group full">
              <label>Dirección / Zona *</label>
              <AddressAutocomplete
                name="direccion"
                value={values.direccion}
                tabIndex={0}
                placeholder="Ej: Av. Corrientes 1234, CABA"
                onChange={(v) => handleChange('direccion', v)}
              />
              {errors.direccion && <span className="error-msg">{errors.direccion}</span>}
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Características de la Propiedad</h2>
          <PropertyForm values={values} onChange={handleChange} errors={errors} hideTipo={!!preselectedTipo && !id} />
        </div>

        <div className="card">
          <h2>Notas</h2>
          <div className="form-group">
            <label>Observaciones (opcional)</label>
            <textarea name="notas" rows={3} value={values.notas} tabIndex={13}
              onChange={(e) => handleChange('notas', e.target.value)}
              placeholder="Notas adicionales sobre la propiedad..." />
          </div>
        </div>

        <div className="btn-group">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting && <span className="spinner" />}
            {id ? 'Guardar y continuar →' : 'Continuar → Paso 2'}
          </button>
        </div>
      </form>
    </div>
  )
}
