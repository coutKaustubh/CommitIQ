import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, GitBranch, Search, Settings, LogOut } from 'lucide-react'
import FoxLogo from '../FoxLogo.jsx'
import { clearSession, isLoggedIn, logoutApi } from '../../utils/auth.js'

// Sidebar nav links — icon + label. Ask AI ke liye Search icon (spec ke hisaab se).
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/repositories', label: 'Repositories', icon: GitBranch },
  { to: '/dashboard/ask', label: 'Ask AI', icon: Search },
]

/**
 * Fixed left sidebar — collapsed 56px, hover pe 200px expand hota hai.
 * Fixed position rakha hai taaki expand hone pe content shift na ho (overlay).
 */
function DashboardSidebar({ userEmail = '', displayName = '' }) {
  const navigate = useNavigate()
  const label = (displayName || (userEmail ? userEmail.split('@')[0] : '')).trim()
  const initial = (label || '?').charAt(0).toUpperCase()

  // Logout logic — TopNavbar wali hi, koi change nahi
  async function handleLogout() {
    if (isLoggedIn()) await logoutApi()
    await clearSession()
    navigate('/')
  }

  return (
    <aside className="group fixed left-0 top-0 z-40 flex h-screen w-14 flex-col overflow-hidden border-r border-border bg-bg-surface transition-[width] duration-300 ease-out hover:w-[200px]">
      {/* Logo — collapsed me sirf fox, expand pe wordmark */}
      <NavLink to="/dashboard" className="flex h-14 shrink-0 items-center gap-3 px-[15px]">
        <FoxLogo size={26} className="shrink-0" />
        <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          CommitIQ
        </span>
      </NavLink>

      {/* Primary nav */}
      <nav className="mt-2 flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors',
                  isActive
                    ? 'border-l-2 border-primary bg-bg-surface-elevated text-primary'
                    : 'border-l-2 border-transparent text-text-secondary hover:bg-bg-surface-elevated hover:text-text-primary',
                ].join(' ')
              }
            >
              <Icon size={20} className="shrink-0" />
              <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {item.label}
              </span>
            </NavLink>
          )
        })}

        {/* Settings — abhi placeholder, koi page nahi */}
        <button
          type="button"
          className="relative flex items-center gap-3 rounded-lg border-l-2 border-transparent px-2.5 py-2.5 text-text-secondary transition-colors hover:bg-bg-surface-elevated hover:text-text-primary"
          title="Settings (coming soon)"
        >
          <Settings size={20} className="shrink-0" />
          <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Settings
          </span>
        </button>
      </nav>

      {/* Bottom — avatar + sign out */}
      <div className="mt-auto flex flex-col gap-1 border-t border-border p-2">
        <div className="flex items-center gap-3 px-1.5 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet/25 font-mono text-sm font-bold text-violet">
            {initial}
          </span>
          <span className="max-w-[130px] truncate whitespace-nowrap text-sm text-text-secondary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {label || '…'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LogOut size={20} className="shrink-0" />
          <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Sign out
          </span>
        </button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
