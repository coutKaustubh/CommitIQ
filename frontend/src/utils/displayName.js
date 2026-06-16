/** GitHub real name → GitHub username → email prefix → fallback. */
export function getDisplayName(user, fallback = 'developer') {
  if (!user) return fallback
  const name = (user.github_display_name || user.display_name || '').trim()
  if (name) return name
  const username = (user.github_username || '').trim()
  if (username) return username
  if (user.email) return user.email.split('@')[0]
  return fallback
}
