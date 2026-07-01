import { getRisk } from '../utils/riskColor.js'

// Colored pill for a risk level: CRITICAL / WARNING / OK (and HIGH/MEDIUM/LOW aliases).
function RiskBadge({ level, showDot = true, className = '' }) {
  const risk = getRisk(level)
  // CRITICAL pe subtle pulsing ring (badge-critical class index.css me hai)
  const isCritical = String(level || '').toUpperCase() === 'CRITICAL'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide ${risk.bg} ${risk.text} ${risk.border} ${isCritical ? 'badge-critical' : ''} ${className}`}
    >
      {showDot && <span className="text-[10px] leading-none">{risk.dot}</span>}
      {risk.label}
    </span>
  )
}

export default RiskBadge
