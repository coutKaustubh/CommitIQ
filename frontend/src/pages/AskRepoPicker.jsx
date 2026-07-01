import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch, ArrowRight, Sparkles } from 'lucide-react'
import { api } from '../api/client.js'
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import { getDisplayName } from '../utils/displayName.js'
import { listChatsForRepo, migrateLegacyChats } from '../utils/askChatStorage.js'

// Repo card — click pe existing navigation (/dashboard/ask/:id) chalti hai
function RepoCard({ repo, chatCount }) {
  return (
    <Link
      to={`/dashboard/ask/${repo.id}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:bg-bg-surface-elevated"
    >
      <GitBranch size={20} className="shrink-0 text-violet" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{repo.full_name}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {chatCount === 0
            ? 'New conversation'
            : `${chatCount} chat session${chatCount === 1 ? '' : 's'}`}
        </p>
      </div>
      <ArrowRight
        size={18}
        className="shrink-0 text-text-muted transition-colors group-hover:text-primary"
      />
    </Link>
  )
}

export default function AskRepoPicker() {
  // ⚠️ Data logic (useEffect, fetch, state) bilkul as-is hai.
  const [repos, setRepos] = useState([])
  const [userEmail, setUserEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    migrateLegacyChats()
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [me, reposData] = await Promise.all([
          api('/api/users/me/'),
          api('/api/repos/connected/'),
        ])
        if (cancelled) return
        setUserEmail(me.email || '')
        setDisplayName(getDisplayName(me))
        setRepos(reposData.connected || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load repositories')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page-enter min-h-screen bg-bg-base text-text-primary">
      {/* Shared sidebar */}
      <DashboardSidebar userEmail={userEmail} displayName={loading ? '' : displayName} />

      <div className="ml-14">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-bg-base/85 px-6 backdrop-blur-md">
          <h1 className="font-display text-lg font-semibold text-text-primary">Ask AI</h1>
        </header>

        {/* Content — centered 600px */}
        <main className="mx-auto max-w-[600px] px-6 py-10">
          {/* Header: fox with glow + title + subtitle */}
          <div className="text-center">
            <div className="relative mx-auto flex h-[120px] w-[120px] items-center justify-center">
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)',
                }}
              />
              <FoxLogo size={64} className="relative animate-float" />
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold text-text-primary">Ask AI</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
              Ask anything about your codebase. Powered by RAG — answers grounded in your actual
              code.
            </p>
          </div>

          {error && (
            <div className="mt-8 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Repo selection */}
          <p className="mb-3 mt-10 font-mono text-xs uppercase tracking-widest text-text-secondary">
            Choose a repository
          </p>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl border border-border bg-bg-surface p-4"
                >
                  <div className="h-5 w-5 animate-pulse rounded bg-bg-surface-elevated" />
                  <div className="flex-1">
                    <div className="h-4 w-1/2 animate-pulse rounded bg-bg-surface-elevated" />
                    <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-bg-surface-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : repos.length === 0 && !error ? (
            // Empty state
            <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-bg-surface p-10 text-center">
              <FoxLogo size={48} className="opacity-40" />
              <p className="mt-4 font-semibold text-text-primary">No repositories connected</p>
              <p className="mt-1 text-sm text-text-secondary">
                Connect a repository first to start asking questions
              </p>
              <Link
                to="/dashboard/repositories"
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Go to Repositories
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {repos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} chatCount={listChatsForRepo(repo.id).length} />
              ))}
            </div>
          )}

          <p className="mt-8 flex items-center justify-center gap-1.5 font-mono text-xs text-text-muted">
            <Sparkles size={12} /> Chats are saved in this browser per repository
          </p>
        </main>
      </div>
    </div>
  )
}
