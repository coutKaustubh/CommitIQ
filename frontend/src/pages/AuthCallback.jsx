import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { saveSession } from '../utils/auth.js'

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
  const [status, setStatus] = useState('Completing GitHub login…')

  useEffect(() => {
    let finished = false

    function goDashboard(session) {
      if (finished) return
      finished = true
      saveSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
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
        setStatus(`Completing GitHub login… (${attempt + 1}/25)`)
        await new Promise((r) => window.setTimeout(r, 400))
      }

      const hasCode = Boolean(params.get('code'))
      setError(
        hasCode
          ? 'PKCE verifier missing. Do this: 1) Go to /login 2) Click GitHub 3) Complete login 4) Come back — do NOT clear Local Storage between steps. If it still fails, remove StrictMode was applied; restart npm run dev and try once in a normal (not incognito) window.'
          : 'No ?code= in URL. Set Supabase Redirect URL to http://localhost:5173/auth/callback and try again from /login.',
      )
      setStatus('')
    }

    waitForAutoExchange()

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <div className="page">
      <main className="card">
        <h2>GitHub sign-in</h2>
        {status && !error && <p className="hint">{status}</p>}
        {error && (
          <>
            <p className="error">{error}</p>
            <p className="hint">
              Do not clear Local Storage after clicking GitHub — only clear if stuck, then retry
              from <Link to="/login">/login</Link> in one go.
            </p>
            <Link className="btn btn-primary" to="/login" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Back to login
            </Link>
          </>
        )}
      </main>
    </div>
  )
}

export default AuthCallback
