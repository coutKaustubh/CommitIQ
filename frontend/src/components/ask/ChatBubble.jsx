import FoxLogo from '../FoxLogo.jsx'

// AI text me ``` fenced code blocks ko alag se render karo
function renderContent(text) {
  const parts = String(text ?? '').split(/```/)
  return parts.map((part, i) => {
    // odd index = code block
    if (i % 2 === 1) {
      const body = part.replace(/^[a-zA-Z0-9_-]*\n/, '')
      return (
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-lg border border-border bg-bg-base p-3 font-mono text-xs leading-relaxed"
        >
          {body}
        </pre>
      )
    }
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part}
      </span>
    )
  })
}

// 429 / rate limit message ko special warning card ke roop me dikhate hain
const RATE_LIMIT_RE = /rate limit|too many requests/i

export function TypingDots() {
  // 3 dots staggered opacity pulse (typing-bounce keyframe index.css me hai)
  return (
    <span className="inline-flex gap-1">
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-text-muted"
          style={{ animation: 'typing-bounce 1.2s infinite', animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}

export default function ChatBubble({ role, text, sources }) {
  const isUser = role === 'user'

  // USER bubble — right aligned, ember tint
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[70%] rounded-2xl rounded-br-none border px-4 py-3 text-sm text-text-primary"
          style={{ background: 'rgba(255,106,61,0.12)', borderColor: 'rgba(255,106,61,0.25)' }}
        >
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      </div>
    )
  }

  // AI rate-limit → warning card (existing error text ko hi restyle karte hain)
  if (RATE_LIMIT_RE.test(text || '')) {
    return (
      <div className="flex justify-start">
        <div
          className="max-w-[80%] rounded-xl border p-4"
          style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.2)' }}
        >
          <p className="font-semibold text-warning">⚠ Rate limit reached</p>
          <p className="mt-1 text-sm text-text-secondary">
            You&apos;ve used your Ask AI quota. Limit resets in 1 hour.
          </p>
        </div>
      </div>
    )
  }

  // AI bubble — fox header upar, bubble neeche, sources pills
  return (
    <div className="flex flex-col items-start">
      <span className="mb-1 flex items-center gap-1.5 text-xs text-text-muted">
        <FoxLogo size={16} /> CommitIQ AI
      </span>
      <div className="max-w-[80%] rounded-2xl rounded-bl-none border border-border bg-bg-surface px-4 py-3 text-sm leading-relaxed text-text-primary">
        {renderContent(text)}
      </div>

      {sources?.length > 0 && (
        <div className="mt-2 max-w-[80%]">
          <p className="text-xs text-text-muted">Sources:</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sources.map((s, i) => (
              <span
                key={`${s.commit_sha}-${s.file_path}-${i}`}
                className="rounded-full border border-border bg-bg-surface-elevated px-2.5 py-1 font-mono text-xs text-text-muted"
              >
                {s.file_path || s.source_type} · commit{' '}
                {s.commit_sha_short || s.commit_sha?.slice(0, 7)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
