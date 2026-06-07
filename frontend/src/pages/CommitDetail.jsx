import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileCode, Sparkles, BarChart3, Send } from 'lucide-react'
import DashboardShell from '../components/DashboardShell.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import { timeAgo } from '../utils/time.js'
import { MOCK_COMMIT_DETAIL } from '../data/mock.js'

function CodeBlock({ title, code, tone }) {
  const toneClass =
    tone === 'bad' ? 'border-danger/30' : tone === 'good' ? 'border-success/30' : 'border-border'
  return (
    <div className={`overflow-hidden rounded-lg border ${toneClass} bg-bg`}>
      <div className="border-b border-border px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-secondary">
        {title}
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-content">
        {code.split('\n').map((line, i) => (
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
  const { id } = useParams()
  const d = MOCK_COMMIT_DETAIL
  const [question, setQuestion] = useState(d.ai.question)
  const [answer, setAnswer] = useState(d.ai.answer)

  function ask(e) {
    e.preventDefault()
    // Mock: echo a context-aware canned answer.
    setAnswer(d.ai.answer)
  }

  return (
    <DashboardShell userEmail="">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-content"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <code className="rounded bg-bg px-2 py-1 font-mono text-sm text-primary-light">
                {id || d.sha}
              </code>
              <span className="font-mono text-xs text-muted">{timeAgo(d.at)}</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold">{d.message}</h1>
            <p className="mt-1 text-sm text-secondary">by {d.author}</p>
          </div>
          <div className="text-right">
            <span className="font-mono text-xs uppercase tracking-widest text-secondary">
              Risk score
            </span>
            <div className="mt-1.5">
              <RiskBadge level={d.risk} className="text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Section 1 — Static Analysis */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <FileCode size={18} className="text-primary-light" /> Static Analysis
        </h2>
        {d.static.map((s, i) => (
          <div key={i} className="rounded-xl border border-danger/30 bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-semibold text-content">
                🔴 {s.title}
              </h3>
              <RiskBadge level={s.severity} />
            </div>
            <p className="mt-2 font-mono text-xs text-secondary">
              File: <span className="text-content">{s.file}</span> · Line:{' '}
              <span className="text-content">{s.line}</span>
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <CodeBlock title="Problem code" code={s.problem} tone="bad" />
              <CodeBlock title="Suggested fix" code={s.fix} tone="good" />
            </div>
          </div>
        ))}
      </section>

      {/* Section 2 — APM Correlation */}
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
          <div className="mt-4 rounded-lg border border-dashed border-border bg-bg p-4 text-center">
            <p className="font-display text-2xl font-bold text-danger">{d.apm.delta}</p>
            <p className="mt-1 text-sm text-secondary">{d.apm.note}</p>
          </div>
        </div>
      </section>

      {/* Section 3 — AI Explanation */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Sparkles size={18} className="text-primary-light" /> AI Explanation
        </h2>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="rounded-lg rounded-tl-none border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm leading-relaxed text-content">{answer}</p>
          </div>
          <form onSubmit={ask} className="mt-4 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask AI about this commit…"
              className="flex-1 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-content outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Send size={15} /> Ask
            </button>
          </form>
        </div>
      </section>
    </DashboardShell>
  )
}

export default CommitDetail
