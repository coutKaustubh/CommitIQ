import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Supabase often redirects to Site URL with ?code= on "/" not "/auth/callback".
 * Forward query + hash to AuthCallback so we do not lose the code.
 */
function OAuthRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname === '/auth/callback') return

    const search = location.search || ''
    const hash = location.hash || ''
    const hasCode = search.includes('code=')
    const hasToken = hash.includes('access_token')

    if (hasCode || hasToken) {
      navigate(`/auth/callback${search}${hash}`, { replace: true })
    }
  }, [location.pathname, location.search, location.hash, navigate])

  return null
}

export default OAuthRedirect
