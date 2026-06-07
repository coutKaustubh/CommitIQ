import { getRisk } from '../utils/riskColor.js'

// Colored pill for a risk level: CRITICAL / WARNING / OK (and HIGH/MEDIUM/LOW aliases).
function RiskBadge({ level, showDot = true, className = '' }) {
  const risk = getRisk(level)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide ${risk.bg} ${risk.text} ${risk.border} ${className}`}
    >
      {showDot && <span className="text-[10px] leading-none">{risk.dot}</span>}
      {risk.label}
    </span>
  )
}

export default RiskBadge
