import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, MessageSquare, Trash2 } from 'lucide-react'
import { api } from '../api/client.js'
import { askRepository } from '../api/rag.js'
import DashboardShell from '../components/DashboardShell.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import { SUGGESTED_QUESTIONS } from '../data/mock.js'
import { getDisplayName } from '../utils/displayName.js'

const CHAT_STORAGE_KEY = 'commitiq_ask_chats'
const REPO_STORAGE_KEY = 'commitiq_ask_repo_id'
const MAX_STORED_MESSAGES = 80

function loadAllChats() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function loadChatForRepo(repoId) {
  if (!repoId) return []
  const all = loadAllChats()
  const list = all[String(repoId)]
  return Array.isArray(list) ? list : []
}

function saveChatForRepo(repoId, messages) {
  if (!repoId) return
  const all = loadAllChats()
  all[String(repoId)] = messages.slice(-MAX_STORED_MESSAGES)
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(all))
}

function loadSavedRepoId() {
  return localStorage.getItem(REPO_STORAGE_KEY) || ''
}

function saveRepoId(repoId) {
  if (repoId) localStorage.setItem(REPO_STORAGE_KEY, String(repoId))
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-primary-light"
          style={{ animation: 'typing-bounce 1.2s infinite', animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}

function Bubble({ role, text, sources }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-none bg-primary text-white'
            : 'rounded-bl-none border border-border bg-surface text-content'
        }`}
      >
        {text}
        {!isUser && sources?.length > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Sources</p>
            <ul className="mt-1 space-y-1 text-xs text-secondary">
              {sources.map((s, i) => (
                <li key={`${s.commit_sha}-${s.file_path}-${i}`}>
                  <code className="text-primary-light">{s.commit_sha_short || s.commit_sha?.slice(0, 7)}</code>
                  {' · '}
                  {s.file_path || s.source_type}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function AskAI() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [repos, setRepos] = useState([])
  const [repoId, setRepoId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingRepos(true)
      setError('')
      try {
        const [me, reposData] = await Promise.all([
          api('/api/users/me/'),
          api('/api/repos/connected/'),
        ])
        if (cancelled) return
        setUserEmail(me.email || '')
        setDisplayName(getDisplayName(me))
        const list = reposData.connected || []
        setRepos(list)
        const savedRepoId = loadSavedRepoId()
        const initialRepo =
          list.find((r) => String(r.id) === savedRepoId) || list[0] || null
        if (initialRepo) {
          const id = String(initialRepo.id)
          setRepoId(id)
          setMessages(loadChatForRepo(id))
        }
        setHydrated(true)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load repositories')
      } finally {
        if (!cancelled) setLoadingRepos(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !repoId) return
    saveRepoId(repoId)
  }, [repoId, hydrated])

  useEffect(() => {
    if (!hydrated || !repoId) return
    saveChatForRepo(repoId, messages)
  }, [messages, repoId, hydrated])

  function handleRepoChange(nextRepoId) {
    setRepoId(nextRepoId)
    setMessages(loadChatForRepo(nextRepoId))
    setInput('')
    setError('')
  }

  function clearChat() {
    setMessages([])
    if (repoId) saveChatForRepo(repoId, [])
  }

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || typing) return
    if (!repoId) {
      setError('Connect a repository first to ask questions about your commits.')
      return
    }

    setError('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setTyping(true)

    try {
      const res = await askRepository(Number(repoId), q)
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          text: res.answer || 'No answer returned.',
          sources: res.sources || [],
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          text: err.message || 'Something went wrong. Check GROQ_API_KEY and try again.',
          sources: [],
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  const selectedRepo = repos.find((r) => String(r.id) === String(repoId))

  return (
    <DashboardShell userEmail={userEmail} displayName={displayName}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary-light">Ask AI</p>
          <h1 className="mt-1 font-display text-2xl font-bold">RAG over your commits</h1>
        </div>
        <label className="flex min-w-[220px] flex-col gap-1 text-sm">
          <span className="text-secondary">Repository</span>
          <select
            value={repoId}
            onChange={(e) => handleRepoChange(e.target.value)}
            disabled={loadingRepos || repos.length === 0}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-content outline-none focus:border-primary"
          >
            {repos.length === 0 ? (
              <option value="">No connected repos</option>
            ) : (
              repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid h-[calc(100vh-14rem)] gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="hidden flex-col rounded-xl border border-border bg-surface p-4 lg:flex">
          <button
            type="button"
            onClick={clearChat}
            disabled={messages.length === 0 || typing}
            className="mb-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-hover hover:text-content disabled:opacity-50"
          >
            <Trash2 size={15} /> New chat
          </button>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Tips</p>
          <div className="space-y-2 text-sm text-secondary">
            <p>Questions use indexed diffs + analysis findings from pushed commits.</p>
            <p>Push code and wait for analysis to finish before asking.</p>
            {selectedRepo && (
              <p className="font-mono text-xs text-primary-light">Indexing: {selectedRepo.full_name}</p>
            )}
          </div>
          <p className="mb-2 mt-6 font-mono text-xs uppercase tracking-widest text-muted">Suggested</p>
          <div className="space-y-1">
            {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={typing || !repoId}
                className="flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm text-secondary hover:bg-surface-hover hover:text-content disabled:opacity-50"
              >
                <MessageSquare size={14} className="shrink-0" /> {q}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-col rounded-xl border border-border bg-bg">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !typing && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FoxLogo size={56} className="animate-float" />
                <h2 className="mt-4 font-display text-xl font-bold">Ask AI about your codebase</h2>
                <p className="mt-1 max-w-sm text-sm text-secondary">
                  Retrieves similar commit diffs and findings, then answers with Groq.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      disabled={typing || !repoId}
                      className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-secondary transition-colors hover:border-primary/50 hover:text-content disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} sources={m.sources} />
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-none border border-border bg-surface px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex gap-2 border-t border-border p-4"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                repoId ? 'Ask anything about your indexed commits…' : 'Connect a repo first…'
              }
              disabled={!repoId || typing}
              className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-content outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={typing || !repoId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Send size={15} /> Send
            </button>
          </form>
        </section>
      </div>
      <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-muted">
        <Sparkles size={12} /> Chat saved in this browser per repo · refresh safe
      </p>
    </DashboardShell>
  )
}

export default AskAI
