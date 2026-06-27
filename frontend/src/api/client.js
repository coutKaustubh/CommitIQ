/**
 * Django API helper — Phase 2+ will use this for login, /me, etc.
 */
import { supabase } from '../lib/supabaseClient.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

let refreshInFlight = null

export function getApiBase() {
  return API_BASE.replace(/\/$/, '')
}

function persistTokens(access_token, refresh_token) {
  if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refresh_token = localStorage.getItem(REFRESH_KEY)
    if (!refresh_token) return null

    const { data, error } = await supabase.auth.refreshSession({ refresh_token })
    if (error || !data?.session?.access_token) return null

    persistTokens(data.session.access_token, data.session.refresh_token)
    return data.session.access_token
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export async function api(path, options = {}, retried = false) {
  const token = localStorage.getItem(TOKEN_KEY)
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

  if (response.status === 401 && !retried) {
    const newToken = await refreshAccessToken()
    if (newToken) return api(path, options, true)
  }

  if (!response.ok) {
    let message = data?.error || data?.detail || `Request failed (${response.status})`
    if (response.status === 429) {
      message =
        'Too many requests — please wait a few minutes before trying again.'
    }
    const err = new Error(message)
    err.status = response.status
    err.data = data
    throw err
  }

  return data
}
