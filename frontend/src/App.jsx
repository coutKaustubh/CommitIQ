import { Routes, Route, Navigate } from 'react-router-dom'
import OAuthRedirect from './components/OAuthRedirect.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import GuestRoute from './components/GuestRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Repositories from './pages/Repositories.jsx'
import CommitDetail from './pages/CommitDetail.jsx'
import AskAI from './pages/AskAI.jsx'
import AuthCallback from './pages/AuthCallback.jsx'

function App() {
  return (
    <>
      <OAuthRedirect />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/repositories"
          element={
            <ProtectedRoute>
              <Repositories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/commits/:id"
          element={
            <ProtectedRoute>
              <CommitDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/ask"
          element={
            <ProtectedRoute>
              <AskAI />
            </ProtectedRoute>
          }
        />
        {/* Legacy path redirect */}
        <Route path="/repositories" element={<Navigate to="/dashboard/repositories" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
