import { AlertTriangle, FileCode, GitCommit } from 'lucide-react'
import RiskBadge from '../RiskBadge.jsx'

/**
 * Static commit detail mockup — "Everything's connected" section ke right side ke liye.
 * Real CommitDetail page jaisa simplified preview, screenshot feel dene ke liye.
 */
function CommitDetailMockup() {
  return (
    <div className="glow-ember overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-2xl">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-bg-surface-elevated px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-3 font-mono text-xs text-text-secondary">commitiq — commit detail</span>
      </div>

      <div className="p-5">
        {/* Commit header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-text-secondary">
              <GitCommit size={14} />
              <span className="font-mono text-xs">4f9ab6b</span>
            </div>
            <p className="mt-1 truncate font-display text-sm font-semibold text-text-primary">
              fix: optimize checkout query path
            </p>
          </div>
          <RiskBadge level="CRITICAL" />
        </div>

        {/* Issues */}
        <div className="mt-5 rounded-lg border border-danger/25 bg-danger/5 p-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-danger">
            <AlertTriangle size={14} />
            Issues found
          </div>
          <p className="mt-2 text-sm text-text-primary">
            N+1 Query detected in{' '}
            <code className="rounded bg-bg-base px-1.5 py-0.5 font-mono text-xs text-primary">
              checkout/views.py
            </code>
          </p>
          <p className="mt-1 font-mono text-xs text-text-secondary">Line 47 · severity: high</p>
        </div>

        {/* File changes */}
        <div className="mt-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-text-secondary">
            <FileCode size={14} className="text-violet" />
            Files changed
          </div>
          <ul className="mt-2 space-y-1.5">
            {[
              { path: 'checkout/views.py', add: 12, del: 3 },
              { path: 'checkout/serializers.py', add: 4, del: 1 },
              { path: '.env.example', add: 0, del: 0, sensitive: true },
            ].map((f) => (
              <li
                key={f.path}
                className="flex items-center justify-between rounded-md border border-border bg-bg-base px-3 py-2 font-mono text-xs"
              >
                <span className={f.sensitive ? 'text-warning' : 'text-text-primary'}>{f.path}</span>
                <span className="text-text-muted">
                  {f.sensitive ? (
                    <span className="text-warning">sensitive</span>
                  ) : (
                    <>
                      <span className="text-success">+{f.add}</span>{' '}
                      <span className="text-danger">-{f.del}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Ask AI teaser */}
        <div className="mt-4 rounded-lg border border-violet/30 bg-violet/5 px-3 py-2.5">
          <p className="font-mono text-xs text-accent-lime">Ask AI</p>
          <p className="mt-1 text-sm text-text-secondary">
            &ldquo;Why did this commit slow down /checkout?&rdquo;
          </p>
        </div>
      </div>
    </div>
  )
}

export default CommitDetailMockup
