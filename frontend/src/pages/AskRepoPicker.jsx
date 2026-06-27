import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Sparkles } from 'lucide-react'
import { api } from '../api/client.js'
import DashboardShell from '../components/DashboardShell.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import { getDisplayName } from '../utils/displayName.js'
import { listChatsForRepo, migrateLegacyChats } from '../utils/askChatStorage.js'

function RepoCard({ repo, chatCount }) {
  return (
    <Link
      to={`/dashboard/ask/${repo.id}`}
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/50 hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold text-primary-light">
            {repo.full_name}
          </p>
          <p className="mt-1 text-xs text-muted">
            {chatCount === 0
              ? 'No chats yet — start one'
              : `${chatCount} chat${chatCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <span className="rounded-lg bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary/20">
          <MessageSquare size={18} />
        </span>
      </div>
      <p className="mt-4 text-sm text-secondary">
        Ask questions about commits, diffs, and analysis for this repository only.
      </p>
    </Link>
  )
}

export default function AskRepoPicker() {
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
    <DashboardShell userEmail={userEmail} displayName={displayName}>
      <div className="mb-8 text-center">
        <FoxLogo size={48} className="mx-auto animate-float" />
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-primary-light">Ask AI</p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Choose a repository</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-secondary">
          Each repo has its own chat room. Pick one to start or continue a conversation about that
          codebase.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-secondary">Loading repositories…</p>
      )}

      {!loading && repos.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center">
          <p className="text-secondary">No connected repositories yet.</p>
          <Link
            to="/dashboard/repositories"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Connect a repo first →
          </Link>
        </div>
      )}

      {!loading && repos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              chatCount={listChatsForRepo(repo.id).length}
            />
          ))}
        </div>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 font-mono text-xs text-muted">
        <Sparkles size={12} /> Chats are saved in this browser per repository
      </p>
    </DashboardShell>
  )
}
