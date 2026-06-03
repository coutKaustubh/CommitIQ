/**
 * Django API helper — Phase 2+ will use this for login, /me, etc.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export function getApiBase() {
  return API_BASE.replace(/\/$/, '')
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('access_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
  })

  let data = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (!response.ok) {
    const message = data?.error || data?.detail || `Request failed (${response.status})`
    const err = new Error(message)
    err.status = response.status
    err.data = data
    throw err
  }

  return data
}
