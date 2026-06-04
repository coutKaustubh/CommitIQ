import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { supabase } from '../lib/supabaseClient.js'
import { saveSession } from '../utils/auth.js'
import { clearSupabaseAuthSession } from '../utils/github.js'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)

  async function handleGitHub() {
    setError('')
    setGithubLoading(true)
    try {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env')
        return
      }
      const redirectTo = `${window.location.origin}/auth/callback`
      const { data, error: sbError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
        },
      })
      if (sbError) throw sbError
      if (data?.url) window.location.href = data.url
      else setError('Could not start GitHub login')
    } catch (err) {
      setError(err.message || 'GitHub login failed')
    } finally {
      setGithubLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await clearSupabaseAuthSession()
      const data = await api('/api/users/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>CommitIQ</h1>
        <p className="tagline">Sign in to your account</p>
      </header>

      <main className="card">
        <h2>Login</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="label">
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={handleGitHub}
          disabled={githubLoading || loading}
        >
          {githubLoading ? 'Redirecting…' : 'Continue with GitHub'}
        </button>

        <p className="form-footer">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </main>
    </div>
  )
}

export default Login
