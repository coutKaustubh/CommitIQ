import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  GitBranch,
  GitCommit,
  Sparkles,
  ExternalLink,
  ArrowRight,
  MessageSquare,
  ShieldAlert,
  ScanSearch,
} from 'lucide-react'
import FoxLogo from '../components/FoxLogo.jsx'
import GitHubIcon from '../components/GitHubIcon.jsx'
import StatCard from '../components/StatCard.jsx'
import FoxScene from '../components/landing/FoxScene.jsx'
import RevealOnScroll from '../components/landing/RevealOnScroll.jsx'
import CommitDetailMockup from '../components/landing/CommitDetailMockup.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { isLoggedIn } from '../utils/auth.js'

const GITHUB_REPO = 'https://github.com/coutKaustubh/CommitIQ'

// Hero ke andar feature preview cards — chhoti horizontal row, above the fold
const FLOATING_CARDS = [
  {
    icon: ShieldAlert,
    accent: 'text-danger',
    body: 'N+1 Query — checkout/views.py',
  },
  {
    icon: ScanSearch,
    accent: 'text-warning',
    body: 'Risk: CRITICAL — 3 issues found',
  },
  {
    icon: MessageSquare,
    accent: 'text-violet',
    body: 'Ask AI: Why did this commit slow down?',
  },
]

// Stats — README ke actual claims pe based (fake metrics nahi)
const STATS = [
  { label: 'Average analysis time', value: '< 30s', accent: true },
  { label: 'Static analysis rule categories', value: '3' },
  { label: 'AI answers grounded in your actual code', value: 'RAG', accent: true },
  { label: 'Open source, self-hostable', value: '100%' },
]

const STEPS = [
  {
    icon: GitBranch,
    title: 'Connect your GitHub repo',
    desc: 'One-click OAuth. We register a push webhook automatically — no manual setup.',
  },
  {
    icon: GitCommit,
    title: 'Push any commit',
    desc: 'Every push triggers background static analysis via Celery + Redis.',
  },
  {
    icon: Sparkles,
    title: 'Get instant analysis + AI explanations',
    desc: 'Risk badges, file diffs, and RAG-powered Ask AI — all tied to the same commit.',
  },
]

const CONNECTED_BULLETS = [
  'Catch N+1 queries, large diffs, and sensitive file changes — before they reach production.',
  'Ask AI anything about a commit and get an answer grounded in your actual code, not a generic guess.',
  'Static analysis, GitHub webhooks, and pgvector RAG — one pulse on every push.',
]

