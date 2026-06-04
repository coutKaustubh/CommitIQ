import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

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
    <div className="commits-panel">
      <div className="commits-panel-header">
        <h3>Recent commits — {fullName}</h3>
        {onClose && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      {loading && <p className="hint">Loading commits…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && commits.length === 0 && (
        <p className="hint">No commits found for this repository.</p>
      )}
      {!loading && !error && commits.length > 0 && (
        <div className="commits-table-wrap">
          <table className="commits-table">
            <thead>
              <tr>
                <th>SHA</th>
                <th>Message</th>
                <th>Author</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {commits.map((c) => (
                <tr key={c.sha}>
                  <td>
                    {c.html_url ? (
                      <a href={c.html_url} target="_blank" rel="noreferrer" className="commit-sha">
                        {c.short_sha}
                      </a>
                    ) : (
                      <code className="commit-sha">{c.short_sha}</code>
                    )}
                  </td>
                  <td className="commit-message">{c.message.split('\n')[0]}</td>
                  <td>{c.author_name || '—'}</td>
                  <td className="commit-date">{formatDate(c.committed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CommitsList
