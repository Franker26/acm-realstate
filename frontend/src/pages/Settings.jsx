import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../App.jsx'
import {
  changePassword,
  createUser,
  deleteUser,
  getBrandingSettings,
  getIntegrationStatus,
  getSystemParams,
  listUsers,
  updateBrandingSettings,
  updateUser,
} from '../api.js'
import { applyTheme, getCachedBrandingPayload, syncBranding } from '../theme.js'

// ── Shared helpers ────────────────────────────────────────────────────────────

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

function SectionTitle({ children }) {
  return <h2 className="settings-main-title">{children}</h2>
}

// ── Panel: Equipo (users) ─────────────────────────────────────────────────────

function UsersPanel({ currentUser, onCurrentUserUpdated }) {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false, is_approver: false, needs_approval: false })
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
      setNewUser({ username: '', password: '', is_admin: false, is_approver: false, needs_approval: false })
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
    <div>
      <SectionTitle>Equipo</SectionTitle>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="settings-group">
        <div className="settings-group-header">
          <span>Usuarios del workspace</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Nuevo usuario
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="settings-inline-form" style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
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
                <input type="checkbox" checked={newUser.is_admin}
                  onChange={(e) => setNewUser((p) => ({ ...p, is_admin: e.target.checked, is_approver: e.target.checked ? p.is_approver : false }))} />
                <span>Admin</span>
              </label>
              <label className="settings-toggle">
                <input type="checkbox" checked={newUser.is_approver}
                  onChange={(e) => setNewUser((p) => ({ ...p, is_approver: e.target.checked, is_admin: e.target.checked ? true : p.is_admin }))} />
                <span>Approver</span>
              </label>
              <label className="settings-toggle">
                <input type="checkbox" checked={newUser.needs_approval}
                  onChange={(e) => setNewUser((p) => ({ ...p, needs_approval: e.target.checked }))} />
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
        )}

        <div className="table-wrapper">
          <table className="settings-table" style={{ width: '100%' }}>
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
                  <td><RoleBadges user={user} /></td>
                  <td>
                    <div className="settings-toggle-list">
                      <label className="settings-toggle">
                        <input type="checkbox" checked={user.is_admin} disabled={savingRoleId === user.id}
                          onChange={(e) => handleToggle(user, 'is_admin', e.target.checked)} />
                        <span>Admin</span>
                      </label>
                      <label className="settings-toggle">
                        <input type="checkbox" checked={user.is_approver} disabled={savingRoleId === user.id}
                          onChange={(e) => handleToggle(user, 'is_approver', e.target.checked)} />
                        <span>Approver</span>
                      </label>
                      <label className="settings-toggle">
                        <input type="checkbox" checked={user.needs_approval} disabled={savingRoleId === user.id}
                          onChange={(e) => handleToggle(user, 'needs_approval', e.target.checked)} />
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
      </div>
    </div>
  )
}

// ── Panel: Personalización (branding) ─────────────────────────────────────────