function Landing() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Logged-in user ko dashboard pe bhej do — existing behavior same
  if (isLoggedIn()) return <Navigate to="/dashboard" replace />

  // GitHub OAuth — logic bilkul touch nahi ki, sirf button restyle
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
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* ── 1. Navbar — sticky, blur backdrop ── */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg-base/75 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-10">
          <div className="flex items-center gap-2.5">
            <FoxLogo size={32} />
            <span className="font-display text-lg font-bold tracking-tight">CommitIQ</span>
          </div>

          {/* Center nav — placeholder anchor links */}
          <nav className="flex items-center gap-8 font-mono text-sm text-text-secondary">
            <a href="#features" className="transition-colors hover:text-text-primary">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-text-primary">
              How it works
            </a>
            <a href="#docs" className="transition-colors hover:text-text-primary">
              Docs
            </a>
          </nav>

          <button
            type="button"
            onClick={signInWithGitHub}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 disabled:opacity-60"
          >
            <GitHubIcon size={16} />
            {busy ? 'Redirecting…' : 'Sign in with GitHub'}
          </button>
        </div>
      </header>

      {/* ── 2. Hero — oversized headline + fox scene ── */}
      <section className="bg-grid relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-0 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-violet/8 blur-[100px]" />

        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1440px] grid-cols-2 items-center gap-16 px-10 pb-24 pt-28">
          {/* Left — headline + CTAs */}
          <div className="animate-fade-up">
            <h1 className="font-display text-[5.5rem] font-bold leading-[0.92] tracking-tight">
              <span className="block text-text-primary">Every commit</span>
              <span className="block text-text-primary">has a</span>
              <span className="block">
                <span className="pulse-word text-glow">PULSE.</span>
              </span>
            </h1>

            <p className="mt-8 max-w-lg text-lg leading-relaxed text-text-secondary">
              AI-powered regression detection on every commit. Know exactly which line slowed
              your app — before users do.
            </p>

            <div className="mt-12 flex items-center gap-4">
              <button
                type="button"
                onClick={signInWithGitHub}
                disabled={busy}
                className="inline-flex items-center gap-2.5 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-primary/45 disabled:opacity-60"
              >
                <GitHubIcon size={20} />
                {busy ? 'Redirecting…' : 'Sign in with GitHub'}
              </button>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3.5 text-base font-semibold text-text-primary transition-colors hover:border-primary/50 hover:bg-bg-surface"
              >
                View on GitHub
                <ExternalLink size={18} className="text-text-secondary" />
              </a>
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            {/* Feature preview cards — horizontal row, above the fold */}
            <div className="mt-12 flex flex-wrap gap-3">
              {FLOATING_CARDS.map((card) => {
                const Icon = card.icon
                return (
                  <div
                    key={card.body}
                    className="group flex items-center gap-2.5 rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-[3px] hover:border-primary"
                  >
                    <Icon size={15} className={`shrink-0 ${card.accent}`} />
                    <span className="whitespace-nowrap font-mono text-xs text-text-secondary transition-colors group-hover:text-text-primary">
                      {card.body}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right — fox illustration scene */}
          <div className="animate-float">
            <FoxScene />
          </div>
        </div>
      </section>

      {/* ── 4. Everything's connected section ── */}
      <RevealOnScroll>
        <section id="features" className="mx-auto max-w-[1440px] px-10 py-28">
          <div className="grid grid-cols-2 items-center gap-20">
            <div>
              <h2 className="font-display text-5xl font-bold leading-tight tracking-tight">
                <span className="block text-text-primary">Every signal.</span>
                <span className="block text-primary">One pulse.</span>
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-text-secondary">
                CommitIQ connects static analysis, GitHub webhooks, and RAG-powered AI
                explanations — all tied to the same commit. One push, one story, zero guesswork.
              </p>
              <ul className="mt-10 space-y-5">
                {CONNECTED_BULLETS.map((bullet) => (
                  <li key={bullet} className="bullet-accent text-base leading-relaxed text-text-secondary">
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
            <CommitDetailMockup />
          </div>
        </section>
      </RevealOnScroll>

      {/* ── 5. Stats — big bold numbers ── */}
      <RevealOnScroll>
        <section className="border-y border-border bg-bg-surface/40">
          <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-6 px-10 py-20">
            {STATS.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
            ))}
          </div>
        </section>
      </RevealOnScroll>

      {/* ── 6. How it works — horizontal 3-step flow ── */}
      <RevealOnScroll>
        <section id="how-it-works" className="mx-auto max-w-[1440px] px-10 py-28">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-bold">Three steps. Zero config.</h2>

          <div className="relative mt-16 grid grid-cols-3 gap-8">
            {/* Connector line — steps ke beech subtle gradient arrow feel */}
            <div className="step-connector absolute left-[18%] right-[18%] top-10 hidden h-px md:block" />

            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="relative text-center">
                  <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-bg-surface-elevated shadow-lg">
                    <Icon size={28} className="text-primary" />
                    {i < STEPS.length - 1 && (
                      <ArrowRight
                        size={20}
                        className="absolute -right-14 top-1/2 hidden -translate-y-1/2 text-text-muted md:block"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold">{step.title}</h3>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-text-secondary">
                    {step.desc}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-14 text-center">
            <button
              type="button"
              onClick={signInWithGitHub}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60"
            >
              Get started free <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </RevealOnScroll>

      {/* ── 7. Footer ── */}
      <footer id="docs" className="border-t border-border bg-bg-surface/30">
        <div className="mx-auto flex max-w-[1440px] items-start justify-between px-10 py-12">
          <div>
            <div className="flex items-center gap-2.5">
              <FoxLogo size={28} />
              <span className="font-display text-lg font-bold">CommitIQ</span>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              Every commit tells a story. We read it.
            </p>
          </div>
          <div className="flex items-center gap-8 font-mono text-sm text-text-secondary">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text-primary"
            >
              GitHub
            </a>
            <a
              href={`${GITHUB_REPO}#readme`}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text-primary"
            >
              Docs
            </a>
          </div>
        </div>
        <p className="border-t border-border py-5 text-center font-mono text-xs text-text-muted">
          Built by developers, for developers.
        </p>
      </footer>
    </div>
  )
}

export default Landing
