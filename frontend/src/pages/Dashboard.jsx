import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  GitCommit,
  GitBranch,
  AlertTriangle,
  Zap,
  ArrowRight,
  Activity,
} from 'lucide-react'
import { api } from '../api/client.js'
import { fetchRecentAnalysis } from '../api/analysis.js'
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx'
import StatTile from '../components/dashboard/StatTile.jsx'
import CountUp from '../components/dashboard/CountUp.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import PerformanceGraph from '../components/PerformanceGraph.jsx'
import { getGreeting } from '../utils/greeting.js'
import { getDisplayName } from '../utils/displayName.js'
import { timeAgo } from '../utils/time.js'
import { MOCK_PERF_SERIES } from '../data/mock.js'

function Dashboard() {
  // ⚠️ Neeche ka saara data logic AS-IS hai — sirf JSX/styling badla hai.
  const [user, setUser] = useState(null)
  const [connected, setConnected] = useState([])
  const [recentCommitsByRepo, setRecentCommitsByRepo] = useState({})
  const [analysisFeed, setAnalysisFeed] = useState([])
  const [analysisStats, setAnalysisStats] = useState({ analyzed: 0, critical: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const greeting = getGreeting()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [me, reposData, analysisData] = await Promise.all([
          api('/api/users/me/'),
          api('/api/repos/connected/').catch(() => ({ connected: [] })),
          fetchRecentAnalysis().catch(() => ({ feed: [], stats: {} })),
        ])
        if (cancelled) return
        setUser(me)
        const list = reposData.connected || []
        setConnected(list)
        setAnalysisFeed(analysisData.feed || [])
        setAnalysisStats(analysisData.stats || { analyzed: 0, critical: 0 })

        if (list.length > 0) {
          try {
            const commitsByRepo = await Promise.all(
              list.map((repo) =>
                api(`/api/repos/${repo.id}/commits/`)
                  .then((data) => ({
                    repoId: repo.id,
                    commits: (data.commits || []).slice(0, 1),
                  }))
                  .catch(() => ({ repoId: repo.id, commits: [] })),
              ),
            )
            if (!cancelled) {
              const map = {}
              for (const entry of commitsByRepo) {
                map[entry.repoId] = entry.commits[0] || null
              }
              setRecentCommitsByRepo(map)
            }
          } catch {
            if (!cancelled) setRecentCommitsByRepo({})
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load profile')
          if (err.status === 401) {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/'
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = getDisplayName(user)
  // Derived counts — sab existing state se, koi extra API nahi
  const commitsAnalyzed = analysisStats.analyzed || analysisFeed.length || 0
  const criticalCount = analysisStats.critical || 0
  const regressionsCount = analysisFeed.filter(
    (f) => f.risk && !['OK', 'LOW'].includes(String(f.risk).toUpperCase()),
  ).length

  return (
    <div className="page-enter min-h-screen bg-bg-base text-text-primary">
      {/* ── Left sidebar (icon-only, hover pe expand) ── */}
      <DashboardSidebar userEmail={user?.email || ''} displayName={loading ? '' : displayName} />

      {/* Sidebar 56px hai, isliye content ko ml-14 diya */}
      <div className="ml-14">
        {/* ── Top bar ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg-base/85 px-6 backdrop-blur-md">
          <h1 className="font-display text-lg font-semibold text-text-primary">Dashboard</h1>
          <div className="flex items-center gap-3">
            {/* Greeting pill */}
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3 py-1 text-sm text-text-secondary sm:inline-flex">
              {greeting.emoji} {greeting.text}
              {!loading && displayName ? `, ${displayName}` : ''}
            </span>
            {/* Connect Repository — link to repositories page (existing route) */}
            <Link
              to="/dashboard/repositories"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Plus size={15} /> Connect Repository
            </Link>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="mx-auto max-w-[1200px] px-6 py-6">
          {error && (
            <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* ── 1. Stats row ── */}
          <div className="grid grid-cols-4 gap-4">
            {loading ? (
              // Skeleton — 4 gray blocks, real cards jaise size
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-bg-surface p-5">
                  <div className="h-5 w-5 animate-pulse rounded bg-bg-surface-elevated" />
                  <div className="mt-4 h-8 w-16 animate-pulse rounded bg-bg-surface-elevated" />
                  <div className="mt-3 h-3 w-24 animate-pulse rounded bg-bg-surface-elevated" />
                </div>
              ))
            ) : (
              <>
                <StatTile
                  icon={GitCommit}
                  label="Commits analyzed"
                  value={commitsAnalyzed ? <CountUp value={commitsAnalyzed} /> : '—'}
                  color="text-violet"
                  trend="up"
                />
                <StatTile
                  icon={AlertTriangle}
                  label="Regressions found"
                  value={<CountUp value={regressionsCount} />}
                  color="text-primary"
                />
                <StatTile
                  icon={Zap}
                  label="Critical issues"
                  value={<CountUp value={criticalCount} />}
                  color="text-danger"
                />
                <StatTile
                  icon={GitBranch}
                  label="Repos connected"
                  value={<CountUp value={connected.length} />}
                  color="text-success"
                />
              </>
            )}
          </div>

          {/* ── 2 + 3. Feed (60%) + Right column (40%) ── */}
          <div className="mt-6 grid grid-cols-5 gap-6">
            {/* ── 2. Recent Analysis feed (left, 60%) ── */}
            <section className="col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Recent Analysis</h2>
                {analysisFeed.length > 0 && (
                  <span className="text-sm text-text-secondary">View all</span>
                )}
              </div>

              {loading ? (
                // Feed skeleton — 3 blocks with varying widths
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-border bg-bg-surface p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-16 animate-pulse rounded bg-bg-surface-elevated" />
                        <div
                          className="h-4 animate-pulse rounded bg-bg-surface-elevated"
                          style={{ width: `${55 - i * 10}%` }}
                        />
                      </div>
                      <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-bg-surface-elevated" />
                    </div>
                  ))}
                </div>
              ) : analysisFeed.length === 0 ? (
                // Empty state — fox + "waiting" pulse + CTA
                <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-bg-surface p-10 text-center">
                  <FoxLogo size={40} className="opacity-50" />
                  <p className="mt-4 text-text-secondary">No commits analyzed yet</p>
                  <p className="mt-1 text-sm text-text-muted">
                    Push a commit to a connected repository to see analysis here
                  </p>
                  {/* Pulsing dot — "waiting for commits" ka signal */}
                  <span className="relative mt-4 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                  <Link
                    to="/dashboard/repositories"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    <Plus size={15} /> Connect Repository
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysisFeed.map((item) => {
                    const hasIssue = item.topIssue && item.topIssue !== 'No issues detected'
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-bg-surface p-4 transition-colors hover:bg-bg-surface-elevated"
                      >
                        {/* Top row: sha + message + risk badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <code className="shrink-0 font-mono text-xs text-text-muted">
                              {item.sha}
                            </code>
                            <p className="truncate text-sm font-medium text-text-primary">
                              {item.message}
                            </p>
                          </div>
                          <RiskBadge level={item.risk} className="shrink-0" />
                        </div>

                        {/* Middle row: author · time */}
                        <p className="mt-2 font-mono text-xs text-text-secondary">
                          {item.author} · {timeAgo(item.at)}
                          {item.status && item.status !== 'done' ? ` · ${item.status}` : ''}
                        </p>

                        {/* Bottom row: top issue pill + View Details */}
                        <div className="mt-3 flex items-center justify-between gap-3">
                          {hasIssue ? (
                            <span className="inline-flex max-w-[75%] items-center gap-1.5 truncate rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1 font-mono text-xs text-danger">
                              🔴 <span className="truncate">{item.topIssue}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-xs text-success">
                              🟢 No issues detected
                            </span>
                          )}
                          <Link
                            to={`/dashboard/commits/${item.full_sha || item.sha}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
                          >
                            View Details <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── 3. Right column (40%) ── */}
            <div className="col-span-2 space-y-6">
              {/* Connected repos */}
              <section>
                <h2 className="mb-4 font-display text-lg font-bold">Repositories</h2>
                {loading ? (
                  <div className="space-y-3">
                    {[0, 1].map((i) => (
                      <div key={i} className="rounded-xl border border-border bg-bg-surface p-4">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-bg-surface-elevated" />
                        <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-bg-surface-elevated" />
                      </div>
                    ))}
                  </div>
                ) : connected.length === 0 ? (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-bg-surface p-8 text-center">
                    <FoxLogo size={40} className="opacity-40" />
                    <p className="mt-4 text-text-secondary">No repos connected</p>
                    <Link
                      to="/dashboard/repositories"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      <Plus size={15} /> Connect
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connected.map((repo) => {
                      // feed se last analyzed time nikaalo (agar match mile)
                      const feedItem = analysisFeed.find(
                        (f) => f.repo_id === repo.id || f.full_name === repo.full_name,
                      )
                      const lastCommit = recentCommitsByRepo[repo.id]
                      const linkSha = feedItem?.full_sha || lastCommit?.sha || ''
                      return (
                        <div
                          key={repo.id}
                          className="rounded-xl border border-border bg-bg-surface p-4 transition-colors hover:border-primary/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {/* Webhook status dot — active green, warna red */}
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  repo.webhook_active ? 'bg-success' : 'bg-danger'
                                }`}
                                title={repo.webhook_active ? 'Webhook active' : 'Webhook inactive'}
                              />
                              <span className="truncate font-medium text-text-primary">
                                {repo.full_name}
                              </span>
                            </div>
                            {linkSha ? (
                              <Link
                                to={`/dashboard/commits/${linkSha}`}
                                className="shrink-0 text-sm text-text-secondary transition-colors hover:text-primary"
                              >
                                View
                              </Link>
                            ) : null}
                          </div>
                          <p className="mt-2 font-mono text-xs text-text-muted">
                            {feedItem?.at
                              ? `Last analyzed ${timeAgo(feedItem.at)}`
                              : `Connected ${timeAgo(repo.created_at) || 'recently'}`}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Performance graph — data mock hai (PerformanceGraph logic touch nahi ki) */}
              <section>
                <h2 className="mb-4 font-display text-lg font-bold">Latency Trend</h2>
                <div className="rounded-xl border border-border bg-bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-text-secondary">
                      <Activity size={13} /> Latency / 30 commits
                    </span>
                    <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-xs text-warning">
                      Coming soon
                    </span>
                  </div>
                  <div className="mt-3 opacity-70">
                    <PerformanceGraph data={MOCK_PERF_SERIES} height={180} />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