function ThemePanel() {
  const [branding, setBranding] = useState(() => getCachedBrandingPayload())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    getBrandingSettings().then(setBranding).catch((e) => setError(e.message))
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
    reader.onload = (ev) => setBranding((prev) => ({ ...prev, logo_data_url: ev.target.result }))
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
      setMessage('Branding actualizado.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle>Personalización</SectionTitle>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ marginBottom: 16 }}>{message}</div>}

      <div className="settings-group">
        <div className="settings-group-header">Nombre de la aplicación</div>
        <div style={{ padding: '16px 24px' }}>
          <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: 13 }}>
            Se refleja en el header, la pantalla de login y el PDF exportado.
          </p>
          <input
            type="text"
            value={branding.app_name || ''}
            onChange={(e) => setBranding((prev) => ({ ...prev, app_name: e.target.value }))}
            style={{ maxWidth: 320 }}
          />
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-header">Color principal</div>
        <div style={{ padding: '16px 24px' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 13 }}>
            Actualiza el tono dominante de toda la interfaz en tiempo real.
          </p>
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
      </div>

      <div className="settings-group">
        <div className="settings-group-header">Logotipo</div>
        <div style={{ padding: '16px 24px' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 13 }}>
            Mantené la misma línea visual entre la landing, el workspace y el reporte.
          </p>
          {branding.logo_data_url && (
            <div className="settings-logo-preview" style={{ marginBottom: 12 }}>
              <img src={branding.logo_data_url} alt="Logo actual" className="settings-logo-preview__image" />
            </div>
          )}
          <div className="settings-actions-row">
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {branding.logo_data_url ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {branding.logo_data_url && (
              <button className="btn btn-danger btn-sm"
                onClick={() => setBranding((prev) => ({ ...prev, logo_data_url: null }))}>
                Quitar logo
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>
      </div>

      <div style={{ padding: '0 0 8px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving && <span className="spinner" />}
          Guardar branding
        </button>
      </div>
    </div>
  )
}

// ── Panel: OpenStreetMap ──────────────────────────────────────────────────────

const OSM_KEY = 'acm_osm_enabled'

function MapPanel() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(OSM_KEY) !== 'false')

  function toggle() {
    const next = !enabled
    localStorage.setItem(OSM_KEY, String(next))
    setEnabled(next)
  }

  return (
    <div>
      <SectionTitle>OpenStreetMap</SectionTitle>
      <div className="settings-group">
        <div className="settings-group-header">Autocompletar direcciones</div>
        <div style={{ padding: '16px 24px' }}>
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
            Cuando está activo, los campos de dirección sugieren resultados usando OpenStreetMap Nominatim.
          </p>
          <div className="settings-switch-row">
            <button
              onClick={toggle}
              className={`settings-switch${enabled ? ' settings-switch--enabled' : ''}`}
              aria-pressed={enabled}
            >
              <span className="settings-switch__thumb" />
            </button>
            <span className="settings-switch__label">{enabled ? 'Activado' : 'Desactivado'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Panel: Estado de integraciones (solo lectura) ─────────────────────────────

function IntegrationStatusPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getIntegrationStatus().then(setData).catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <SectionTitle>Estado de integraciones</SectionTitle>
      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>
        La configuración de integraciones es administrada por el equipo de soporte.
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {!data ? (
        <span className="spinner" />
      ) : (
        <div className="integration-status-grid">
          {data.sources.map((source) => (
            <div key={source.key} className="integration-card">
              <div className="integration-card__header">
                <span className={`integration-card__dot integration-card__dot--${source.available ? 'ok' : 'error'}`} />
                <span className="integration-card__name">{source.name}</span>
              </div>
              <div className="integration-card__detail">
                <span className={`integration-card__status-label integration-card__status-label--${source.available ? 'ok' : 'error'}`}>
                  {source.available ? 'Disponible' : 'No disponible'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panel: Parámetros del sistema (debug) ─────────────────────────────────────

function SystemParamsPanel() {
  const [params, setParams] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSystemParams().then(setParams).catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <SectionTitle>Parámetros del sistema</SectionTitle>
      <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
        Todos los valores almacenados en la tabla <code>app_settings</code>. Los valores sensibles aparecen enmascarados.
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {!params ? (
        <span className="spinner" />
      ) : params.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No hay parámetros configurados aún.</p>
      ) : (
        <div className="settings-group" style={{ padding: 0 }}>
          <table className="params-table">
            <thead>
              <tr>
                <th>Clave</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {params.map((p) => (
                <tr key={p.key}>
                  <td><code className="params-table__key">{p.key}</code></td>
                  <td className="params-table__value">{p.value || <em style={{ color: 'var(--text-muted)' }}>vacío</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const location = useLocation()
  const debugMode = new URLSearchParams(location.search).get('debug') === '1'

  const topSections = [
    { key: 'config', label: 'Configuración general' },
    user?.is_admin ? { key: 'usuarios', label: 'Usuarios' } : null,
    (debugMode && user?.is_admin) ? { key: 'tecnico', label: 'Técnico' } : null,
  ].filter(Boolean)

  const sidebarMap = {
    config: [
      { key: 'mapa', label: 'OpenStreetMap' },
      user?.is_admin ? { key: 'personalizacion', label: 'Personalización' } : null,
      user?.is_admin ? { key: 'integraciones', label: 'Estado de integraciones' } : null,
    ].filter(Boolean),
    usuarios: [
      { key: 'equipo', label: 'Equipo' },
    ],
    tecnico: [
      { key: 'params-sistema', label: 'Parámetros del sistema' },
    ],
  }

  const defaultSection = topSections[0]?.key || 'config'
  const [activeSection, setActiveSection] = useState(defaultSection)
  const [activeSidebarItem, setActiveSidebarItem] = useState(
    sidebarMap[defaultSection]?.[0]?.key
  )

  function handleSectionChange(sectionKey) {
    setActiveSection(sectionKey)
    setActiveSidebarItem(sidebarMap[sectionKey]?.[0]?.key)
  }

  const sidebarItems = sidebarMap[activeSection] || []

  return (
    <div className="settings-layout">

      {/* Top navigation bar */}
      <nav className="settings-topnav">
        <span className="settings-topnav-brand">Configuración</span>
        {topSections.map((s) => (
          <button
            key={s.key}
            className={`settings-topnav-item${activeSection === s.key ? ' settings-topnav-item--active' : ''}`}
            onClick={() => handleSectionChange(s.key)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Body: sidebar + content */}
      <div className="settings-body">
        <aside className="settings-sidebar">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              className={`settings-sidebar-item${activeSidebarItem === item.key ? ' settings-sidebar-item--active' : ''}`}
              onClick={() => setActiveSidebarItem(item.key)}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <div className="settings-main">
          {activeSidebarItem === 'mapa' && <MapPanel />}
          {activeSidebarItem === 'personalizacion' && <ThemePanel />}
          {activeSidebarItem === 'integraciones' && <IntegrationStatusPanel />}
          {activeSidebarItem === 'equipo' && user?.is_admin && (
            <UsersPanel currentUser={user} onCurrentUserUpdated={refreshUser} />
          )}
          {activeSidebarItem === 'params-sistema' && <SystemParamsPanel />}
        </div>
      </div>
    </div>
  )
}
