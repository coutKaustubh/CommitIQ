import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { api } from '../api/client.js'
import { saveSession } from '../utils/auth.js'
import FoxLogo from '../components/FoxLogo.jsx'

function parseHashParams() {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return {}
  return Object.fromEntries(new URLSearchParams(raw))
}

/**
 * Do NOT call exchangeCodeForSession here — Supabase client (detectSessionInUrl)
 * already exchanges the code once using the PKCE verifier in localStorage.
 * Calling it again causes: "PKCE code verifier not found in storage".
 */
function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Connecting your GitHub account…')

  useEffect(() => {
    let finished = false

    async function goDashboard(session) {
      if (finished) return
      finished = true
      saveSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      if (session.provider_token) {
        try {
          await api('/api/users/sync-github-token/', {
            method: 'POST',
            body: JSON.stringify({ github_access_token: session.provider_token }),
          })
        } catch {
          // Repositories page will retry sync
        }
      }
      window.history.replaceState({}, '', '/dashboard')
      navigate('/dashboard', { replace: true })
    }

    const hash = parseHashParams()
    if (hash.access_token) {
      goDashboard({
        access_token: hash.access_token,
        refresh_token: hash.refresh_token,
      })
      return
    }

    const params = new URLSearchParams(window.location.search)
    const qError = params.get('error_description') || params.get('error')
    if (qError) {
      setError(decodeURIComponent(String(qError).replace(/\+/g, ' ')))
      setStatus('')
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        goDashboard(session)
      }
    })

    async function waitForAutoExchange() {
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (data?.session) {
          goDashboard(data.session)
          return
        }
        if (sessionError) {
          setError(sessionError.message)
          setStatus('')
          return
        }
        setStatus(`Connecting your GitHub account… (${attempt + 1}/25)`)
        await new Promise((r) => window.setTimeout(r, 400))
      }

      const hasCode = Boolean(params.get('code'))
      setError(
        hasCode
          ? 'PKCE verifier missing. Go to the login page, click GitHub, and complete it in one go without clearing Local Storage.'
          : 'No ?code= in URL. Set the Supabase Redirect URL to http://localhost:5173/auth/callback and try again.',
      )
      setStatus('')
    }

    waitForAutoExchange()

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <div className="page-enter bg-grid flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center">
          <FoxLogo size={64} className={error ? '' : 'animate-pulse-glow'} />
        </div>

        {!error && (
          <>
            <h1 className="mt-6 font-display text-xl font-bold">Connecting your GitHub account</h1>
            <p className="mt-2 text-sm text-secondary">{status}</p>
            <div className="mt-6 flex justify-center">
              <span className="h-8 w-8 animate-spin-slow rounded-full border-2 border-border border-t-primary" />
            </div>
          </>
        )}

        {error && (
          <>
            <h1 className="mt-6 font-display text-xl font-bold text-danger">Sign-in failed</h1>
            <p className="mt-2 text-sm text-secondary">{error}</p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallback
