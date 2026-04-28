import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../App.jsx'
import {
  changePassword,
  createUser,
  deleteUser,
  getBrandingSettings,
  listUsers,
  updateBrandingSettings,
  updateUser,
} from '../api.js'
import {
  applyTheme,
  getCachedBrandingPayload,
  syncBranding,
} from '../theme.js'

function RoleBadges({ user }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px' }}>Usuario</th>
            <th style={{ padding: '8px 12px' }}>Roles</th>
            <th style={{ padding: '8px 12px' }}>Permisos</th>
            <th style={{ padding: '8px 12px' }}>Nueva contraseña</th>
            <th style={{ padding: '8px 12px' }} />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 12px', fontWeight: user.username === currentUser.username ? 700 : 400 }}>
                {user.username}
                {user.username === currentUser.username && (
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>(vos)</span>
                )}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <RoleBadges user={user} />
              </td>
              <td style={{ padding: '10px 12px', minWidth: 230 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={pwdEdit[user.id] || ''}
                    onChange={(e) => setPwdEdit((p) => ({ ...p, [user.id]: e.target.value }))}
                    style={{ fontSize: 13, padding: '4px 8px', width: 180 }}
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
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
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

      {showAdd ? (
        <form onSubmit={handleAdd} style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              style={{ fontSize: 13, padding: '6px 8px', width: 170 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', gap: 8 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 16, color: 'var(--primary)' }}>Nombre de la aplicación</h3>
        <input
          type="text"
          value={branding.app_name || ''}
          onChange={(e) => setBranding((prev) => ({ ...prev, app_name: e.target.value }))}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 5, fontSize: 14 }}
        />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16, color: 'var(--primary)' }}>Color principal</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="color"
            value={branding.primary_color || '#1a3a5c'}
            onChange={handleColorChange}
            style={{ width: 48, height: 40, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 2 }}
          />
          <span style={{ fontSize: 13, color: '#555' }}>{branding.primary_color}</span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16, color: 'var(--primary)' }}>Logotipo</h3>
        {branding.logo_data_url && (
          <div style={{ marginBottom: 14 }}>
            <img src={branding.logo_data_url} alt="Logo actual" style={{ maxHeight: 60, maxWidth: 220, borderRadius: 6, border: '1px solid #eee', padding: 4 }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
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

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving && <span className="spinner" />}
        Guardar branding
      </button>
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
    <div className="card" style={{ maxWidth: 480 }}>
      <h3 style={{ marginBottom: 16, color: '#1a3a5c' }}>Autocompletar direcciones</h3>
      <p style={{ fontSize: 14, color: '#555', marginBottom: 20 }}>
        Cuando está activo, los campos de dirección sugieren resultados usando OpenStreetMap Nominatim.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={toggle}
          style={{
            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: enabled ? '#1565c0' : '#ccc',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: enabled ? 25 : 3,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
          }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {enabled ? 'Activado' : 'Desactivado'}
        </span>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState(user?.is_admin ? 'usuarios' : 'mapa')

  return (
    <div>
      <div className="step-header">
        <h1>Configuración</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {user?.is_admin && (
          <button
            className={`btn btn-sm ${tab === 'usuarios' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('usuarios')}
          >
            Usuarios y acceso
          </button>
        )}
        <button
          className={`btn btn-sm ${tab === 'mapa' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('mapa')}
        >
          OpenStreetMap
        </button>
        {user?.is_admin && (
          <button
            className={`btn btn-sm ${tab === 'tema' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('tema')}
          >
            Personalización
          </button>
        )}
      </div>

      {tab === 'usuarios' && user?.is_admin && (
        <UsersTab currentUser={user} onCurrentUserUpdated={refreshUser} />
      )}
      {tab === 'mapa' && <MapTab />}
      {tab === 'tema' && user?.is_admin && <ThemeTab />}
    </div>
  )
}
