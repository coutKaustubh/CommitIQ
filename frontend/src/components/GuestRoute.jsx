import { Navigate } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth.js'

/**
 * Already logged in → dashboard (login page dubara mat dikhao).
 */
function GuestRoute({ children }) {
  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default GuestRoute
