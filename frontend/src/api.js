const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function getToken() {
  return localStorage.getItem('acm_token')
}

async function request(method, path, body, options = {}) {
  const { auth = true, redirectOn401 = true } = options
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (auth && token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}${path}`, opts)
  if (res.status === 401) {
    localStorage.removeItem('acm_token')
    localStorage.removeItem('acm_user')
    if (redirectOn401 && window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
    throw new Error('Sesión expirada')
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = await res.json()
      detail = err.detail || detail
    } catch {}
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    let detail = 'Error de autenticación'
    try { detail = (await res.json()).detail || detail } catch {}
    throw new Error(detail)
  }
  return res.json()
}

export const getCurrentUser = () =>
  request('GET', '/api/auth/me', undefined, { redirectOn401: false })

export const createACM = (data) => request('POST', '/api/acm', data)
export const listACMs = () => request('GET', '/api/acm')
export const getACM = (id) => request('GET', `/api/acm/${id}`)
export const updateACM = (id, data) => request('PATCH', `/api/acm/${id}`, data)
export const deleteACM = (id) => request('DELETE', `/api/acm/${id}`)

export const addComparable = (acmId, data) =>
  request('POST', `/api/acm/${acmId}/comparable`, data)
export const updateComparable = (acmId, cid, data) =>
  request('PUT', `/api/acm/${acmId}/comparable/${cid}`, data)
export const deleteComparable = (acmId, cid) =>
  request('DELETE', `/api/acm/${acmId}/comparable/${cid}`)

export const getResultado = (acmId) => request('GET', `/api/acm/${acmId}/resultado`)

export const getDefaults = () =>
  request('GET', '/api/ponderadores/defaults', undefined, { auth: false, redirectOn401: false })

export const extractZonaprop = (url) => request('POST', '/api/zonaprop/extract', { url })

export const listUsers = () => request('GET', '/api/users')
export const createUser = (data) => request('POST', '/api/users', data)
export const updateUser = (id, data) => request('PATCH', `/api/users/${id}`, data)
export const deleteUser = (id) => request('DELETE', `/api/users/${id}`)
export const changePassword = (id, newPassword) =>
  request('PUT', `/api/users/${id}/password`, { new_password: newPassword })

export const listPendingApprovals = () => request('GET', '/api/approvals/pending')
export const reviewACM = (id, data) => request('PUT', `/api/acm/${id}/approval`, data)

export const getBrandingSettings = () =>
  request('GET', '/api/settings/branding', undefined, { auth: false, redirectOn401: false })
export const updateBrandingSettings = (data) => request('PUT', '/api/settings/branding', data)
export const getScraperSettings = () => request('GET', '/api/settings/scraper')
export const updateScraperSettings = (data) => request('PUT', '/api/settings/scraper', data)
