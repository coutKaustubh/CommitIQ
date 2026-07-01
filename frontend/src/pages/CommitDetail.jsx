import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  User,
  Clock,
  ExternalLink,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Send,
  RefreshCw,
} from 'lucide-react'
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import { timeAgo } from '../utils/time.js'
import { fetchCommitAnalysis, fetchAnalysisJob, retryAnalysis } from '../api/analysis.js'
import { askCommit } from '../api/rag.js'

// Severity → left border hex (spec ke exact colors)
const SEVERITY_HEX = {
  CRITICAL: '#FB5A5A',
  HIGH: '#FF6A3D',
  MEDIUM: '#FBBF24',
  LOW: '#4ADE80',
}
function severityHex(sev) {
  return SEVERITY_HEX[String(sev || '').toUpperCase()] || '#2A2832'
}

// Suggested questions — click pe input populate hota hai (existing handler use hota hai)
const SUGGESTED = [
  'Why did this commit cause a regression?',
  'Which file is most risky?',
  'How can I fix the N+1 issue?',
]

function CommitDetail() {
  // ⚠️ Saara data + polling + ask logic AS-IS hai. Sirf JSX/styling badla.
  const { id: shaParam } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [question, setQuestion] = useState('What logic was added in this commit?')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
  // UI-only states (data logic ko touch nahi karte)
  const [copied, setCopied] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)

  // Initial load: fetch full analysis payload for this commit SHA.
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchCommitAnalysis(shaParam)
        if (!cancelled) {
          setAnalysis(data)
          setAnswer(data.ai?.answer || '')
          setQuestion('What logic was added in this commit?')
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load analysis')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (shaParam) load()
    return () => {
      cancelled = true
    }
  }, [shaParam])

  // Poll job status every 2s while Celery worker is still running (pending/running).
  useEffect(() => {
    if (!analysis?.job_id) return
    const terminal = ['done', 'failed']
    if (terminal.includes(analysis.status)) return

    const interval = setInterval(async () => {
      try {
        const job = await fetchAnalysisJob(analysis.job_id)
        if (job.status === 'done' || job.status === 'failed') {
          const full = await fetchCommitAnalysis(shaParam)
          setAnalysis(full)
          setAnswer(full.ai?.answer || '')
        } else {
          setAnalysis((prev) => ({ ...prev, ...job }))
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [analysis?.job_id, analysis?.status, shaParam])

  async function handleRetry() {
    if (!analysis?.job_id) return
    setRetrying(true)
    try {
      await retryAnalysis({ job_id: analysis.job_id })
      const data = await fetchCommitAnalysis(shaParam)
      setAnalysis(data)
      setError('')
    } catch (err) {
      setError(err.message || 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  async function handleAsk(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q || asking || !shaParam) return

    setAskError('')
    setAsking(true)
    try {
      const res = await askCommit(shaParam, q)
      setAnswer(res.answer || 'No answer returned.')
    } catch (err) {
      setAskError(err.message || 'Could not get an AI answer. Check GROQ_API_KEY on the backend.')
    } finally {
      setAsking(false)
    }
  }

  // Copy SHA — UI-only, koi API nahi
  function copySha() {
    const full = analysis?.sha || shaParam || ''
    navigator.clipboard?.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const isAnalyzing = analysis && ['pending', 'running'].includes(analysis.status)
  const staticIssues = analysis?.static || analysis?.issues || []
  const fileChanges = analysis?.file_changes || []
  const displaySha = analysis?.short_sha || shaParam
  const jobStatus = analysis?.status

  // Job status pill config
  function statusPill(s) {
    switch (s) {
      case 'pending':
        return { cls: 'bg-warning/10 text-warning', label: '⏳ Pending', spin: false }
      case 'running':
        return { cls: 'bg-violet/10 text-violet', label: 'Analyzing...', spin: true }
      case 'done':
        return { cls: 'bg-success/10 text-success', label: '✓ Complete', spin: false }
      case 'failed':
        return { cls: 'bg-danger/10 text-danger', label: '✗ Failed', spin: false }
      default:
        return null
    }
  }
  const pill = statusPill(jobStatus)

  // File status badge config
  function fileStatusBadge(s) {
    const v = String(s || '').toLowerCase()
    if (v === 'added') return { cls: 'bg-success/10 text-success', label: '+ Added' }
    if (v === 'removed') return { cls: 'bg-danger/10 text-danger', label: '- Removed' }
    return { cls: 'bg-violet/10 text-violet', label: '~ Modified' }
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* ── Shared sidebar ── */}
      <DashboardSidebar userEmail="" displayName="" />

      <div className="ml-14">
        {/* ── Top bar ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg-base/85 px-6 backdrop-blur-md">
          <h1 className="font-display text-lg font-semibold text-text-primary">Commit Analysis</h1>
        </header>

        {/* ── Content (max 900px) ── */}
        <main className="mx-auto max-w-[900px] px-6 py-6">
          {/* Breadcrumb — existing back navigation */}
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <ArrowLeft size={15} /> Back
          </Link>

          {/* Full-page loading skeleton */}
          {loading && (
            <div className="mt-4 space-y-6">
              <div className="h-40 animate-pulse rounded-xl border border-border bg-bg-surface" />
              <div className="space-y-3">
                <div className="h-24 animate-pulse rounded-xl border border-border bg-bg-surface" />
                <div className="h-24 animate-pulse rounded-xl border border-border bg-bg-surface" />
              </div>
              <div className="h-16 animate-pulse rounded-xl border border-border bg-bg-surface" />
            </div>
          )}

          {error && !analysis && (
            <div className="mt-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
              {error}
            </div>
          )}

          {analysis && (
            <>
              {/* ── SECTION 1: Commit header ── */}
              <div className="mt-4 rounded-xl border border-border bg-bg-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    {/* SHA + copy */}
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm text-text-muted">{displaySha}</code>
                      <button
                        type="button"
                        onClick={copySha}
                        className="relative text-text-muted transition-colors hover:text-primary"
                        title="Copy SHA"
                      >
                        <Copy size={12} />
                        {copied && (
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-bg-surface-elevated px-2 py-0.5 text-xs text-success">
                            Copied!
                          </span>
                        )}
                      </button>
                    </div>
                    {/* Full commit message */}
                    <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
                      {analysis.message}
                    </h2>
                  </div>

                  {/* Risk + job status */}
                  <div className="flex flex-col items-end gap-2">
                    <RiskBadge level={analysis.risk || 'OK'} className="px-3 py-1 text-sm" />
                    {pill && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium ${pill.cls}`}
                      >
                        {pill.spin && <Loader2 size={12} className="animate-spin" />}
                        {pill.label}
                      </span>
                    )}
                    {jobStatus === 'failed' && (
                      <button
                        type="button"
                        disabled={retrying}
                        onClick={handleRetry}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                      >
                        <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
                        Retry Analysis
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom row: author · time · github */}
                <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <User size={15} className="text-text-muted" /> {analysis.author}
                  </span>
                  <span className="text-text-muted">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} className="text-text-muted" /> {timeAgo(analysis.at)}
                  </span>
                  {analysis.commit?.html_url && (
                    <>
                      <span className="text-text-muted">·</span>
                      <a
                        href={analysis.commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
                      >
                        <ExternalLink size={15} className="text-text-muted" /> View on GitHub
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* ── SECTION 2: Issues ── */}
              <section className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold">Issues Found</h2>
                  {jobStatus === 'done' &&
                    (staticIssues.length > 0 ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        {staticIssues.length}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-success">No issues</span>
                    ))}
                </div>

                {/* Analyzing → skeletons */}
                {isAnalyzing ? (
                  <>
                    <div className="space-y-3">
                      <div className="h-24 animate-pulse rounded-xl border border-border bg-bg-surface" />
                      <div className="h-24 animate-pulse rounded-xl border border-border bg-bg-surface" />
                    </div>
                    <p className="mt-2 text-sm text-text-muted">Analysis in progress...</p>
                  </>
                ) : jobStatus === 'failed' ? (
                  // Failed card
                  <div className="rounded-xl border border-danger/20 bg-danger/[0.08] p-5">
                    <div className="flex items-center gap-2 font-semibold text-danger">
                      <XCircle size={18} /> Analysis failed
                    </div>
                    {analysis.error_message && (
                      <p className="mt-2 font-mono text-sm text-text-muted">
                        {analysis.error_message}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={retrying}
                      onClick={handleRetry}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} /> Retry Analysis
                    </button>
                  </div>
                ) : staticIssues.length === 0 ? (
                  // Done + no issues
                  <div className="flex flex-col items-center rounded-xl border border-border bg-bg-surface p-8 text-center">
                    <CheckCircle2 size={32} className="text-success" />
                    <p className="mt-3 font-semibold text-text-primary">No issues detected</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      This commit passed all static analysis checks
                    </p>
                  </div>
                ) : (
                  // Done + issues
                  <div className="space-y-2">
                    {staticIssues.map((s, i) => (
                      <div
                        key={s.id || i}
                        className="rounded-xl border border-border bg-bg-surface p-4"
                        style={{ borderLeft: `3px solid ${severityHex(s.severity)}` }}
                      >
                        {/* Top row: severity + title */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          <RiskBadge level={s.severity} />
                          <h3 className="font-semibold text-text-primary">{s.title}</h3>
                        </div>
                        {/* Middle: description */}
                        {(s.description || s.problem) && (
                          <p className="mt-2 flex items-start gap-1.5 text-sm text-text-secondary">
                            <AlertTriangle
                              size={14}
                              className="mt-0.5 shrink-0"
                              style={{ color: severityHex(s.severity) }}
                            />
                            <span>{s.description || s.problem}</span>
                          </p>
                        )}
                        {/* Bottom: file path + line */}
                        {(s.file_path || s.file) && (
                          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-text-muted">
                            <FileCode size={12} />
                            {s.file_path || s.file}
                            {s.line_number != null || s.line != null
                              ? ` · line ${s.line_number ?? s.line}`
                              : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── SECTION 3: File changes (collapsible) ── */}
              {fileChanges.length > 0 && (
                <section className="mt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold">Files Changed</h2>
                    <span className="text-sm text-text-secondary">
                      {fileChanges.length} {fileChanges.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFilesOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
                  >
                    {filesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    {filesOpen ? 'Hide files' : `Show ${fileChanges.length} files changed`}
                  </button>

                  {filesOpen && (
                    <div className="mt-3 space-y-1">
                      {fileChanges.map((fc, i) => {
                        const badge = fileStatusBadge(fc.status)
                        return (
                          <div
                            key={`${fc.file_path}-${i}`}
                            className="rounded-lg border border-border bg-bg-surface-elevated p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                                <span className="truncate font-mono text-sm text-text-primary">
                                  {fc.file_path}
                                </span>
                              </div>
                              <span className="shrink-0 font-mono text-xs">
                                {fc.additions != null && (
                                  <span className="text-success">+{fc.additions}</span>
                                )}{' '}
                                {fc.deletions != null && (
                                  <span className="text-danger">-{fc.deletions}</span>
                                )}
                              </span>
                            </div>

                            {/* Diff block — sirf tab jab patch API me aaye (abhi nahi aata) */}
                            {fc.patch && (
                              <div className="relative mt-2 max-h-[200px] overflow-y-auto rounded-lg border border-border bg-bg-base p-3">
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard?.writeText(fc.patch)}
                                  className="absolute right-2 top-2 rounded border border-border px-2 py-0.5 text-xs text-text-secondary hover:text-primary"
                                >
                                  Copy diff
                                </button>
                                <pre className="font-mono text-xs leading-relaxed">
                                  {fc.patch.split('\n').map((line, li) => {
                                    const cls = line.startsWith('+')
                                      ? 'bg-success/[0.08] text-success'
                                      : line.startsWith('-')
                                        ? 'bg-danger/[0.08] text-danger'
                                        : 'text-text-muted'
                                    return (
                                      <div key={li} className={cls}>
                                        {line || ' '}
                                      </div>
                                    )
                                  })}
                                </pre>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* ── SECTION 4: Ask AI ── */}
              <section className="mt-6">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  <Sparkles size={18} className="text-accent-lime" /> Ask AI about this commit
                </h2>

                <div className="rounded-xl border border-border bg-bg-surface p-5">
                  <div className="min-h-[120px] space-y-4">
                    {/* AI response bubble (answer state) */}
                    {answer && (
                      <div className="flex flex-col items-start">
                        <span className="mb-1 flex items-center gap-1.5 text-xs text-text-muted">
                          <FoxLogo size={12} /> CommitIQ AI
                        </span>
                        <div className="max-w-[85%] rounded-xl rounded-bl-sm border border-border bg-bg-surface-elevated p-3.5 text-sm leading-relaxed text-text-primary">
                          {answer}
                        </div>
                      </div>
                    )}
                    {!answer && (
                      <p className="text-sm text-text-muted">
                        Summary will appear when analysis completes.
                      </p>
                    )}
                  </div>

                  {/* Input */}
                  <form onSubmit={handleAsk} className="mt-4 flex gap-2">
                    <input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask anything about this commit..."
                      disabled={asking}
                      className="flex-1 rounded-lg border border-border bg-bg-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={asking}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {asking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      {asking ? 'Thinking…' : 'Ask'}
                    </button>
                  </form>

                  {/* Suggested question pills — click pe input fill (existing setQuestion) */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuestion(q)}
                        className="rounded-full border border-border bg-bg-surface-elevated px-3 py-1 text-xs text-text-secondary transition-colors hover:border-primary hover:text-primary"
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  {askError && <p className="mt-2 text-sm text-danger">{askError}</p>}
                  <p className="mt-3 font-mono text-xs text-text-muted">
                    Ask uses RAG + Groq on this commit&apos;s indexed diff
                  </p>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default CommitDetail
