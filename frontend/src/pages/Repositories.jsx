import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import { sessionIsGitHubOAuth, syncGitHubToken } from '../utils/github.js'
import { supabase } from '../lib/supabaseClient.js'

function Repositories() {
  const [repos, setRepos] = useState([])
  const [githubUsername, setGithubUsername] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [needsGitHubLogin, setNeedsGitHubLogin] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError('')
      setNeedsGitHubLogin(false)
      setLoading(true)

      try {
        const me = await api('/api/users/me/')
        if (cancelled) return
        setUserEmail(me.email || '')

        const { data: sbData } = await supabase.auth.getSession()
        const session = sbData?.session
        const githubSessionOk =
          session &&
          sessionIsGitHubOAuth(session) &&
          String(session.user.id) === String(me.id)

        if (!githubSessionOk) {
          setNeedsGitHubLogin(true)
          setLoading(false)
          return
        }

        if (!me.has_github_token) {
          setSyncing(true)
          const sync = await syncGitHubToken(me.id)
          if (cancelled) return
          setSyncing(false)

          if (!sync.ok) {
            setNeedsGitHubLogin(true)
            setLoading(false)
            return
          }
        }

        const data = await api('/api/repos/github/')
        if (cancelled) return
        setRepos(data.repos || [])
        setGithubUsername(data.github_username || sync.github_username || '')
      } catch (err) {
        if (!cancelled) {
          if (err.data?.code === 'no_github_token') {
            setNeedsGitHubLogin(true)
          } else {
            setError(err.message || 'Failed to load repositories')
          }
        }
      } finally {
        if (!cancelled) {
          setSyncing(false)
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Layout userEmail={userEmail}>
      <header className="dashboard-header">
        <h1>Repositories</h1>
        <p className="tagline">
          {githubUsername
            ? `GitHub: @${githubUsername}`
            : 'Repos from your GitHub account (connect in Phase 2)'}
        </p>
      </header>

      {loading && <p className="hint">{syncing ? 'Syncing GitHub token…' : 'Loading repositories…'}</p>}

      {needsGitHubLogin && !loading && (
        <section className="card">
          <h2>GitHub sign-in required</h2>
          <p className="hint">
            Email/password login does not include a GitHub API token. Use{' '}
            <strong>Continue with GitHub</strong> on the login page, then return here.
          </p>
          <Link className="btn btn-primary" to="/login" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Go to login
          </Link>
        </section>
      )}

      {error && !loading && !needsGitHubLogin && <p className="error">{error}</p>}

      {!loading && !needsGitHubLogin && !error && repos.length === 0 && (
        <section className="card empty-state">
          <h2>No repositories found</h2>
          <p className="hint">Your GitHub account has no repos, or the token lacks repo scope.</p>
        </section>
      )}

      {!loading && !needsGitHubLogin && repos.length > 0 && (
        <ul className="repo-list">
          {repos.map((repo) => (
            <li key={repo.id} className="repo-list-item card">
              <div className="repo-list-main">
                <a href={repo.html_url} target="_blank" rel="noreferrer" className="repo-name">
                  {repo.full_name}
                </a>
                {repo.private && <span className="repo-badge">Private</span>}
                {repo.connected && <span className="repo-badge repo-badge-connected">Connected</span>}
              </div>
              {repo.description && <p className="repo-desc">{repo.description}</p>}
              <p className="hint repo-phase-hint">Connect button — Phase 2</p>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}

export default Repositories
