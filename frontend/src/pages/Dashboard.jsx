import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'

function Dashboard() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      try {
        const data = await api('/api/users/me/')
        if (!cancelled) setUser(data)
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load profile')
          if (err.status === 401) {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMe()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Layout userEmail={user?.email || (loading ? 'Loading…' : '')}>
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="tagline">Commit regression overview</p>
      </header>

      {loading && <p className="hint">Loading your profile…</p>}
      {error && !loading && <p className="error">{error}</p>}

      {user && (
        <section className="profile-banner card">
          <p>
            Welcome, <strong>{user.email}</strong>
          </p>
          <p className="hint">
            Profile ID: {user.profile_id}
            {user.profile_created ? ' (new profile created in DB)' : ''}
          </p>
        </section>
      )}

      <section className="stats-grid">
        <div className="stat-card card">
          <span className="stat-label">Commits this week</span>
          <span className="stat-value">0</span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">Regressions found</span>
          <span className="stat-value">0</span>
        </div>
        <div className="stat-card card stat-critical">
          <span className="stat-label">Critical issues</span>
          <span className="stat-value">0</span>
        </div>
      </section>

      <section className="card empty-state">
        <h2>No repositories connected</h2>
        <p className="hint">Week 2: connect GitHub repos to start analysis.</p>
      </section>
    </Layout>
  )
}

export default Dashboard
