import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App.jsx'
import { getBrandingSettings } from '../api.js'
import { applyTheme, getSavedAppName, syncBranding } from '../theme.js'

const loginStats = [
  { value: '< 5 min', label: 'para iniciar una tasación' },
  { value: '1 flujo', label: 'desde sujeto hasta PDF' },
  { value: '100%', label: 'trazabilidad del trabajo' },
]

const loginSteps = [
  'Cargás la propiedad sujeto',
  'Sumás comparables del mercado',
  'Ajustás factores y validás el rango',
]

const loginTrust = [
  'Workflow completo de sujeto a PDF',
  'Aprobaciones y comentarios integrados',
  'Branding consistente en reportes',
]

export default function Login() {
  const [appName, setAppName] = useState(() => getSavedAppName())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  React.useEffect(() => {
    getBrandingSettings()
      .then((branding) => {
        syncBranding(branding)
        applyTheme(branding.primary_color)
        setAppName(branding.app_name)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      navigate('/')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-layout">
      <section className="login-brand-panel">
        <div className="login-brand-panel__hero">
          <span className="page-eyebrow">Plataforma de tasación</span>
          <h1>{appName}</h1>
          <p>
            Entrá a un workspace pensado para tasar con criterio, velocidad y una presentación que transmite solidez.
          </p>
        </div>

        <div className="login-stats-row">
          {loginStats.map((item) => (
            <div key={item.label} className="login-stat">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="login-preview">
          <div className="login-preview__topbar">
            <div className="login-preview__title">
              <span className="login-preview__dot" />
              <span>Tablero operativo</span>
            </div>
            <div className="login-preview__pill">3 comparables</div>
          </div>

          <div className="login-preview__hero">
            <div>
              <span className="login-preview__eyebrow">Tasación activa</span>
              <h2>Av. Libertador 2450</h2>
              <p>Comparables precargadas, ajustes pendientes y reporte listo para revisión.</p>
            </div>
            <div className="login-preview__hero-metric">
              <span>Estimado</span>
              <strong>USD 284.000</strong>
            </div>
          </div>

          <div className="login-preview__columns">
            <div className="login-preview-column">
              <div className="login-preview-column__header">
                <strong>En progreso</strong>
                <span>2</span>
              </div>
              <div className="login-preview-card">
                <div className="login-preview-card__top">
                  <strong>Comparables listas</strong>
                  <span>Hoy</span>
                </div>
                <p>Mercado consistente y rango ajustado estable.</p>
              </div>
            </div>

            <div className="login-preview-column">
              <div className="login-preview-column__header">
                <strong>Resultado</strong>
                <span>OK</span>
              </div>
              <div className="login-preview-chart">
                <div className="login-preview-chart__bar is-short" />
                <div className="login-preview-chart__bar is-mid" />
                <div className="login-preview-chart__bar is-tall" />
                <div className="login-preview-chart__bar is-mid" />
              </div>
            </div>
          </div>
        </div>

        <p>
          Cargá comparables, ajustá ponderadores y exportá reportes profesionales desde un mismo flujo.
        </p>

        <div className="login-flow">
          {loginSteps.map((step, index) => (
            <div key={step} className="login-flow__item">
              <span className="login-flow__index">0{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card__header">
            <span className="login-card__eyebrow">Acceso seguro</span>
            <h2>Ingresar al workspace</h2>
            <p>Usá tu usuario y contraseña para continuar con tus tasaciones.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Usuario</label>
              <input
                type="text"
                value={username}
                autoFocus
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading || !username || !password}
            >
              {loading ? <span className="spinner" /> : 'Ingresar'}
            </button>
          </form>

          <div className="login-card__support">
            {loginTrust.map((item) => (
              <div key={item} className="login-card__support-item">
                <span className="login-card__support-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
