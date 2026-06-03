import { NavLink, useNavigate } from 'react-router-dom'
import { clearSession, isLoggedIn, logoutApi } from '../utils/auth.js'

function Layout({ children, userEmail }) {
  const navigate = useNavigate()

  async function handleLogout() {
    if (isLoggedIn()) {
      await logoutApi()
    }
    clearSession()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">CommitIQ</div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} end>
            Dashboard
          </NavLink>
          <span className="nav-link disabled" title="Week 2">
            Repositories
          </span>
          <span className="nav-link disabled" title="Week 5">
            Ask AI
          </span>
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-email">{userEmail || '…'}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  )
}

export default Layout
