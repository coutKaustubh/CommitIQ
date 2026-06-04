import { api } from '../api/client.js'
import { supabase } from '../lib/supabaseClient.js'

/** Supabase session from "Continue with GitHub" (not email/password). */
export function sessionIsGitHubOAuth(session) {
  if (!session?.user) return false
  if (session.user.app_metadata?.provider === 'github') return true
  const identities = session.user.identities || []
  return identities.some((identity) => identity.provider === 'github')
}

/**
 * Send GitHub provider_token to Django only when Supabase session matches logged-in user.
 */
export async function syncGitHubToken(expectedSupabaseUserId) {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    return { ok: false, reason: 'session_error', message: error.message }
  }

  const session = data.session
  if (!session?.provider_token) {
    return { ok: false, reason: 'no_provider_token' }
  }

  if (expectedSupabaseUserId && String(session.user.id) !== String(expectedSupabaseUserId)) {
    return { ok: false, reason: 'session_user_mismatch' }
  }

  if (!sessionIsGitHubOAuth(session)) {
    return { ok: false, reason: 'not_github_oauth' }
  }

  const result = await api('/api/users/sync-github-token/', {
    method: 'POST',
    body: JSON.stringify({ github_access_token: session.provider_token }),
  })

  return { ok: true, ...result }
}

/** Drop cached GitHub OAuth session so email login does not reuse another user's token. */
export async function clearSupabaseAuthSession() {
  try {
    await supabase.auth.signOut()
  } catch {
    // ignore
  }
}
