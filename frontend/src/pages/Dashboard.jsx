import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, GitCommit, ArrowRight, Activity } from 'lucide-react'
import { api } from '../api/client.js'
import DashboardShell from '../components/DashboardShell.jsx'
import StatCard from '../components/StatCard.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import SkeletonCard from '../components/SkeletonCard.jsx'
import PerformanceGraph from '../components/PerformanceGraph.jsx'
import { getGreeting } from '../utils/greeting.js'
import { timeAgo } from '../utils/time.js'
import { MOCK_ANALYSIS_FEED, MOCK_PERF_SERIES } from '../data/mock.js'

const RISK_BY_INDEX = ['CRITICAL', 'OK', 'WARNING', 'OK', 'LOW']

function Dashboard() {
  const [user, setUser] = useState(null)
  const [connected, setConnected] = useState([])
  const [recentCommits, setRecentCommits] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const greeting = getGreeting()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [me, reposData] = await Promise.all([
          api('/api/users/me/'),
          api('/api/repos/connected/').catch(() => ({ connected: [] })),
        ])
        if (cancelled) return
        setUser(me)
        const list = reposData.connected || []
        setConnected(list)
        if (list.length > 0) {
          try {
            const commitsData = await api(`/api/repos/${list[0].id}/commits/`)
            if (!cancelled) setRecentCommits((commitsData.commits || []).slice(0, 5))
          } catch {
            if (!cancelled) setRecentCommits([])
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

  const username = user?.email ? user.email.split('@')[0] : 'developer'

  return (
    <DashboardShell userEmail={user?.email || (loading ? 'Loading…' : '')}>
      {/* Greeting */}
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-light">
          Dashboard overview
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {greeting.text}, {username} <span className="text-2xl">👋</span>
        </h1>
        <p className="mt-1 text-secondary">Here is what changed across your commits.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)
        ) : (
          <>
            <StatCard label="Commits analyzed" value={recentCommits.length || '—'} trend="up" subtitle="Across connected repos" />
            <StatCard label="Regressions found" value="1" trend="down" subtitle="Last 30 commits" />
            <StatCard label="Critical issues" value="1" subtitle="Needs attention" />
            <StatCard label="Repos connected" value={connected.length} accent subtitle="Live webhooks" />
          </>
        )}
      </div>

      {/* Repositories + Performance */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Repositories */}
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
              {connected.map((repo, i) => {
                const lastCommit = i === 0 ? recentCommits[0] : null
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
                          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-secondary">
                            Python
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm text-secondary">
                          {lastCommit ? lastCommit.message.split('\n')[0] : 'No commits analyzed yet'}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted">
                          Last analyzed {timeAgo(repo.created_at) || 'recently'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <RiskBadge level={RISK_BY_INDEX[i % RISK_BY_INDEX.length]} />
                        <Link
                          to={`/dashboard/commits/${lastCommit?.sha || 'demo'}`}
                          className="inline-flex items-center gap-1 text-sm text-primary-light hover:underline"
                        >
                          View Analysis <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Performance graph */}
        <section>
          <h2 className="mb-4 font-display text-xl font-bold">Performance</h2>
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-secondary">
                <Activity size={13} /> Latency / 30 commits
              </span>
              <span className="font-mono text-xs text-danger">spike</span>
            </div>
            <div className="mt-3">
              <PerformanceGraph data={MOCK_PERF_SERIES} height={200} />
            </div>
          </div>
        </section>
      </div>

      {/* Recent analysis feed */}
      <section className="mt-8">
        <h2 className="mb-4 font-display text-xl font-bold">Recent Analysis</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {MOCK_ANALYSIS_FEED.map((item, i) => (
            <Link
              key={item.id}
              to={`/dashboard/commits/${item.sha}`}
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
                </p>
              </div>
              <RiskBadge level={item.risk} />
              <ArrowRight size={16} className="text-secondary" />
            </Link>
          ))}
        </div>
        <p className="mt-3 font-mono text-xs text-muted">
          Analysis feed uses sample data — live results arrive when the analysis pipeline ships.
        </p>
      </section>
    </DashboardShell>
  )
}

export default Dashboard
