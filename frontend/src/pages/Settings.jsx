import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../App.jsx'
import {
  changePassword,
  createUser,
  deleteUser,
  getBrandingSettings,
  getScraperSettings,
  listUsers,
  updateBrandingSettings,
  updateScraperSettings,
  updateUser,
} from '../api.js'
import {
  applyTheme,
  getCachedBrandingPayload,
  syncBranding,
} from '../theme.js'

function RoleBadges({ user }) {
  return (
    <div className="settings-badges">
      {user.is_admin && <span className="settings-badge settings-badge--admin">Admin</span>}
      {user.is_approver && <span className="settings-badge settings-badge--approver">Approver</span>}
      {!user.is_admin && <span className="settings-badge">Usuario</span>}
      {user.needs_approval && <span className="settings-badge settings-badge--warning">Requiere aprobación</span>}
    </div>
  )
}

function UsersTab({ currentUser, onCurrentUserUpdated }) {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    is_admin: false,
    is_approver: false,
    needs_approval: false,
  })
  const [adding, setAdding] = useState(false)
  const [pwdEdit, setPwdEdit] = useState({})
  const [savingPwd, setSavingPwd] = useState({})
  const [savingRoleId, setSavingRoleId] = useState(null)

  useEffect(() => {
    listUsers().then(setUsers).catch((e) => setError(e.message))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newUser.username || !newUser.password) return
    setAdding(true)
    setError(null)
    try {
      const created = await createUser(newUser)
      setUsers((prev) => [...prev, created])
      setNewUser({
        username: '',
        password: '',
        is_admin: false,
        is_approver: false,
        needs_approval: false,
      })
      setShowAdd(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este usuario?')) return
    setError(null)
    try {
      await deleteUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleChangePwd(id) {
    const pwd = pwdEdit[id]
    if (!pwd || pwd.length < 4) return
    setSavingPwd((prev) => ({ ...prev, [id]: true }))
    setError(null)
    try {
      await changePassword(id, pwd)
      setPwdEdit((prev) => ({ ...prev, [id]: '' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingPwd((prev) => ({ ...prev, [id]: false }))
    }
  }

  async function handleToggle(user, field, checked) {
    const next = { [field]: checked }
    if (field === 'is_approver' && checked) next.is_admin = true
    if (field === 'is_admin' && !checked) next.is_approver = false

    setSavingRoleId(user.id)
    setError(null)
    try {
      const updated = await updateUser(user.id, next)
      setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)))
      if (updated.id === currentUser.id) await onCurrentUserUpdated()
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingRoleId(null)
    }
  }

  return (
    <div className="settings-panel-stack">
      {error && <div className="alert alert-error">{error}</div>}

      <section className="settings-surface">
        <div className="settings-section-header">
          <div>
            <h2>Usuarios del equipo</h2>
            <p>Administrá accesos, roles y requisitos de aprobación sin salir del producto.</p>
          </div>
        </div>

        <div className="table-wrapper settings-table-wrapper">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Roles</th>
                <th>Permisos</th>
                <th>Nueva contraseña</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="settings-user-cell">
                    <strong>{user.username}</strong>
                    {user.username === currentUser.username && (
                      <span className="settings-user-self">(vos)</span>
                    )}
                  </td>
                  <td>
                    <RoleBadges user={user} />
                  </td>
                  <td>
                    <div className="settings-toggle-list">
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={user.is_admin}
                          disabled={savingRoleId === user.id}
                          onChange={(e) => handleToggle(user, 'is_admin', e.target.checked)}
                        />
                        <span>Admin</span>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={user.is_approver}
                          disabled={savingRoleId === user.id}
                          onChange={(e) => handleToggle(user, 'is_approver', e.target.checked)}
                        />
                        <span>Approver</span>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={user.needs_approval}
                          disabled={savingRoleId === user.id}
                          onChange={(e) => handleToggle(user, 'needs_approval', e.target.checked)}
                        />
                        <span>Necesita aprobación</span>
                      </label>
                    </div>
                  </td>
                  <td>
                    <div className="settings-password-row">
                      <input
                        type="password"
                        placeholder="Nueva contraseña"
                        value={pwdEdit[user.id] || ''}
                        onChange={(e) => setPwdEdit((p) => ({ ...p, [user.id]: e.target.value }))}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleChangePwd(user.id)}
                        disabled={!pwdEdit[user.id] || pwdEdit[user.id].length < 4 || savingPwd[user.id]}
                      >
                        {savingPwd[user.id] ? <span className="spinner" /> : 'Guardar'}
                      </button>
                    </div>
                  </td>
                  <td className="settings-table__actions">
                    {user.username !== currentUser.username && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user.id)}>
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="settings-surface">
        <div className="settings-section-header">
          <div>
            <h2>{showAdd ? 'Nuevo usuario' : 'Alta rápida'}</h2>
            <p>La regla de seguridad se mantiene: un approver siempre conserva rol de admin.</p>
          </div>
        </div>

        {showAdd ? (
          <form onSubmit={handleAdd} className="settings-inline-form">
            <div className="settings-inline-fields">
            <input
              type="text"
              placeholder="Usuario"
              value={newUser.username}
              autoFocus
              onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
              style={{ fontSize: 13, padding: '6px 8px', width: 170 }}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <div className="settings-toggle-row">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={newUser.is_admin}
                onChange={(e) => setNewUser((p) => ({
                  ...p,
                  is_admin: e.target.checked,
                  is_approver: e.target.checked ? p.is_approver : false,
                }))}
              />
              <span>Admin</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={newUser.is_approver}
                onChange={(e) => setNewUser((p) => ({
                  ...p,
                  is_approver: e.target.checked,
                  is_admin: e.target.checked ? true : p.is_admin,
                }))}
              />
              <span>Approver</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={newUser.needs_approval}
                onChange={(e) => setNewUser((p) => ({ ...p, needs_approval: e.target.checked }))}
              />
              <span>Necesita aprobación</span>
            </label>
          </div>
          <div className="settings-actions-row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
              {adding ? <span className="spinner" /> : 'Crear'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(true)}>
            + Nuevo usuario
          </button>
        )}
      </section>
    </div>
  )
}

function ThemeTab() {
  const [branding, setBranding] = useState(() => getCachedBrandingPayload())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    getBrandingSettings()
      .then((data) => setBranding(data))
      .catch((e) => setError(e.message))
  }, [])

  function handleColorChange(e) {
    const color = e.target.value
    setBranding((prev) => ({ ...prev, primary_color: color }))
    applyTheme(color)
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setBranding((prev) => ({ ...prev, logo_data_url: ev.target.result }))
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const saved = await updateBrandingSettings(branding)
      setBranding(saved)
      syncBranding(saved)
      window.dispatchEvent(new Event('acm_theme_changed'))
      setMessage('Branding actualizado para toda la aplicación.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-panel-stack settings-panel-stack--narrow">
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="settings-surface">
        <div className="settings-section-header">
          <div>
            <h2>Nombre de la aplicación</h2>
            <p>Se refleja en el header, la experiencia de acceso y el PDF exportado.</p>
          </div>
        </div>
        <input
          type="text"
          value={branding.app_name || ''}
          onChange={(e) => setBranding((prev) => ({ ...prev, app_name: e.target.value }))}
        />
      </div>

      <div className="settings-surface">
        <div className="settings-section-header">
          <div>
            <h2>Color principal</h2>
            <p>Actualiza el tono dominante de toda la interfaz en tiempo real.</p>
          </div>
        </div>
        <div className="settings-color-row">
          <input
            type="color"
            value={branding.primary_color || '#1a3a5c'}
            onChange={handleColorChange}
            className="settings-color-picker"
          />
          <span className="settings-color-value">{branding.primary_color}</span>
        </div>
      </div>

      <div className="settings-surface">
        <div className="settings-section-header">
          <div>
            <h2>Logotipo</h2>
            <p>Mantené la misma línea visual entre la landing, el workspace y el reporte.</p>
          </div>
        </div>
        {branding.logo_data_url && (
          <div className="settings-logo-preview">
            <img src={branding.logo_data_url} alt="Logo actual" className="settings-logo-preview__image" />
          </div>
        )}
        <div className="settings-actions-row">
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
            {branding.logo_data_url ? 'Cambiar logo' : 'Subir logo'}
          </button>
          {branding.logo_data_url && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setBranding((prev) => ({ ...prev, logo_data_url: null }))}
            >
              Quitar logo
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleLogoUpload}
        />
      </div>

      <button className="btn btn-primary settings-save-button" onClick={handleSave} disabled={saving}>
        {saving && <span className="spinner" />}
        Guardar branding
      </button>
    </div>
  )
}

