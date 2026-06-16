import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import FoxLogo from './FoxLogo.jsx'
import { clearSession, isLoggedIn, logoutApi } from '../utils/auth.js'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/repositories', label: 'Repositories' },
  { to: '/dashboard/ask', label: 'Ask AI' },
]

function navClass({ isActive }) {
  return [
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-surface-hover text-primary-light' : 'text-secondary hover:text-content',
  ].join(' ')
}

function TopNavbar({ userEmail, displayName }) {
  const navigate = useNavigate()
  const label = (displayName || (userEmail ? userEmail.split('@')[0] : '')).trim()
  const initial = (label || '?').charAt(0).toUpperCase()

  async function handleLogout() {
    if (isLoggedIn()) await logoutApi()
    await clearSession()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <FoxLogo size={28} />
            <span className="font-display text-lg font-bold tracking-tight">CommitIQ</span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-mono text-sm font-bold text-primary-light">
              {initial}
            </span>
            <span className="max-w-[160px] truncate text-sm text-secondary">{label || '…'}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-secondary transition-colors hover:border-danger/50 hover:text-danger"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopNavbar
