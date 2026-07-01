import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  GitCommit,
  GitFork,
  Search,
  RotateCw,
  Loader2,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import { api } from '../api/client.js'
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx'
import CommitsList from '../components/CommitsList.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import GitHubIcon from '../components/GitHubIcon.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { sessionIsGitHubOAuth, syncGitHubToken } from '../utils/github.js'
import { getDisplayName } from '../utils/displayName.js'
import { getGreeting } from '../utils/greeting.js'

function Repositories() {
  // ⚠️ Data logic (loadRepos, connect, disconnect, retry) bilkul as-is hai.
  const [repos, setRepos] = useState([])
  const [githubUsername, setGithubUsername] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [needsGitHubLogin, setNeedsGitHubLogin] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [commitsRepo, setCommitsRepo] = useState(null)
  // Naye UI-only states: search filter + toast notifications (data logic ko touch nahi karte)
  const [search, setSearch] = useState('')
  const [toasts, setToasts] = useState([])
  const greeting = getGreeting()

  // Toast helper — 4s baad auto dismiss
  function pushToast(type, message) {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  const loadRepos = useCallback(async () => {
    setError('')
    setNeedsGitHubLogin(false)
    setLoading(true)
    try {
      const me = await api('/api/users/me/')
      setUserEmail(me.email || '')
      setDisplayName(getDisplayName(me))

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
        pushToast('error', res.webhook_error)
      } else {
        pushToast(
          'success',
          webhookActive
            ? 'Repository connected! Webhook is active.'
            : 'Repository connected. Webhook pending.',
        )
      }
    } catch (err) {
      setError(err.message || 'Could not connect repository')
      pushToast('error', err.message || 'Could not connect repository')
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
      if (res.webhook_error) {
        setError(res.webhook_error)
        pushToast('error', res.webhook_error)
      } else {
        pushToast('success', 'Webhook is now active.')
      }
    } catch (err) {
      setError(err.message || err.data?.webhook_error || 'Webhook setup failed')
      pushToast('error', err.message || 'Webhook setup failed')
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
      pushToast('success', 'Repository disconnected.')
    } catch (err) {
      setError(err.message || 'Could not disconnect repository')
      pushToast('error', err.message || 'Could not disconnect repository')
    } finally {
      setActionId(null)
    }
  }

  const connectedCount = repos.filter((r) => r.connected).length
  // Search filter — sirf display pe, actual data untouched
  const visibleRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.trim().toLowerCase()),
  )
  const connectedRepos = repos.filter((r) => r.connected)

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* ── Shared sidebar (Repositories active) ── */}
      <DashboardSidebar userEmail={userEmail} displayName={loading ? '' : displayName} />

      <div className="ml-14">
        {/* ── Top bar ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg-base/85 px-6 backdrop-blur-md">
          <h1 className="font-display text-lg font-semibold text-text-primary">Repositories</h1>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3 py-1 text-sm text-text-secondary sm:inline-flex">
              {greeting.emoji} {greeting.text}
              {!loading && displayName ? `, ${displayName}` : ''}
            </span>
            {/* Refresh — existing loadRepos call */}
            <button
              type="button"
              onClick={loadRepos}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <RotateCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {/* Connect Repository — GitHub list tak scroll (visual only) */}
            <a
              href="#github-repos"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Plus size={15} /> Connect Repository
            </a>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="mx-auto max-w-[1200px] px-6 py-6">
          {/* GitHub sign-in required — full width */}
          {needsGitHubLogin && !loading ? (
            <div className="flex flex-col items-center rounded-2xl border border-border bg-bg-surface p-12 text-center">
              <FoxLogo size={56} className="opacity-70" />
              <h2 className="mt-5 font-display text-xl font-bold">GitHub sign-in required</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
                Email/password login does not include a GitHub API token. Use{' '}
                <strong className="text-text-primary">Continue with GitHub</strong> to load your
                repos.
              </p>
              <Link
                to="/login"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary/90"
              >
                <GitHubIcon size={17} /> Go to login
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {/* ── LEFT (65%) — GitHub repos ── */}
              <section id="github-repos" className="col-span-2">
                <h2 className="font-display text-lg font-bold">GitHub Repositories</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Select a repository to connect and start analyzing commits
                </p>

                {/* Search bar */}
                <div className="relative mt-4">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-full rounded-lg border border-border bg-bg-surface-elevated py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Error banner (load errors) */}
                {error && !loading && (
                  <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                {/* Loading — 5 skeleton cards */}
                {loading ? (
                  <div className="mt-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-border bg-bg-surface p-4">
                        <div className="flex items-center justify-between">
                          <div className="h-4 w-1/2 animate-pulse rounded bg-bg-surface-elevated" />
                          <div className="h-5 w-16 animate-pulse rounded bg-bg-surface-elevated" />
                        </div>
                        <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-bg-surface-elevated" />
                        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-bg-surface-elevated" />
                      </div>
                    ))}
                  </div>
                ) : visibleRepos.length === 0 ? (
                  // Empty state
                  <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-border bg-bg-surface p-10 text-center">
                    <FoxLogo size={40} className="opacity-40" />
                    <p className="mt-4 text-text-secondary">
                      {search ? 'No repositories match your search' : 'No repositories found'}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      Make sure your GitHub account is connected
                    </p>
                    <Link
                      to="/login"
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      <GitHubIcon size={16} /> Sign in with GitHub
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {visibleRepos.map((repo) => {
                      const connecting = actionId === repo.id
                      return (
                        <div
                          key={repo.id}
                          className={`rounded-xl border bg-bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:bg-bg-surface-elevated ${
                            connecting ? 'animate-pulse border-primary' : 'border-border'
                          }`}
                        >
                          {/* TOP ROW: fork icon + name + visibility pill */}
                          <div className="flex items-start justify-between gap-3">
                            <a
                              href={repo.html_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex min-w-0 items-center gap-2 font-semibold text-text-primary hover:text-primary"
                            >
                              <GitFork size={16} className="shrink-0 text-text-muted" />
                              <span className="truncate">{repo.full_name}</span>
                              <ExternalLink size={13} className="shrink-0 text-text-muted" />
                            </a>
                            {/* Language API me nahi aata — visibility (Public/Private) real hai */}
                            <span className="shrink-0 rounded-full border border-border bg-bg-surface-elevated px-2.5 py-0.5 text-xs text-text-secondary">
                              {repo.private ? 'Private' : 'Public'}
                            </span>
                          </div>

                          {/* MIDDLE ROW: description */}
                          <p
                            className={`mt-2 truncate text-sm ${
                              repo.description ? 'text-text-secondary' : 'italic text-text-muted'
                            }`}
                          >
                            {repo.description || 'No description provided'}
                          </p>

                          {/* BOTTOM ROW: status + connect button */}
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="font-mono text-xs text-text-muted">
                              {repo.connected && repo.webhook_active ? (
                                <span className="inline-flex items-center gap-1 text-success">
                                  <CheckCircle2 size={13} /> Webhook active
                                </span>
                              ) : repo.connected ? (
                                <span className="inline-flex items-center gap-1 text-warning">
                                  <XCircle size={13} /> Webhook pending
                                </span>
                              ) : (
                                'Not connected'
                              )}
                            </span>

                            {repo.connected ? (
                              <span className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-success bg-success/10 px-3 py-1.5 text-sm font-semibold text-success">
                                <CheckCircle2 size={14} /> Connected
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={connecting}
                                onClick={() => handleConnect(repo)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-70"
                              >
                                {connecting ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" /> Connecting...
                                  </>
                                ) : (
                                  <>
                                    <Plus size={14} /> Connect
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* ── RIGHT (35%) — Connected repos ── */}
              <section className="col-span-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold">Connected</h2>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                    {connectedCount}
                  </span>
                  {githubUsername && (
                    <span className="ml-auto truncate font-mono text-xs text-text-muted">
                      @{githubUsername}
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="mt-4 space-y-3">
                    {[0, 1].map((i) => (
                      <div key={i} className="rounded-xl border border-border bg-bg-surface p-4">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-bg-surface-elevated" />
                        <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-bg-surface-elevated" />
                      </div>
                    ))}
                  </div>
                ) : connectedRepos.length === 0 ? (
                  <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-border bg-bg-surface p-8 text-center">
                    <FoxLogo size={40} className="opacity-40" />
                    <p className="mt-4 text-text-secondary">No repositories connected yet</p>
                    <p className="mt-1 text-sm text-text-muted">
                      Connect a repo from the left to start
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {connectedRepos.map((repo) => {
                      const viewing = commitsRepo?.githubId === repo.id
                      const busy = actionId === repo.id
                      return (
                        <div
                          key={repo.id}
                          className="rounded-xl border border-border bg-bg-surface p-4 transition-colors hover:border-primary/40"
                        >
                          {/* TOP ROW: name + webhook badge */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium text-text-primary">
                              {repo.full_name}
                            </span>
                            {repo.webhook_active ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                                <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Inactive
                              </span>
                            )}
                          </div>

                          {/* MIDDLE ROW: visibility (last-analyzed/commit-count is API me nahi) */}
                          <p className="mt-2 font-mono text-xs text-text-muted">
                            {repo.private ? 'Private repository' : 'Public repository'}
                          </p>

                          {/* Webhook inactive warning banner */}
                          {!repo.webhook_active && (
                            <div className="mt-3 rounded-lg border border-warning/20 bg-warning/[0.08] p-2.5">
                              <p className="flex items-start gap-1.5 text-xs text-warning">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                Webhook inactive — commits won't be analyzed
                              </p>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRetryWebhook(repo)}
                                className="mt-2 text-xs font-semibold text-warning hover:underline disabled:opacity-60"
                              >
                                {busy ? 'Setting up…' : 'Setup Webhook'}
                              </button>
                            </div>
                          )}

                          {/* BOTTOM ROW: View commits + Disconnect */}
                          <div className="mt-3 flex items-center gap-2">
                            {repo.db_id && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCommitsRepo(
                                    viewing
                                      ? null
                                      : {
                                          dbId: repo.db_id,
                                          fullName: repo.full_name,
                                          githubId: repo.id,
                                        },
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-primary hover:text-primary"
                              >
                                <GitCommit size={13} /> {viewing ? 'Hide' : 'View Commits'}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDisconnect(repo)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                            >
                              {busy ? '…' : 'Disconnect'}
                            </button>
                          </div>

                          {/* Inline commits (existing toggle logic) */}
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
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ── Toast stack (bottom-right) ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-up flex items-center gap-2.5 rounded-lg border bg-bg-surface px-4 py-3 text-sm shadow-xl ${
              t.type === 'success' ? 'border-success text-success' : 'border-danger text-danger'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span className="text-text-primary">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Repositories