function ScraperTab() {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getScraperSettings()
      .then((d) => setUrl(d.scraper_service_url || ''))
      .catch((e) => setError(e.message))
  }, [])

  async function handleSave() {
    setSaving(true); setMessage(null); setError(null)
    try {
      await updateScraperSettings({ scraper_service_url: url.trim() || null })
      setMessage('URL guardada.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!url.trim()) return
    setTesting(true); setMessage(null); setError(null)
    try {
      const res = await fetch(`${url.trim()}/health`)
      if (res.ok) setMessage('✓ Microservicio responde correctamente.')
      else setError(`El servicio respondió con status ${res.status}.`)
    } catch (e) {
      setError('No se pudo conectar. Verificá que el túnel esté activo.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings-surface settings-surface--narrow">
      <div className="settings-section-header">
        <div>
          <h2>Microservicio de extracción</h2>
          <p>
            URL del scraper local usada para extraer datos de Zonaprop desde una IP residencial.
            Dejá vacío para usar el fetch directo en desarrollo local.
          </p>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      <input
        type="url"
        placeholder="https://xxx.trycloudflare.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="settings-actions-row">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving && <span className="spinner" />} Guardar
        </button>
        <button className="btn btn-secondary" onClick={handleTest} disabled={testing || !url.trim()}>
          {testing && <span className="spinner" />} Testear conexión
        </button>
      </div>
    </div>
  )
}

const OSM_KEY = 'acm_osm_enabled'

function MapTab() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(OSM_KEY) !== 'false')

  function toggle() {
    const next = !enabled
    localStorage.setItem(OSM_KEY, String(next))
    setEnabled(next)
  }

  return (
    <div className="settings-surface settings-surface--narrow">
      <div className="settings-section-header">
        <div>
          <h2>Autocompletar direcciones</h2>
          <p>Cuando está activo, los campos de dirección sugieren resultados usando OpenStreetMap Nominatim.</p>
        </div>
      </div>
      <div className="settings-switch-row">
        <button
          onClick={toggle}
          className={`settings-switch${enabled ? ' settings-switch--enabled' : ''}`}
          aria-pressed={enabled}
        >
          <span className="settings-switch__thumb" />
        </button>
        <span className="settings-switch__label">
          {enabled ? 'Activado' : 'Desactivado'}
        </span>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState(user?.is_admin ? 'usuarios' : 'mapa')

  const tabs = [
    user?.is_admin ? { key: 'usuarios', label: 'Usuarios y acceso', description: 'Roles, permisos y contraseñas.' } : null,
    { key: 'mapa', label: 'OpenStreetMap', description: 'Control de autocompletado de direcciones.' },
    user?.is_admin ? { key: 'tema', label: 'Personalización', description: 'Nombre, color y logotipo.' } : null,
    user?.is_admin ? { key: 'scraper', label: 'Scraper', description: 'Conexión con el microservicio local.' } : null,
  ].filter(Boolean)

  return (
    <div className="settings-page">
      <div className="step-header">
        <span className="page-eyebrow">Ajustes del workspace</span>
        <h1>Configuración</h1>
        <p>Centralizá permisos, branding y servicios auxiliares sin salir de la operación diaria.</p>
      </div>

      <div className="settings-tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            className={`settings-tab${tab === item.key ? ' settings-tab--active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            <span className="settings-tab__label">{item.label}</span>
            <span className="settings-tab__description">{item.description}</span>
          </button>
        ))}
      </div>

      {tab === 'usuarios' && user?.is_admin && (
        <UsersTab currentUser={user} onCurrentUserUpdated={refreshUser} />
      )}
      {tab === 'mapa' && <MapTab />}
      {tab === 'tema' && user?.is_admin && <ThemeTab />}
      {tab === 'scraper' && user?.is_admin && <ScraperTab />}
    </div>
  )
}
