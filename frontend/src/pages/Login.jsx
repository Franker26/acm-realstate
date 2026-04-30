import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App.jsx'
import { getBrandingSettings } from '../api.js'
import { applyTheme, getSavedAppName, getSavedLogo, syncBranding } from '../theme.js'

const loginStats = [
  { value: '< 5 min', label: 'para abrir una tasación nueva' },
  { value: '4 etapas', label: 'desde sujeto hasta resultados' },
  { value: '1 reporte', label: 'listo para exportar y revisar' },
]

const loginSteps = [
  'Definís la propiedad sujeto con su ficha completa',
  'Sumás comparables y ajustás el contexto de mercado',
  'Validás resultados y exportás un informe listo para presentar',
]

const loginTrust = [
  'Aprobaciones y comentarios integrados',
  'Branding consistente en reportes',
  'Trazabilidad de cada tasación y sus cambios',
]

const loginSignals = [
  { label: 'Estado de carga', value: 'Activo', note: 'Microestados y overlays consistentes' },
  { label: 'Errores', value: 'Cuidado', note: 'Mensajes claros y rutas de recuperación' },
  { label: 'Output', value: 'Pro', note: 'PDF y flujo visual alineados al workspace' },
]

export default function Login() {
  const [appName, setAppName] = useState(() => getSavedAppName())
  const [logo, setLogo] = useState(() => getSavedLogo())
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
        setLogo(branding.logo_data_url || null)
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
        <div className="login-brand-lockup">
          <div className="login-brand-lockup__mark">
            {logo ? (
              <img src={logo} alt={`${appName} logo`} className="login-brand-lockup__logo" />
            ) : (
              <span>{appName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <span className="login-brand-lockup__eyebrow">Workspace de tasación</span>
            <strong>{appName}</strong>
          </div>
        </div>

        <div className="login-brand-panel__hero">
          <span className="page-eyebrow">Plataforma operativa</span>
          <h1>Entrá a un flujo de tasación pensado para decisiones serias.</h1>
          <p>
            Unificá sujeto, comparables, ponderadores y entrega final en una sola interfaz, con estados cuidados y presentación consistente.
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
              <span>Panel operativo</span>
            </div>
            <div className="login-preview__pill">Live workspace</div>
          </div>

          <div className="login-preview__hero">
            <div>
              <span className="login-preview__eyebrow">Tasación activa</span>
              <h2>Av. Libertador 2450</h2>
              <p>Comparables leídas, factores preparados y rango listo para validación comercial.</p>
            </div>
            <div className="login-preview__hero-metric">
              <span>Valor estimado</span>
              <strong>USD 284.000</strong>
            </div>
          </div>

          <div className="login-preview__columns">
            <div className="login-preview-column">
              <div className="login-preview-column__header">
                <strong>Comparables</strong>
                <span>Paso 2</span>
              </div>
              <div className="login-preview-card">
                <div className="login-preview-card__top">
                  <strong>Lectura activa</strong>
                  <span>zonaprop.com.ar</span>
                </div>
                <p>Extracción, verificación y carga contextual resueltas dentro del mismo flujo.</p>
              </div>
            </div>

            <div className="login-preview-column">
              <div className="login-preview-column__header">
                <strong>Resultado</strong>
                <span>Rango</span>
              </div>
              <div className="login-preview-chart">
                <div className="login-preview-chart__bar is-short" />
                <div className="login-preview-chart__bar is-mid" />
                <div className="login-preview-chart__bar is-tall" />
                <div className="login-preview-chart__bar is-mid" />
              </div>
            </div>
          </div>

          <div className="login-preview__footer">
            <div className="login-preview__progress">
              <span className="login-preview__progress-label">Preparando workspace...</span>
              <div className="login-preview__progress-track">
                <div className="login-preview__progress-fill" />
              </div>
            </div>
            <div className="login-preview__status">
              <span className="login-preview__status-dot" />
              <span>Diseño coherente para carga, error y entrega</span>
            </div>
          </div>
        </div>

        <div className="login-flow">
          {loginSteps.map((step, index) => (
            <div key={step} className="login-flow__item">
              <span className="login-flow__index">0{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <div className="login-signal-grid">
          {loginSignals.map((signal) => (
            <article key={signal.label} className="login-signal">
              <span className="login-signal__label">{signal.label}</span>
              <strong>{signal.value}</strong>
              <span>{signal.note}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card login-card--featured">
          <div className="login-card__brand-mobile">
            <div className="login-card__brand-mobile-mark">
              {logo ? (
                <img src={logo} alt={`${appName} logo`} className="login-brand-lockup__logo" />
              ) : (
                <span>{appName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <strong>{appName}</strong>
            <span>Workspace de tasaciones</span>
          </div>
          <div className="login-card__rail" aria-hidden="true" />
          <div className="login-card__header">
            <span className="login-card__eyebrow">Acceso seguro</span>
            <h2>Ingresar al workspace</h2>
            <p>Usá tu usuario y contraseña para retomar tus tasaciones, revisiones y exportaciones.</p>
          </div>
          <div className="login-card__support">
            {loginTrust.map((item) => (
              <div key={item} className="login-card__support-item">
                <span className="login-card__support-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group login-form-group">
              <label>Usuario</label>
              <input
                type="text"
                value={username}
                autoFocus
                autoComplete="username"
                placeholder="Ingresá tu usuario"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group login-form-group">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                placeholder="Ingresá tu contraseña"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="alert alert-error login-alert">{error}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading || !username || !password}
            >
              {loading ? <span className="spinner" /> : 'Ingresar'}
            </button>
          </form>
          <div className="login-card__footer">
            <div className="login-card__footer-item">
              <span className="login-card__footer-label">Entorno</span>
              <strong>Workspace operativo</strong>
            </div>
            <div className="login-card__footer-item">
              <span className="login-card__footer-label">Estado</span>
              <strong>{loading ? 'Validando acceso...' : 'Listo para ingresar'}</strong>
            </div>
          </div>
          <div className="login-card__footnote">
            <span className="login-card__footnote-dot" />
            <span>Acceso pensado para continuar rápido, sin perder contexto del flujo.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
