import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App.jsx'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: 360 }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center', color: '#1a3a5c' }}>ACM Real Estate</h2>
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
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading || !username || !password}
          >
            {loading ? <span className="spinner" /> : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
