export function TypingDots() {
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

export default function ChatBubble({ role, text, sources }) {
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
                  <code className="text-primary-light">
                    {s.commit_sha_short || s.commit_sha?.slice(0, 7)}
                  </code>
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
