import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import FoxLogo from '../components/FoxLogo.jsx'

function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const data = await api('/api/users/signup/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setSuccess(data.message || 'Account created!')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter bg-grid flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <FoxLogo size={34} />
          <span className="font-display text-xl font-bold tracking-tight">CommitIQ</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-8">
          <h1 className="font-display text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-secondary">Start catching regressions on every commit.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
              <span className="mb-1.5 block text-sm text-secondary">Password (min 6 characters)</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-content outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-light hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
