// Map a risk level to Tailwind classes + label. Single source of truth for RiskBadge.
const RISK = {
  CRITICAL: {
    label: 'CRITICAL',
    dot: '🔴',
    text: 'text-danger',
    border: 'border-danger/60',
    bg: 'bg-danger/10',
    hex: '#f85149',
  },
  HIGH: {
    label: 'HIGH',
    dot: '🔴',
    text: 'text-danger',
    border: 'border-danger/60',
    bg: 'bg-danger/10',
    hex: '#f85149',
  },
  WARNING: {
    label: 'WARNING',
    dot: '🟡',
    text: 'text-warning',
    border: 'border-warning/60',
    bg: 'bg-warning/10',
    hex: '#d29922',
  },
  MEDIUM: {
    label: 'MEDIUM',
    dot: '🟡',
    text: 'text-warning',
    border: 'border-warning/60',
    bg: 'bg-warning/10',
    hex: '#d29922',
  },
  OK: {
    label: 'OK',
    dot: '🟢',
    text: 'text-success',
    border: 'border-success/60',
    bg: 'bg-success/10',
    hex: '#3fb950',
  },
  LOW: {
    label: 'LOW',
    dot: '🟢',
    text: 'text-success',
    border: 'border-success/60',
    bg: 'bg-success/10',
    hex: '#3fb950',
  },
}

export function getRisk(level) {
  if (!level) return RISK.OK
  return RISK[String(level).toUpperCase()] || RISK.OK
}
