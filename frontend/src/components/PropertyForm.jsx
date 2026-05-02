import React from 'react'

const TIPOS = ['Departamento', 'PH', 'Casa', 'Local']
const ORIENTACIONES = ['Norte', 'Sur', 'Este', 'Oeste', 'Interno']
const ESTADOS = ['Refaccionado', 'Standard', 'A refaccionar']
const CALIDADES = ['Superior', 'Standard', 'Inferior']
const DISTRIBUCIONES = ['Buena', 'Regular']

// Adjustment factor hints per option, relative to a Standard/Buena/Norte subject baseline.
// Values represent the typical factor when this option is the comparable (vs. Standard subject).
const FACTOR_HINTS = {
  estado: { Refaccionado: -10, Standard: 0, 'A refaccionar': +10 },
  calidad: { Superior: -10, Standard: 0, Inferior: +10 },
  distribucion: { Buena: 0, Regular: +5 },
  orientacion: { Norte: 0, Sur: +5, Este: 0, Oeste: 0, Interno: +10 },
}

function withHint(field, label) {
  const pct = FACTOR_HINTS[field]?.[label]
  if (pct === undefined || pct === 0) return label
  return `${label} (${pct > 0 ? '+' : ''}${pct}%)`
}

function homogeneizada(v) {
  const cub = parseFloat(v.superficie_cubierta) || 0
  const semi = parseFloat(v.superficie_semicubierta) || 0
  const desc = parseFloat(v.superficie_descubierta) || 0
  return cub + 0.5 * semi + 0.3 * desc
}

export default function PropertyForm({ values, onChange, errors = {}, hideTipo = false }) {
  function handle(e) {
    const { name, value, type, checked } = e.target
    onChange(name, type === 'checkbox' ? checked : value)
  }

  const homo = homogeneizada(values)

  return (
    <div>
      {/* Superficies */}
      <div className="form-section-title">Superficies</div>
      <div className="form-grid">
        {!hideTipo && (
          <div className="form-group">
            <label>Tipo *</label>
            <select name="tipo" value={values.tipo || ''} onChange={handle} tabIndex={1}>
              <option value="">Seleccionar...</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.tipo && <span className="error-msg">{errors.tipo}</span>}
          </div>
        )}

        <div className="form-group">
          <label>Superficie cubierta (m²) *</label>
          <input type="number" name="superficie_cubierta" min="0.01" step="0.01" tabIndex={2}
            value={values.superficie_cubierta || ''} onChange={handle} />
          {errors.superficie_cubierta && <span className="error-msg">{errors.superficie_cubierta}</span>}
        </div>

        <div className="form-group">
          <label>Superficie semicubierta (m²)</label>
          <input type="number" name="superficie_semicubierta" min="0" step="0.01" tabIndex={3}
            value={values.superficie_semicubierta || ''} onChange={handle} />
        </div>

        <div className="form-group">
          <label>Superficie descubierta (m²)</label>
          <input type="number" name="superficie_descubierta" min="0" step="0.01" tabIndex={4}
            value={values.superficie_descubierta || ''} onChange={handle} />
        </div>

        {homo > 0 && (
          <div className="form-group full">
            <div className="surface-computed-row">
              <div className="surface-computed">
                Sup. total: <strong>{((parseFloat(values.superficie_cubierta)||0) + (parseFloat(values.superficie_semicubierta)||0) + (parseFloat(values.superficie_descubierta)||0)).toFixed(2)} m²</strong>
              </div>
              <div className="surface-computed">
                Sup. homogeneizada: <strong>{homo.toFixed(2)} m²</strong>
                <span className="surface-computed-formula">
                  {' '}= {(parseFloat(values.superficie_cubierta)||0).toFixed(2)}
                  {parseFloat(values.superficie_semicubierta) > 0 ? ` + 0.5×${parseFloat(values.superficie_semicubierta).toFixed(2)}` : ''}
                  {parseFloat(values.superficie_descubierta) > 0 ? ` + 0.3×${parseFloat(values.superficie_descubierta).toFixed(2)}` : ''}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Características */}
      <div className="form-section-title" style={{ marginTop: 18 }}>Características</div>
      <div className="form-grid">
        <div className="form-group">
          <label>Piso</label>
          <input type="number" name="piso" min="0" step="1" tabIndex={5}
            value={values.piso || ''} onChange={handle} />
        </div>

        <div className="form-group">
          <label>Antigüedad (años)</label>
          <input type="number" name="antiguedad" min="0" step="1" tabIndex={6}
            value={values.antiguedad || ''} onChange={handle} />
        </div>
      </div>

      {/* Estado y calidad */}
      <div className="form-section-title" style={{ marginTop: 18 }}>Estado y calidad</div>
      <div className="form-grid">
        <div className="form-group">
          <label>Estado</label>
          <select name="estado" value={values.estado || ''} onChange={handle} tabIndex={7}>
            <option value="">Seleccionar...</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{withHint('estado', e)}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Calidad</label>
          <select name="calidad" value={values.calidad || ''} onChange={handle} tabIndex={8}>
            <option value="">Seleccionar...</option>
            {CALIDADES.map((c) => <option key={c} value={c}>{withHint('calidad', c)}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Distribución</label>
          <select name="distribucion" value={values.distribucion || ''} onChange={handle} tabIndex={9}>
            <option value="">Seleccionar...</option>
            {DISTRIBUCIONES.map((d) => <option key={d} value={d}>{withHint('distribucion', d)}</option>)}
          </select>
        </div>
      </div>

      {/* Orientación y amenities */}
      <div className="form-section-title" style={{ marginTop: 18 }}>Orientación y amenities</div>
      <div className="form-grid">
        <div className="form-group">
          <label>Orientación</label>
          <select name="orientacion" value={values.orientacion || ''} onChange={handle} tabIndex={10}>
            <option value="">Seleccionar...</option>
            {ORIENTACIONES.map((o) => <option key={o} value={o}>{withHint('orientacion', o)}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Amenities</label>
          <div className="checkbox-row">
            <label>
              <input type="checkbox" name="cochera" tabIndex={11} checked={!!values.cochera} onChange={handle} />
              Cochera
            </label>
            <label>
              <input type="checkbox" name="pileta" tabIndex={12} checked={!!values.pileta} onChange={handle} />
              Pileta
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
