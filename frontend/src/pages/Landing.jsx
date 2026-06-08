import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Play,
  Search,
  BarChart3,
  Bot,
  Bell,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import FoxLogo from '../components/FoxLogo.jsx'
import GitHubIcon from '../components/GitHubIcon.jsx'
import StatCard from '../components/StatCard.jsx'
import PerformanceGraph from '../components/PerformanceGraph.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { isLoggedIn } from '../utils/auth.js'
import { getGreeting } from '../utils/greeting.js'
import { MOCK_PERF_SERIES } from '../data/mock.js'

const FEATURES = [
  {
    icon: Search,
    title: 'Static Analysis',
    desc: 'Detect N+1 queries, high complexity, and memory leaks on every commit — before they merge.',
  },
  {
    icon: BarChart3,
    title: 'APM Correlation',
    desc: 'Connect Datadog or New Relic. We correlate your deploys to latency spikes automatically.',
  },
  {
    icon: Bot,
    title: 'Ask AI',
    desc: 'Ask anything about your codebase. A RAG pipeline answers with full repository context.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    desc: 'Slack and email alerts the moment a commit degrades performance by more than 10%.',
  },
]

const STATS = [
  { label: 'Avg analysis time', value: '10ms', accent: true },
  { label: 'Most common bug', value: 'N+1' },
  { label: 'Commits analyzed', value: '∞' },
  { label: 'False positives', value: '0' },
]

const STEPS = [
  { n: '01', title: 'Connect your GitHub repo', desc: 'One click OAuth. We register a webhook for you.' },
  { n: '02', title: 'Push any commit', desc: 'Every push triggers an automatic analysis run.' },
  { n: '03', title: 'Get instant AI analysis', desc: 'Risk score, root cause, and a suggested fix in seconds.' },
]

function Landing() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const greeting = getGreeting()

  if (isLoggedIn()) return <Navigate to="/dashboard" replace />

  async function signInWithGitHub() {
    setError('')
    setBusy(true)
    try {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env')
        return
      }
      const redirectTo = `${window.location.origin}/auth/callback`
      const { data, error: sbError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          scopes: 'read:user repo admin:repo_hook',
        },
      })
      if (sbError) throw sbError
      if (data?.url) window.location.href = data.url
      else setError('Could not start GitHub login')
    } catch (err) {
      setError(err.message || 'GitHub login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-content">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <FoxLogo size={30} />
            <span className="font-display text-lg font-bold tracking-tight">CommitIQ</span>
          </div>
          <button
            type="button"
            onClick={signInWithGitHub}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
          >
            <GitHubIcon size={16} />
            {busy ? 'Redirecting…' : 'Sign in with GitHub'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-grid relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          {/* Left */}
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-secondary">
              {greeting.emoji} {greeting.text}, developer
            </span>
            <h1 className="mt-6 font-display text-6xl font-bold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              YOUR CODE
              <br />
              HAS A
              <br />
              <span className="text-primary text-glow">PULSE.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-secondary">
              AI-powered regression detection on every commit. Know exactly which line slowed your
              app — before users do.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={signInWithGitHub}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60"
              >
                <GitHubIcon size={18} />
                {busy ? 'Redirecting…' : 'Sign in with GitHub'}
              </button>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-semibold text-content transition-colors hover:border-primary/50 hover:bg-surface"
              >
                <Play size={16} />
                View Demo
              </Link>
            </div>
            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            <p className="mt-6 font-mono text-xs uppercase tracking-widest text-muted">
              Every commit tells a story. We read it.
            </p>
          </div>

          {/* Right — animated dashboard preview */}
          <div className="animate-float">
            <div className="glow-violet rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-secondary">
                  Latest analysis
                </span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-success">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> live
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-content">
                      N+1 Query detected in{' '}
                      <span className="font-mono text-danger">checkout/views.py</span>
                    </p>
                    <p className="font-mono text-xs text-secondary">commit 4f9ab6b · line 47</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-content">
                      No regression in{' '}
                      <span className="font-mono text-success">auth/middleware.py</span>
                    </p>
                    <p className="font-mono text-xs text-secondary">commit b887a3b · clean</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-bg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-widest text-secondary">
                    API latency / 30 commits
                  </span>
                  <span className="font-mono text-xs text-danger">+340ms spike</span>
                </div>
                <div className="mt-2">
                  <PerformanceGraph data={MOCK_PERF_SERIES} height={110} compact />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-light">Features</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold sm:text-4xl">
          A clearer picture of what every commit does to your app.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary-light transition-colors group-hover:bg-primary/25">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-secondary">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-surface/30">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-light">How it works</p>
        <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Three steps to a healthier codebase.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-border bg-surface p-6">
              <span className="font-display text-4xl font-bold text-primary/40">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-secondary">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <button
            type="button"
            onClick={signInWithGitHub}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60"
          >
            Get started free <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <FoxLogo size={26} />
              <span className="font-display text-base font-bold">CommitIQ</span>
            </div>
            <p className="mt-2 text-sm text-secondary">Every commit tells a story. We read it.</p>
          </div>
          <div className="flex items-center gap-6 font-mono text-sm text-secondary">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-content">
              GitHub
            </a>
            <a href="#" className="hover:text-content">Docs</a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-content">
              Twitter
            </a>
          </div>
        </div>
        <p className="border-t border-border py-4 text-center font-mono text-xs text-muted">
          Built by developers, for developers.
        </p>
      </footer>
    </div>
  )
}

export default Landing
