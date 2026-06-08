import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, CheckCircle2, XCircle, GitCommit } from 'lucide-react'
import { api } from '../api/client.js'
import DashboardShell from '../components/DashboardShell.jsx'
import CommitsList from '../components/CommitsList.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import GitHubIcon from '../components/GitHubIcon.jsx'
import SkeletonCard from '../components/SkeletonCard.jsx'
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
  const [actionId, setActionId] = useState(null)
  const [commitsRepo, setCommitsRepo] = useState(null)

  const loadRepos = useCallback(async () => {
    setError('')
    setNeedsGitHubLogin(false)
    setLoading(true)
    try {
      const me = await api('/api/users/me/')
      setUserEmail(me.email || '')

      const { data: sbData } = await supabase.auth.getSession()
      const session = sbData?.session
      const githubSessionOk =
        session && sessionIsGitHubOAuth(session) && String(session.user.id) === String(me.id)

      if (!githubSessionOk) {
        setNeedsGitHubLogin(true)
        return
      }

      if (!me.has_github_token) {
        setSyncing(true)
        const sync = await syncGitHubToken(me.id)
        setSyncing(false)
        if (!sync.ok) {
          setNeedsGitHubLogin(true)
          return
        }
      }

      const data = await api('/api/repos/github/')
      setRepos(data.repos || [])
      setGithubUsername(data.github_username || '')
    } catch (err) {
      if (err.data?.code === 'no_github_token') setNeedsGitHubLogin(true)
      else setError(err.message || 'Failed to load repositories')
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRepos()
  }, [loadRepos])

  async function handleConnect(repo) {
    setActionId(repo.id)
    setError('')
    try {
      const res = await api('/api/repos/connect/', {
        method: 'POST',
        body: JSON.stringify({ github_id: repo.id, full_name: repo.full_name }),
      })
      const dbId = res.repository?.id
      const webhookActive = res.webhook_active ?? false
      setRepos((prev) =>
        prev.map((r) =>
          r.id === repo.id
            ? { ...r, connected: true, db_id: dbId ?? r.db_id, webhook_active: webhookActive }
            : r,
        ),
      )
      if (res.webhook_error) {
        setError(res.webhook_error)
      }
    } catch (err) {
      setError(err.message || 'Could not connect repository')
    } finally {
      setActionId(null)
    }
  }

  async function handleRetryWebhook(repo) {
    setActionId(repo.id)
    setError('')
    try {
      const res = await api('/api/repos/retry-webhook/', {
        method: 'POST',
        body: JSON.stringify({ full_name: repo.full_name }),
      })
      setRepos((prev) =>
        prev.map((r) =>
          r.id === repo.id ? { ...r, webhook_active: res.webhook_active ?? false } : r,
        ),
      )
      if (res.webhook_error) setError(res.webhook_error)
    } catch (err) {
      setError(err.message || err.data?.webhook_error || 'Webhook setup failed')
    } finally {
      setActionId(null)
    }
  }

  async function handleDisconnect(repo) {
    setActionId(repo.id)
    setError('')
    try {
      await api('/api/repos/disconnect/', {
        method: 'POST',
        body: JSON.stringify({ full_name: repo.full_name }),
      })
      if (commitsRepo?.githubId === repo.id) setCommitsRepo(null)
      setRepos((prev) =>
        prev.map((r) =>
          r.id === repo.id ? { ...r, connected: false, db_id: null, webhook_active: false } : r,
        ),
      )
    } catch (err) {
      setError(err.message || 'Could not disconnect repository')
    } finally {
      setActionId(null)
    }
  }

  const connectedCount = repos.filter((r) => r.connected).length

  return (
    <DashboardShell userEmail={userEmail}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary-light">Repositories</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Connected repos</h1>
          <p className="mt-1 text-secondary">
            {githubUsername
              ? `GitHub @${githubUsername}${connectedCount ? ` · ${connectedCount} connected` : ''}`
              : 'Connect repos to track commits in CommitIQ.'}
          </p>
        </div>
      </div>

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      )}

      {/* GitHub sign-in required */}
      {needsGitHubLogin && !loading && (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <FoxLogo size={56} className="mx-auto" />
          <h2 className="mt-5 font-display text-xl font-bold">GitHub sign-in required</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-secondary">
            Email/password login does not include a GitHub API token. Use{' '}
            <strong className="text-content">Continue with GitHub</strong> to load your repos.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary/90"
          >
            <GitHubIcon size={17} /> Go to login
          </Link>
        </div>
      )}

      {error && !loading && !needsGitHubLogin && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !needsGitHubLogin && !error && repos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
          <FoxLogo size={64} className="mx-auto opacity-80" />
          <h2 className="mt-5 font-display text-xl font-bold">No repositories found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-secondary">
            Your GitHub account has no repos, or the token lacks the repo scope.
          </p>
        </div>
      )}

      {/* Repo grid */}
      {!loading && !needsGitHubLogin && repos.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {repos.map((repo) => {
            const viewing = commitsRepo?.dbId === repo.db_id
            return (
              <div
                key={repo.id}
                className="rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 truncate font-semibold text-content hover:text-primary-light"
                      >
                        {repo.full_name}
                        <ExternalLink size={13} className="shrink-0 text-secondary" />
                      </a>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-xs text-secondary">
                      <span className="rounded border border-border px-1.5 py-0.5 uppercase">
                        {repo.private ? 'Private' : 'Public'}
                      </span>
                      {repo.connected && repo.webhook_active ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 size={13} /> Webhook active
                        </span>
                      ) : repo.connected ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <XCircle size={13} /> Connected — webhook pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <XCircle size={13} /> Not connected
                        </span>
                      )}
                    </div>
                  </div>

                  {repo.connected ? (
                    <button
                      type="button"
                      disabled={actionId === repo.id}
                      onClick={() => handleDisconnect(repo)}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-secondary transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-60"
                    >
                      {actionId === repo.id ? '…' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actionId === repo.id}
                      onClick={() => handleConnect(repo)}
                      className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {actionId === repo.id ? '…' : 'Connect'}
                    </button>
                  )}
                </div>

                {repo.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-secondary">{repo.description}</p>
                )}

                {repo.connected && !repo.webhook_active && (
                  <button
                    type="button"
                    disabled={actionId === repo.id}
                    onClick={() => handleRetryWebhook(repo)}
                    className="mt-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-1.5 text-sm text-warning hover:bg-warning/20 disabled:opacity-60"
                  >
                    {actionId === repo.id ? '…' : 'Setup webhook'}
                  </button>
                )}

                {repo.connected && repo.db_id && (
                  <button
                    type="button"
                    onClick={() =>
                      setCommitsRepo(
                        viewing
                          ? null
                          : { dbId: repo.db_id, fullName: repo.full_name, githubId: repo.id },
                      )
                    }
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary-light hover:underline"
                  >
                    <GitCommit size={14} /> {viewing ? 'Hide commits' : 'View commits'}
                  </button>
                )}

                {viewing && (
                  <CommitsList
                    dbId={repo.db_id}
                    fullName={repo.full_name}
                    onClose={() => setCommitsRepo(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </DashboardShell>
  )
}

export default Repositories
