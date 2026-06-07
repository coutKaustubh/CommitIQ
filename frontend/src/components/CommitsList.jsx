import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, ExternalLink } from 'lucide-react'
import { api } from '../api/client.js'
import { timeAgo } from '../utils/time.js'

function CommitsList({ dbId, fullName, onClose }) {
  const [commits, setCommits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await api(`/api/repos/${dbId}/commits/`)
        if (!cancelled) setCommits(data.commits || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load commits')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (dbId) load()
    return () => {
      cancelled = true
    }
  }, [dbId])

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-mono text-xs uppercase tracking-widest text-secondary">
          Recent commits — {fullName}
        </h4>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-secondary hover:text-content"
          >
            <X size={13} /> Close
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-secondary">Loading commits…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && commits.length === 0 && (
        <p className="text-sm text-secondary">No commits found for this repository.</p>
      )}

      {!loading && !error && commits.length > 0 && (
        <div className="space-y-1.5">
          {commits.map((c) => (
            <div
              key={c.sha}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-hover"
            >
              <Link
                to={`/dashboard/commits/${c.sha}`}
                className="rounded bg-bg px-2 py-0.5 font-mono text-xs text-primary-light"
              >
                {c.short_sha}
              </Link>
              <span className="min-w-0 flex-1 truncate text-sm text-content">
                {c.message.split('\n')[0]}
              </span>
              <span className="hidden font-mono text-xs text-muted sm:inline">
                {c.author_name || '—'} · {timeAgo(c.committed_at)}
              </span>
              {c.html_url && (
                <a href={c.html_url} target="_blank" rel="noreferrer" className="text-secondary hover:text-content">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CommitsList
