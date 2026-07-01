import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, Link } from 'react-router-dom'
import { Plus, GitBranch, ArrowUp, ArrowLeft, Trash2 } from 'lucide-react'
import { api } from '../api/client.js'
import { askRepository } from '../api/rag.js'
import ChatBubble, { TypingDots } from '../components/ask/ChatBubble.jsx'
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import { getDisplayName } from '../utils/displayName.js'
import {
  chatTitleFromMessage,
  createEmptyChat,
  deleteChat,
  getChat,
  listChatsForRepo,
  migrateLegacyChats,
  saveChat,
} from '../utils/askChatStorage.js'

// Empty-state ke suggested questions (display-only strings, existing send() call karte hain)
const CHAT_SUGGESTIONS = [
  'What are the most common issues in this repo?',
  'Which commit had the highest risk score?',
  'Are there any N+1 queries in my codebase?',
  'What files get changed most often?',
]

function formatChatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Textarea auto-grow (max 120px) — UI-only helper
function autoGrow(el) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

export default function AskRepoChat() {
  // ⚠️ Neeche ka saara chat/localStorage/API logic AS-IS hai. Sirf JSX + input restyle.
  const { repoId, chatId } = useParams()
  const navigate = useNavigate()
  const endRef = useRef(null)

  const [repo, setRepo] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [chatList, setChatList] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const isDraft = !chatId

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    migrateLegacyChats()
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setNotFound(false)
      try {
        const [me, reposData] = await Promise.all([
          api('/api/users/me/'),
          api('/api/repos/connected/'),
        ])
        if (cancelled) return

        setUserEmail(me.email || '')
        setDisplayName(getDisplayName(me))

        const found = (reposData.connected || []).find((r) => String(r.id) === String(repoId))
        if (!found) {
          setNotFound(true)
          return
        }
        setRepo(found)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load repository')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [repoId])

  useEffect(() => {
    if (loading || notFound) return

    const sessions = listChatsForRepo(repoId)
    setChatList(sessions)

    if (chatId) {
      const existing = getChat(repoId, chatId)
      if (!existing) {
        navigate(`/dashboard/ask/${repoId}`, { replace: true })
        return
      }
      setActiveChat(existing)
      setMessages(existing.messages || [])
    } else {
      setActiveChat(null)
      setMessages([])
    }
    setHydrated(true)
  }, [repoId, chatId, loading, notFound, navigate])

  useEffect(() => {
    if (!hydrated || isDraft || !activeChat) return
    const updated = saveChat(repoId, { ...activeChat, messages })
    setActiveChat(updated)
    setChatList(listChatsForRepo(repoId))
  }, [messages, hydrated, isDraft, repoId, activeChat?.id])

  function refreshChatList() {
    setChatList(listChatsForRepo(repoId))
  }

  function startNewChat() {
    setInput('')
    setError('')
    navigate(`/dashboard/ask/${repoId}`)
  }

  function openChat(id) {
    setInput('')
    setError('')
    navigate(`/dashboard/ask/${repoId}/c/${id}`)
  }

  function handleDeleteChat(id) {
    deleteChat(repoId, id)
    refreshChatList()
    if (chatId === id) {
      const remaining = listChatsForRepo(repoId).filter((c) => c.id !== id)
      if (remaining.length > 0) {
        navigate(`/dashboard/ask/${repoId}/c/${remaining[0].id}`, { replace: true })
      } else {
        navigate(`/dashboard/ask/${repoId}`, { replace: true })
      }
    }
  }

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || typing || !repo) return

    setError('')
    const userMessage = { role: 'user', text: q }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setTyping(true)

    let chat = activeChat
    let newChatId = chatId

    if (isDraft) {
      chat = createEmptyChat()
      chat.title = chatTitleFromMessage(q)
      chat.messages = nextMessages
      chat = saveChat(repoId, chat)
      newChatId = chat.id
      setActiveChat(chat)
      refreshChatList()
      navigate(`/dashboard/ask/${repoId}/c/${newChatId}`, { replace: true })
    }

    try {
      const res = await askRepository(Number(repoId), q)
      const aiMessage = {
        role: 'ai',
        text: res.answer || 'No answer returned.',
        sources: res.sources || [],
      }
      setMessages((m) => {
        const updated = [...m, aiMessage]
        if (chat) {
          saveChat(repoId, { ...chat, messages: updated })
          refreshChatList()
        }
        return updated
      })
    } catch (err) {
      const aiMessage = {
        role: 'ai',
        text: err.message || 'Something went wrong. Check GROQ_API_KEY and try again.',
        sources: [],
      }
      setMessages((m) => {
        const updated = [...m, aiMessage]
        if (chat) {
          saveChat(repoId, { ...chat, messages: updated })
        }
        return updated
      })
    } finally {
      setTyping(false)
    }
  }

  if (notFound) {
    return <Navigate to="/dashboard/ask" replace />
  }

  const canSend = input.trim().length > 0

  return (
    <div className="h-screen bg-bg-base text-text-primary">
      {/* Shared app sidebar (Ask AI active) */}
      <DashboardSidebar userEmail={userEmail} displayName={displayName} />

      <div className="ml-14 flex h-screen">
        {/* ── LEFT: chat history sidebar (260px) ── */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-bg-surface p-4">
          <Link
            to="/dashboard/ask"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={13} /> All repositories
          </Link>

          <button
            type="button"
            onClick={startNewChat}
            disabled={typing}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus size={15} /> New Chat
          </button>
          <p className="mt-2 truncate font-mono text-xs text-text-muted">{repo?.full_name || '…'}</p>

          {/* Chat session list */}
          <div className="mt-4 flex-1 overflow-y-auto">
            {chatList.length === 0 ? (
              <p className="mt-4 text-center text-xs text-text-muted">No previous chats</p>
            ) : (
              <ul className="space-y-1">
                {chatList.map((c) => {
                  const active = chatId === c.id
                  return (
                    <li key={c.id}>
                      <div
                        className={`group flex items-center gap-1 rounded-lg border-l-2 transition-colors ${
                          active
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent hover:bg-bg-surface-elevated'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openChat(c.id)}
                          className={`flex min-w-0 flex-1 flex-col px-3 py-2 text-left ${
                            active ? 'text-text-primary' : 'text-text-secondary'
                          }`}
                        >
                          <span className="truncate text-sm">{c.title}</span>
                          <span className="text-[10px] text-text-muted">
                            {formatChatDate(c.updatedAt)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChat(c.id)}
                          className="mr-1 shrink-0 rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                          aria-label="Delete chat"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── RIGHT: chat area ── */}
        <section className="flex flex-1 flex-col">
          {/* Chat top bar */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
            <span className="flex items-center gap-2 font-semibold text-text-primary">
              <GitBranch size={16} className="text-violet" /> {repo?.full_name || '…'}
            </span>
            <span className="text-xs italic text-text-muted">Powered by Groq + pgvector</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                {error}
              </div>
            )}

            {loading && <p className="text-center text-sm text-text-secondary">Loading…</p>}

            {/* EMPTY STATE — fox + thought bubble + suggestions */}
            {!loading && messages.length === 0 && !typing && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="animate-float relative">
                  {/* Thought bubble — 3 circles above-right */}
                  <div className="absolute -right-7 -top-8 flex flex-col items-center gap-1">
                    <span className="h-3 w-3 rounded-full border border-border bg-bg-surface-elevated" />
                    <span className="h-2 w-2 rounded-full border border-border bg-bg-surface-elevated" />
                    <span className="h-1.5 w-1.5 rounded-full border border-border bg-bg-surface-elevated" />
                  </div>
                  <FoxLogo size={80} />
                </div>

                <h2 className="mt-6 font-display text-lg font-semibold text-text-primary">
                  Hi, I&apos;m CommitIQ AI
                </h2>
                <p className="mt-2 max-w-[360px] text-sm text-text-secondary">
                  Ask me anything about the code in this repository. I&apos;ll answer using your
                  actual commit diffs and analysis findings.
                </p>

                <p className="mt-6 text-xs text-text-muted">Try asking:</p>
                <div className="mt-2 flex max-w-[540px] flex-wrap justify-center gap-2">
                  {CHAT_SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      disabled={typing || loading}
                      className="rounded-full border border-border bg-bg-surface px-4 py-2 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages list */}
            {messages.length > 0 && (
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} text={m.text} sources={m.sources} />
                ))}

                {/* Typing indicator */}
                {typing && (
                  <div className="flex flex-col items-start">
                    <span className="mb-1 flex items-center gap-1.5 text-xs text-text-muted">
                      <FoxLogo size={16} /> CommitIQ AI
                    </span>
                    <div className="rounded-2xl rounded-bl-none border border-border bg-bg-surface px-4 py-3">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border bg-bg-base px-6 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
              className="flex items-end gap-3 rounded-2xl border border-border bg-bg-surface px-4 py-3"
            >
              <textarea
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  autoGrow(e.target)
                }}
                onKeyDown={(e) => {
                  // Enter → send, Shift+Enter → newline
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Ask about this repository..."
                disabled={loading || typing}
                className="max-h-[120px] flex-1 resize-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || typing || !canSend}
                className={`shrink-0 rounded-xl p-2 transition-colors ${
                  canSend ? 'bg-primary text-white hover:bg-primary/90' : 'bg-bg-surface-elevated text-text-muted'
                }`}
                aria-label="Send"
              >
                <ArrowUp size={16} />
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-text-muted">
              CommitIQ AI can make mistakes. Verify important information.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
