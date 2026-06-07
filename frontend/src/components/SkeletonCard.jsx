// Pulsing skeleton placeholder — preferred over spinners for content cards.
function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>
      <div className="h-3 w-1/3 animate-pulse rounded bg-border" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-border"
            style={{ width: `${90 - i * 12}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export default SkeletonCard
