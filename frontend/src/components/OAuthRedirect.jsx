import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Supabase often redirects to Site URL with ?code= on "/" not "/auth/callback".
 * Forward query + hash to AuthCallback so we do not lose the code.
 */
function OAuthRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  //: Login ke baad Supabase kabhi user ko galat page pe bhej deta hai
  //  (jaise / ya /login) lekin URL mein secret code/token chipka hota hai.
  //  Yeh block woh pakad ke sahi jagah /auth/callback pe bhej deta hai taaki 
  // login complete ho sake.
  useEffect(() => {
    if (location.pathname === '/auth/callback') return
    //Agar pehle se /auth/callback pe ho → kuch mat karo, loop avoid.

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
