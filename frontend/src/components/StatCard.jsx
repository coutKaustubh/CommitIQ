import { TrendingUp, TrendingDown } from 'lucide-react'

// Big bold metric card used on landing + dashboard.
// value can be a string ("10ms", "∞") or number.
function StatCard({ label, value, subtitle, trend, accent = false }) {
  return (
    <div className="group rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-surface-hover">
      <span className="block font-mono text-xs uppercase tracking-widest text-secondary">
        {label}
      </span>
      <div className="mt-2 flex items-end gap-2">
        <span
          className={`font-display text-3xl font-bold leading-none md:text-4xl ${
            accent ? 'text-primary-light' : 'text-content'
          }`}
        >
          {value}
        </span>
        {trend === 'up' && <TrendingUp size={18} className="mb-1 text-success" />}
        {trend === 'down' && <TrendingDown size={18} className="mb-1 text-danger" />}
      </div>
      {subtitle && <p className="mt-2 text-sm text-secondary">{subtitle}</p>}
    </div>
  )
}

export default StatCard
