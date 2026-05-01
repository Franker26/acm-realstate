import React, { useEffect, useState } from 'react'
import {
  adminCheckIntegrationStatus,
  adminGetIntegrationSettings,
  adminUpdateIntegrationSettings,
} from '../../adminApi.js'

const SOURCE_LABELS = {
  zonaprop: 'Zonaprop',
  argenprop: 'Argenprop',
  mercadolibre: 'MercadoLibre',
}

export default function AdminSettings() {
  const [settings, setSettings] = useState({ scraper_service_url: '', scraper_service_token: '' })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGetIntegrationSettings()
      setSettings({
        scraper_service_url: data.scraper_service_url || '',
        scraper_service_token: data.scraper_service_token === '***' ? '***' : (data.scraper_service_token || ''),
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = {
        scraper_service_url: settings.scraper_service_url.trim() || null,
        scraper_service_token:
          settings.scraper_service_token === '***'
            ? '***'
            : settings.scraper_service_token.trim() || null,
      }
      const updated = await adminUpdateIntegrationSettings(payload)
      setSettings({
        scraper_service_url: updated.scraper_service_url || '',
        scraper_service_token: updated.scraper_service_token === '***' ? '***' : (updated.scraper_service_token || ''),
      })
      setSuccess('Configuración guardada.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCheck() {
    setChecking(true)
    setError(null)
    setStatus(null)
    try {
      const data = await adminCheckIntegrationStatus()
      setStatus(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }

  function set(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSuccess(null)
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Configuración de la plataforma</h1>
      </div>

      <div className="admin-card" style={{ maxWidth: 600 }}>
        <h2 className="admin-card__title">Microservicio scraper</h2>
        <p className="admin-card__desc">
          Todas las fuentes de datos (Zonaprop, Argenprop, MercadoLibre) utilizan este servicio centralizado.
        </p>

        {loading ? (
          <p>Cargando…</p>
        ) : (
          <form onSubmit={handleSave} className="admin-form">
            <div className="admin-form__field">
              <label className="admin-form__label">URL del scraper</label>
              <input
                className="admin-input"
                type="url"
                placeholder="https://scraper.ejemplo.com"
                value={settings.scraper_service_url}
                onChange={(e) => set('scraper_service_url', e.target.value)}
              />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Token de autenticación</label>
              <input
                className="admin-input"
                type="password"
                placeholder={settings.scraper_service_token === '***' ? '(guardado)' : 'Token Bearer'}
                value={settings.scraper_service_token === '***' ? '' : settings.scraper_service_token}
                onChange={(e) => set('scraper_service_token', e.target.value)}
              />
            </div>

            {error && <p className="admin-error">{error}</p>}
            {success && <p className="admin-success">{success}</p>}

            <div className="admin-form__actions">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={handleCheck}
                disabled={checking || !settings.scraper_service_url.trim()}
              >
                {checking ? 'Verificando…' : 'Verificar conexión'}
              </button>
            </div>
          </form>
        )}

        {status && (
          <div className="admin-status-panel" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span
                className={`integration-card__dot integration-card__dot--${status.connected ? 'ok' : 'error'}`}
              />
              <strong>{status.connected ? 'Conectado' : 'Sin conexión'}</strong>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {(status.sources || []).map((key) => (
                <span key={key} className="settings-badge settings-badge--admin" style={{ fontSize: '0.78rem' }}>
                  {SOURCE_LABELS[key] || key}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
