async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
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

export const getDefaults = () => request('GET', '/api/ponderadores/defaults')

export async function generatePDF(acmId, chartImageB64) {
  const res = await fetch(`/api/acm/${acmId}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart_image_b64: chartImageB64 || null }),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = await res.json()
      detail = err.detail || detail
    } catch {}
    throw new Error(detail)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `acm_${acmId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
