import { api } from '../api/client.js'

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export function saveSession({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

/** Optional: tell Django/Supabase to sign out (needs Bearer token). */
export async function logoutApi() {
  try {
    await api('/api/users/logout/', { method: 'POST' })
  } catch {
    // Still clear local session if API fails
  }
}
