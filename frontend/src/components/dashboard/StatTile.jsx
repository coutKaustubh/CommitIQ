import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * Dashboard stat card — colored icon + bada number + label.
 * `color` ek Tailwind text class hai (e.g. 'text-primary') jo icon + number pe lagti hai.
 * Landing wale StatCard se alag isliye kyunki yaha colored icon chahiye.
 */
function StatTile({ icon: Icon, label, value, color = 'text-text-primary', trend, trendValue }) {
  return (
    <div className="group rounded-xl border border-border bg-bg-surface p-5 transition-colors duration-300 hover:border-primary">
      <div className="flex items-center justify-between">
        <Icon size={20} className={color} />
        {trend === 'up' && (
          <span className="inline-flex items-center gap-0.5 font-mono text-xs text-success">
            <TrendingUp size={13} /> {trendValue || ''}
          </span>
        )}
        {trend === 'down' && (
          <span className="inline-flex items-center gap-0.5 font-mono text-xs text-danger">
            <TrendingDown size={13} /> {trendValue || ''}
          </span>
        )}
      </div>
      <p className={`mt-4 font-display text-3xl font-bold leading-none ${color}`}>{value}</p>
      <p className="mt-2 text-sm text-text-secondary">{label}</p>
    </div>
  )
}

export default StatTile
