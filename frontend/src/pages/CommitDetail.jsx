import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileCode, Sparkles, BarChart3, Send, RefreshCw } from 'lucide-react'
import DashboardShell from '../components/DashboardShell.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import { timeAgo } from '../utils/time.js'
import { fetchCommitAnalysis, fetchAnalysisJob, retryAnalysis } from '../api/analysis.js'

function CodeBlock({ title, code, tone }) {
  const toneClass =
    tone === 'bad' ? 'border-danger/30' : tone === 'good' ? 'border-success/30' : 'border-border'
  return (
    <div className={`overflow-hidden rounded-lg border ${toneClass} bg-bg`}>
      <div className="border-b border-border px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-secondary">
        {title}
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-content">
        {(code || '—').split('\n').map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-3 w-5 shrink-0 select-none text-right text-muted">{i + 1}</span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}

function CommitDetail() {
  const { id: shaParam } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [question, setQuestion] = useState('Why does this commit matter?')
  const [answer, setAnswer] = useState('')

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
          setQuestion(data.ai?.question || 'Why does this commit matter?')
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

  function ask(e) {
    e.preventDefault()
    setAnswer(analysis?.ai?.answer || 'Analysis summary not available yet.')
  }

  const isAnalyzing = analysis && ['pending', 'running'].includes(analysis.status)
  const staticIssues = analysis?.static || analysis?.issues || []
  const displaySha = analysis?.short_sha || shaParam

  return (
    <DashboardShell userEmail="">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-content"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      {loading && (
        <p className="mt-6 text-sm text-secondary">Loading commit analysis…</p>
      )}

      {error && !analysis && (
        <div className="mt-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {analysis && (
        <>
          <div className="mt-4 rounded-xl border border-border bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-bg px-2 py-1 font-mono text-sm text-primary-light">
                    {displaySha}
                  </code>
                  <span className="font-mono text-xs text-muted">{timeAgo(analysis.at)}</span>
                  {isAnalyzing && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary-light">
                      Analyzing… ({analysis.status})
                    </span>
                  )}
                </div>
                <h1 className="mt-3 font-display text-2xl font-bold">{analysis.message}</h1>
                <p className="mt-1 text-sm text-secondary">by {analysis.author}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs uppercase tracking-widest text-secondary">
                  Risk score
                </span>
                <div className="mt-1.5">
                  <RiskBadge level={analysis.risk || 'OK'} className="text-sm" />
                </div>
                {analysis.status === 'failed' && (
                  <button
                    type="button"
                    disabled={retrying}
                    onClick={handleRetry}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-content hover:bg-surface-hover"
                  >
                    <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
                    Retry analysis
                  </button>
                )}
              </div>
            </div>
            {analysis.error_message && (
              <p className="mt-4 text-sm text-danger">{analysis.error_message}</p>
            )}
          </div>

          <section className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
              <FileCode size={18} className="text-primary-light" /> Static Analysis
            </h2>
            {isAnalyzing ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-sm text-secondary">
                Celery worker is fetching the GitHub diff and running rules…
              </div>
            ) : staticIssues.length === 0 ? (
              <div className="rounded-xl border border-success/30 bg-surface p-6 text-sm text-content">
                No issues found by rule-based static analysis.
              </div>
            ) : (
              staticIssues.map((s, i) => (
                <div
                  key={s.id || i}
                  className="mb-4 rounded-xl border border-danger/30 bg-surface p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-semibold text-content">
                      {s.severity === 'CRITICAL' ? '🔴' : '🟡'} {s.title}
                    </h3>
                    <RiskBadge level={s.severity} />
                  </div>
                  <p className="mt-2 font-mono text-xs text-secondary">
                    File: <span className="text-content">{s.file || s.file_path}</span>
                    {s.line != null ? (
                      <>
                        {' '}
                        · Line: <span className="text-content">{s.line}</span>
                      </>
                    ) : null}
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <CodeBlock title="Problem" code={s.problem || s.description} tone="bad" />
                    <CodeBlock title="Suggested fix" code={s.fix || s.suggestion} tone="good" />
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
              <BarChart3 size={18} className="text-primary-light" /> APM Correlation
            </h2>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-secondary">
                  Connect Datadog or New Relic to correlate this deploy with latency.
                </p>
                <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 font-mono text-xs text-warning">
                  Coming soon
                </span>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
              <Sparkles size={18} className="text-primary-light" /> AI Explanation
            </h2>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="rounded-lg rounded-tl-none border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm leading-relaxed text-content">
                  {answer || 'Summary will appear when analysis completes.'}
                </p>
              </div>
              <form onSubmit={ask} className="mt-4 flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about this commit…"
                  className="flex-1 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-content outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  <Send size={15} /> Ask
                </button>
              </form>
              <p className="mt-2 font-mono text-xs text-muted">
                Rule-based summary for now — LLM integration can replace build_ai_summary() later.
              </p>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  )
}

export default CommitDetail
