import { Link, Navigate } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth.js'

function Home() {
  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="page">
      <header className="header">
        <h1>CommitIQ</h1>
        <p className="tagline">Regression intelligence for your commits</p>
      </header>

      <main className="card">
        <h2>Get started</h2>
        <p>Sign in to connect your repos and see analysis.</p>
        <div className="btn-row">
          <Link className="btn btn-primary" to="/login">
            Login
          </Link>
          <Link className="btn btn-secondary" to="/signup">
            Sign up
          </Link>
        </div>
      </main>
    </div>
  )
}

export default Home
