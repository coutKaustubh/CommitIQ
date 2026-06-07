import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { supabase } from '../lib/supabaseClient.js'
import { saveSession } from '../utils/auth.js'
import { clearSupabaseAuthSession } from '../utils/github.js'
import FoxLogo from '../components/FoxLogo.jsx'
import GitHubIcon from '../components/GitHubIcon.jsx'

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
        options: { redirectTo },
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
    <div className="bg-grid flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <FoxLogo size={34} />
          <span className="font-display text-xl font-bold tracking-tight">CommitIQ</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-8">
          <h1 className="font-display text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-secondary">Sign in to read your commits.</p>

          <button
            type="button"
            onClick={handleGitHub}
            disabled={githubLoading || loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
          >
            <GitHubIcon size={18} />
            {githubLoading ? 'Redirecting…' : 'Continue with GitHub'}
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-sm text-secondary">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-content outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-secondary">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-content outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg border border-border bg-surface-hover px-4 py-2.5 font-semibold text-content transition-colors hover:border-primary/50 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-secondary">
            No account?{' '}
            <Link to="/signup" className="text-primary-light hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
