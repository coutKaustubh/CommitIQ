import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, GitCommit, ArrowRight, Activity } from 'lucide-react'
import { api } from '../api/client.js'
import { fetchRecentAnalysis } from '../api/analysis.js'
import DashboardShell from '../components/DashboardShell.jsx'
import StatCard from '../components/StatCard.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import SkeletonCard from '../components/SkeletonCard.jsx'
import PerformanceGraph from '../components/PerformanceGraph.jsx'
import { getGreeting } from '../utils/greeting.js'
import { getDisplayName } from '../utils/displayName.js'
import { timeAgo } from '../utils/time.js'
import { MOCK_PERF_SERIES } from '../data/mock.js'

function Dashboard() {
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
  const warningCount = analysisFeed.filter((i) => i.risk === 'WARNING').length

  return (
    <DashboardShell
      userEmail={user?.email || (loading ? 'Loading…' : '')}
      displayName={loading ? '' : displayName}
    >
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-light">
          Dashboard overview
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {greeting.emoji} {greeting.text}, {displayName} <span className="text-2xl">👋</span>
        </h1>
        <p className="mt-1 text-secondary">Here is what changed across your commits.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)
        ) : (
          <>
            <StatCard
              label="Commits analyzed"
              value={analysisStats.analyzed || analysisFeed.length || '—'}
              trend="up"
              subtitle="Background Celery jobs"
            />
            <StatCard
              label="Regressions found"
              value={analysisStats.critical || '0'}
              trend="down"
              subtitle="CRITICAL risk level"
            />
            <StatCard label="Warnings" value={warningCount} subtitle="Needs review" />
            <StatCard label="Repos connected" value={connected.length} accent subtitle="Live webhooks" />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Your Repositories</h2>
            <Link
              to="/dashboard/repositories"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Plus size={15} /> Connect New Repo
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : connected.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center">
              <p className="text-content">No repositories connected yet.</p>
              <p className="mt-1 text-sm text-secondary">
                Connect your first repo to start catching regressions.
              </p>
              <Link
                to="/dashboard/repositories"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <Plus size={15} /> Connect GitHub Repo
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {connected.map((repo) => {
                const feedItem = analysisFeed.find(
                  (f) => f.repo_id === repo.id || f.full_name === repo.full_name,
                )
                const lastCommit = recentCommitsByRepo[repo.id]
                const linkSha = feedItem?.full_sha || lastCommit?.sha || ''
                return (
                  <div
                    key={repo.id}
                    className="rounded-xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <GitCommit size={16} className="text-primary-light" />
                          <span className="truncate font-semibold text-content">{repo.full_name}</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm text-secondary">
                          {feedItem?.message ||
                            lastCommit?.message?.split('\n')[0] ||
                            'Push to this repo to trigger analysis'}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted">
                          {feedItem?.at
                            ? `Last analyzed ${timeAgo(feedItem.at)}`
                            : `Connected ${timeAgo(repo.created_at) || 'recently'}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <RiskBadge level={feedItem?.risk || 'OK'} />
                        {linkSha ? (
                          <Link
                            to={`/dashboard/commits/${linkSha}`}
                            className="inline-flex items-center gap-1 text-sm text-primary-light hover:underline"
                          >
                            View Analysis <ArrowRight size={14} />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl font-bold">Performance</h2>
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-secondary">
                <Activity size={13} /> Latency / 30 commits
              </span>
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-xs text-warning">
                Coming soon
              </span>
            </div>
            <div className="mt-3 opacity-60">
              <PerformanceGraph data={MOCK_PERF_SERIES} height={200} />
            </div>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-xl font-bold">Recent Analysis</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {loading ? (
            <div className="p-6 text-sm text-secondary">Loading analysis feed…</div>
          ) : analysisFeed.length === 0 ? (
            <div className="p-6 text-sm text-secondary">
              No analysis yet. Connect a repo and push a commit — the webhook will queue a Celery
              job automatically.
            </div>
          ) : (
            analysisFeed.map((item, i) => (
              <Link
                key={item.id}
                to={`/dashboard/commits/${item.full_sha || item.sha}`}
                className={`flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-surface-hover ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <code className="rounded bg-bg px-2 py-1 font-mono text-xs text-primary-light">
                  {item.sha}
                </code>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content">{item.message}</p>
                  <p className="font-mono text-xs text-muted">
                    {item.topIssue} · {item.author} · {timeAgo(item.at)}
                    {item.status && item.status !== 'done' ? ` · ${item.status}` : ''}
                  </p>
                </div>
                <RiskBadge level={item.risk} />
                <ArrowRight size={16} className="text-secondary" />
              </Link>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  )
}

export default Dashboard
