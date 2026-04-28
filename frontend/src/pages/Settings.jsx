import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../App.jsx'
import { changePassword, createUser, deleteUser, listUsers } from '../api.js'
import { getSavedColor, getSavedLogo, getSavedAppName, saveColor, saveLogo, removeLogo, saveAppName, applyTheme } from '../theme.js'

// ---- Users tab (admin only) ----

function UsersTab({ currentUser }) {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false })
  const [adding, setAdding] = useState(false)
  const [pwdEdit, setPwdEdit] = useState({}) // { [userId]: newPwd }
  const [saving, setSaving] = useState({})   // { [userId]: bool }

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newUser.username || !newUser.password) return
    setAdding(true)
    setError(null)
    try {
      const created = await createUser(newUser)
      setUsers((prev) => [...prev, created])
      setNewUser({ username: '', password: '', is_admin: false })
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
    setSaving((prev) => ({ ...prev, [id]: true }))
    setError(null)
    try {
      await changePassword(id, pwd)
      setPwdEdit((prev) => ({ ...prev, [id]: '' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', color: '#555', fontWeight: 600 }}>Usuario</th>
            <th style={{ padding: '8px 12px', color: '#555', fontWeight: 600 }}>Rol</th>
            <th style={{ padding: '8px 12px', color: '#555', fontWeight: 600 }}>Nueva contraseña</th>
            <th style={{ padding: '8px 12px' }} />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 12px', fontWeight: u.username === currentUser.username ? 700 : 400 }}>
                {u.username}
                {u.username === currentUser.username && (
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>(vos)</span>
                )}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: u.is_admin ? '#e8f4fd' : '#f5f5f5',
                  color: u.is_admin ? '#1565c0' : '#666',
                }}>
                  {u.is_admin ? 'Admin' : 'Usuario'}
                </span>
              </td>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={pwdEdit[u.id] || ''}
                    onChange={(e) => setPwdEdit((p) => ({ ...p, [u.id]: e.target.value }))}
                    style={{ fontSize: 13, padding: '4px 8px', width: 180 }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleChangePwd(u.id)}
                    disabled={!pwdEdit[u.id] || pwdEdit[u.id].length < 4 || saving[u.id]}
                  >
                    {saving[u.id] ? <span className="spinner" /> : 'Guardar'}
                  </button>
                </div>
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                {u.username !== currentUser.username && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd ? (
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Usuario"
            value={newUser.username}
            autoFocus
            onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
            style={{ fontSize: 13, padding: '4px 8px', width: 150 }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={newUser.password}
            onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            style={{ fontSize: 13, padding: '4px 8px', width: 150 }}
          />
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={newUser.is_admin}
              onChange={(e) => setNewUser((p) => ({ ...p, is_admin: e.target.checked }))}
            />
            Admin
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
            {adding ? <span className="spinner" /> : 'Crear'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(true)}>
          + Nuevo usuario
        </button>
      )}
    </div>
  )
}

// ---- Theme tab ----

function ThemeTab() {
  const [color, setColor] = useState(() => getSavedColor())
  const [logo, setLogo] = useState(() => getSavedLogo())
  const [appName, setAppName] = useState(() => getSavedAppName())
  const fileRef = useRef(null)

  function handleColorChange(e) {
    setColor(e.target.value)
    applyTheme(e.target.value)
  }

  function handleColorSave() {
    saveColor(color)
    window.dispatchEvent(new Event('acm_theme_changed'))
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      saveLogo(ev.target.result)
      setLogo(ev.target.result)
      window.dispatchEvent(new Event('acm_theme_changed'))
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    removeLogo()
    setLogo(null)
    window.dispatchEvent(new Event('acm_theme_changed'))
  }

  function handleAppNameSave() {
    saveAppName(appName)
    window.dispatchEvent(new Event('acm_theme_changed'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520 }}>
      <div className="card">
        <h3 style={{ marginBottom: 16, color: 'var(--primary)' }}>Nombre de la aplicación</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', border: '1px solid #ccc', borderRadius: 5, fontSize: 14 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAppNameSave}>Guardar</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16, color: 'var(--primary)' }}>Color principal</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="color"
            value={color}
            onChange={handleColorChange}
            style={{ width: 48, height: 40, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 2 }}
          />
          <span style={{ fontSize: 13, color: '#555' }}>{color}</span>
          <button className="btn btn-primary btn-sm" onClick={handleColorSave}>Aplicar</button>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
          Cambia el color de cabecera, botones y elementos destacados en toda la aplicación.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16, color: 'var(--primary)' }}>Logotipo</h3>
        {logo && (
          <div style={{ marginBottom: 14 }}>
            <img src={logo} alt="Logo actual" style={{ maxHeight: 60, maxWidth: 200, borderRadius: 6, border: '1px solid #eee', padding: 4 }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
            {logo ? 'Cambiar logo' : 'Subir logo'}
          </button>
          {logo && (
            <button className="btn btn-danger btn-sm" onClick={handleRemoveLogo}>Quitar logo</button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleLogoUpload}
        />
        <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
          PNG o SVG recomendado. Se muestra junto al nombre en la cabecera.
        </p>
      </div>
    </div>
  )
}

// ---- Map tab ----

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
        Desactivalo si preferís ingresar las direcciones manualmente o si experimentás lentitud.
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

// ---- Main ----

export default function Settings() {
  const { user } = useAuth()
  const [tab, setTab] = useState(user?.is_admin ? 'usuarios' : 'mapa')

  return (
    <div>
      <div className="step-header">
        <h1>Configuración</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
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
        <button
          className={`btn btn-sm ${tab === 'tema' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('tema')}
        >
          Personalización
        </button>
      </div>

      {tab === 'usuarios' && user?.is_admin && <UsersTab currentUser={user} />}
      {tab === 'mapa' && <MapTab />}
      {tab === 'tema' && <ThemeTab />}
    </div>
  )
}
