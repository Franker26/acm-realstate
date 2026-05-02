import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin } from '../../adminApi.js'
import InlineNotice from '../../components/InlineNotice.jsx'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await adminLogin(username, password)
      localStorage.setItem('acm_admin_token', data.access_token)
      localStorage.setItem('acm_admin_user', JSON.stringify({ username: data.username }))
      navigate('/admin/companies')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-box">
        <h1 className="admin-login-title">ACM Admin</h1>
        <p className="admin-login-sub">Panel de administración de plataforma</p>
        <form onSubmit={handleSubmit} className="admin-login-form">
          {error && <InlineNotice tone="error" title="No pudimos iniciar sesión" description={error} className="notice--spaced" compact />}
          <label className="admin-label">Usuario</label>
          <input
            type="text"
            className="admin-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
          <label className="admin-label">Contraseña</label>
          <input
            type="password"
            className="admin-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
