import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../api/client.js'
import { askRepository } from '../api/rag.js'
import ChatBubble, { TypingDots } from '../components/ask/ChatBubble.jsx'
import DashboardShell from '../components/DashboardShell.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import { SUGGESTED_QUESTIONS } from '../data/mock.js'
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

export default function AskRepoChat() {
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

  return (
    <DashboardShell userEmail={userEmail} displayName={displayName}>
      <div className="mb-4">
        <Link
          to="/dashboard/ask"
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-content"
        >
          <ArrowLeft size={15} /> All repositories
        </Link>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-primary-light">Ask AI</p>
        <h1 className="mt-1 truncate font-display text-2xl font-bold">
          {repo?.full_name || '…'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid h-[calc(100vh-15rem)] gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="flex max-h-48 flex-col rounded-xl border border-border bg-surface lg:max-h-none">
          <div className="border-b border-border p-3">
            <button
              type="button"
              onClick={startNewChat}
              disabled={typing}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50"
            >
              <Plus size={15} /> New chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {chatList.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted">No chats yet. Start typing below.</p>
            )}
            <ul className="space-y-0.5">
              {chatList.map((c) => {
                const active = chatId === c.id
                return (
                  <li key={c.id}>
                    <div
                      className={`group flex w-full items-center gap-1 rounded-lg transition-colors ${
                        active ? 'bg-primary/15' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openChat(c.id)}
                        className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm ${
                          active ? 'text-content' : 'text-secondary hover:text-content'
                        }`}
                      >
                        <MessageSquare size={14} className="shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1 truncate">{c.title}</span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {formatChatDate(c.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteChat(c.id)}
                        className="mr-1 shrink-0 rounded p-1 text-muted opacity-0 hover:text-danger group-hover:opacity-100"
                        aria-label="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="hidden border-t border-border p-3 lg:block">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Suggested</p>
            <div className="space-y-1">
              {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={typing || loading}
                  className="flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-xs text-secondary hover:bg-surface-hover hover:text-content disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-[320px] flex-col rounded-xl border border-border bg-bg">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {loading && (
              <p className="text-center text-sm text-secondary">Loading…</p>
            )}

            {!loading && messages.length === 0 && !typing && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FoxLogo size={52} className="animate-float" />
                <h2 className="mt-4 font-display text-lg font-bold">
                  {isDraft ? 'New chat' : 'Continue this chat'}
                </h2>
                <p className="mt-1 max-w-sm text-sm text-secondary">
                  Questions use indexed diffs and analysis from{' '}
                  <span className="font-mono text-primary-light">{repo?.full_name}</span> only.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      disabled={typing || loading}
                      className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-secondary transition-colors hover:border-primary/50 hover:text-content disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} text={m.text} sources={m.sources} />
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
              placeholder={`Ask about ${repo?.full_name || 'this repo'}…`}
              disabled={loading || typing}
              className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-content outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || typing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Send size={15} /> Send
            </button>
          </form>
        </section>
      </div>

      <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-muted">
        <Sparkles size={12} /> Chats saved in this browser · one repo per room
      </p>
    </DashboardShell>
  )
}
