// Time-based greeting used on landing pill and dashboard header.
export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { emoji: '☀️', text: 'Good morning' }
  if (hour < 17) return { emoji: '⚡', text: 'Good afternoon' }
  if (hour < 21) return { emoji: '🌙', text: 'Good evening' }
  return { emoji: '🌃', text: 'Good night' }
}
