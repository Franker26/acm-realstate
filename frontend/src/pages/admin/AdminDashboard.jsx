import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminCreateCompany, adminDeleteCompany, adminListCompanies } from '../../adminApi.js'
import { LoadingState } from '../../components/StatusState.jsx'
import { useConfirm } from '../../App.jsx'
import InlineNotice from '../../components/InlineNotice.jsx'

export default function AdminDashboard() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const confirm = useConfirm()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await adminListCompanies()
      setCompanies(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const co = await adminCreateCompany({ name: newName.trim() })
      setCompanies((prev) => [...prev, co])
      setNewName('')
      setShowForm(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id, name) {
    const accepted = await confirm({
      tone: 'danger',
      eyebrow: 'Eliminar empresa',
      title: `Se va a eliminar "${name}"`,
      description: 'Esta acción quitará la empresa de la plataforma. Si todavía tiene actividad, conviene revisarla antes de continuar.',
      confirmLabel: 'Eliminar empresa',
      cancelLabel: 'Mantener empresa',
    })
    if (!accepted) return

    setError(null)
    try {
      await adminDeleteCompany(id)
      setCompanies((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Empresas</h1>
        <button className="admin-btn admin-btn--primary" onClick={() => setShowForm(true)}>
          + Nueva empresa
        </button>
      </div>

      {error && <InlineNotice tone="error" title="No pudimos actualizar las empresas" description={error} className="notice--spaced" />}

      {showForm && (
        <form onSubmit={handleCreate} className="admin-inline-form">
          <input
            type="text"
            className="admin-input"
            placeholder="Nombre de la empresa"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            style={{ width: 280 }}
          />
          <button type="submit" className="admin-btn admin-btn--primary" disabled={creating}>
            {creating ? 'Creando...' : 'Crear'}
          </button>
          <button type="button" className="admin-btn" onClick={() => setShowForm(false)}>
            Cancelar
          </button>
        </form>
      )}

      {loading ? (
        <LoadingState
          eyebrow="Admin"
          title="Estamos cargando las empresas"
          subtitle="Preparamos el panel con compañías, accesos y actividad general."
          messages={['Cargando empresas...', 'Ordenando accesos...', 'Preparando panel...']}
          mode="inline"
        />
      ) : companies.length === 0 ? (
        <p className="admin-muted">No hay empresas registradas.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Empresa</th>
              <th>Usuarios</th>
              <th>Tasaciones</th>
              <th>Creada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((co) => (
              <tr key={co.id}>
                <td className="admin-muted">{co.id}</td>
                <td>
                  <Link to={`/admin/companies/${co.id}`} className="admin-link">
                    {co.name}
                  </Link>
                </td>
                <td>{co.user_count}</td>
                <td>{co.acm_count}</td>
                <td className="admin-muted">{new Date(co.created_at).toLocaleDateString('es-AR')}</td>
                <td>
                  <button
                    className="admin-btn admin-btn--danger admin-btn--sm"
                    onClick={() => handleDelete(co.id, co.name)}
                    disabled={co.user_count > 0}
                    title={co.user_count > 0 ? 'Eliminá los usuarios primero' : 'Eliminar empresa'}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
