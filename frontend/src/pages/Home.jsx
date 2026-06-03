import { Link } from 'react-router-dom'
import { clearSession, isLoggedIn } from '../utils/auth.js'

function Home() {
  const loggedIn = isLoggedIn()

  function handleLogout() {
    clearSession()
    window.location.reload()
  }

  return (
    <div className="page">
      <header className="header">
        <h1>CommitIQ</h1>
        <p className="tagline">Regression intelligence for your commits</p>
      </header>

      <main className="card">
        <h2>Frontend is running</h2>
        {loggedIn ? (
          <>
            <p className="success">You are logged in. Token saved in localStorage.</p>
            <p className="hint">Phase 3: protected dashboard + /me call.</p>
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              Log out (clear token)
            </button>
          </>
        ) : (
          <>
            <p>Sign in to connect your repos and see analysis.</p>
            <div className="btn-row">
              <Link className="btn btn-primary" to="/login">
                Login
              </Link>
              <Link className="btn btn-secondary" to="/signup">
                Sign up
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default Home
