import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Plus, MessageSquare } from 'lucide-react'
import DashboardShell from '../components/DashboardShell.jsx'
import FoxLogo from '../components/FoxLogo.jsx'
import { SUGGESTED_QUESTIONS } from '../data/mock.js'

const MOCK_ANSWER = `Based on your last 30 commits, your **checkout** module is the most fragile area.

It has the highest churn and three of your last five regressions touched it:

\`\`\`python
# checkout/views.py — recurring N+1 pattern
for item in cart_items:
    product = Product.objects.get(id=item.id)
\`\`\`

Suggested next step: add a query-count assertion in tests for the checkout flow so regressions fail CI before they merge.`

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

function Bubble({ role, text }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-none bg-primary text-white'
            : 'rounded-bl-none border border-border bg-surface text-content'
        }`}
      >
        {text}
      </div>
    </div>
  )
}

function AskAI() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function send(text) {
    const q = (text ?? input).trim()
    if (!q || typing) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setTyping(true)
    window.setTimeout(() => {
      setTyping(false)
      setMessages((m) => [...m, { role: 'ai', text: MOCK_ANSWER }])
    }, 1400)
  }

  return (
    <DashboardShell userEmail="">
      <div className="grid h-[calc(100vh-9rem)] gap-5 lg:grid-cols-[260px_1fr]">
        {/* Sidebar — conversation history */}
        <aside className="hidden flex-col rounded-xl border border-border bg-surface p-4 lg:flex">
          <button className="mb-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            <Plus size={15} /> New chat
          </button>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">History</p>
          <div className="space-y-1 text-sm">
            {['Checkout regression', 'Worst commit this week', 'Auth latency review'].map((c) => (
              <button
                key={c}
                className="flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-secondary hover:bg-surface-hover hover:text-content"
              >
                <MessageSquare size={14} className="shrink-0" /> {c}
              </button>
            ))}
          </div>
        </aside>

        {/* Chat area */}
        <section className="flex flex-col rounded-xl border border-border bg-bg">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !typing && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FoxLogo size={56} className="animate-float" />
                <h2 className="mt-4 font-display text-xl font-bold">Ask AI about your codebase</h2>
                <p className="mt-1 max-w-sm text-sm text-secondary">
                  Full repository context. Ask about fragility, regressions, or any endpoint.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-secondary transition-colors hover:border-primary/50 hover:text-content"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} />
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

          {/* Input */}
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
              placeholder="Ask anything about your codebase…"
              className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-content outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={typing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Send size={15} /> Send
            </button>
          </form>
        </section>
      </div>
      <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-muted">
        <Sparkles size={12} /> Demo responses — the RAG pipeline connects in a later phase.
      </p>
    </DashboardShell>
  )
}

export default AskAI
