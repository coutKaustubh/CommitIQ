// Time-based greeting — uses the user's local clock.
// Same slang variant all day; changes at midnight via date seed.

const SLOTS = [
  {
    // 12:00 AM – 12:59 AM
    start: 0,
    end: 60,
    options: [
      { emoji: '🌙', text: "It's midnight, cutie" },
      { emoji: '🦉', text: 'Still up? Midnight cutie' },
      { emoji: '💫', text: 'Clock struck twelve — hey cutie' },
    ],
  },
  {
    // 1:00 AM – 3:59 AM
    start: 60,
    end: 240,
    options: [
      { emoji: '😴', text: 'I think sleep is not primary' },
      { emoji: '🦉', text: 'Night owl mode: sleep optional' },
      { emoji: '☕', text: 'Sun did not rise yet, and still shipping? Respect' },
      { emoji: '🌃', text: 'Sleep can wait — code cannot' },
      { emoji: '🔥', text: 'Burning the midnight oil, huh?' },
    ],
  },
  {
    // 4:00 AM – 11:59 AM
    start: 240,
    end: 720,
    options: [
      { emoji: '☀️', text: 'Good morning' },
      { emoji: '🌅', text: 'Rise and shine' },
      { emoji: '☕', text: 'Morning — coffee first?' },
      { emoji: '🌞', text: 'Top of the morning' },
    ],
  },
  {
    // 12:00 PM – 3:59 PM
    start: 720,
    end: 960,
    options: [
      { emoji: '⚡', text: 'Good afternoon' },
      { emoji: '🌤️', text: 'Afternoon hustle' },
      { emoji: '💪', text: 'Good afternoon, champ' },
      { emoji: '📈', text: 'Afternoon — keep pushing' },
    ],
  },
  {
    // 4:00 PM – 8:59 PM
    start: 960,
    end: 1260,
    options: [
      { emoji: '🌆', text: 'Good evening' },
      { emoji: '🌇', text: 'Evening vibes' },
      { emoji: '🍵', text: 'Good evening — winding down?' },
      { emoji: '✨', text: 'Golden hour, good evening' },
    ],
  },
  {
    // 9:00 PM – 10:59 PM
    start: 1260,
    end: 1380,
    options: [
      { emoji: '🍽️', text: 'Have dinner, buddy' },
      { emoji: '🥘', text: 'Dinner time, buddy' },
      { emoji: '🍜', text: 'Go eat something, buddy' },
      { emoji: '🫕', text: 'Plate check — dinner, buddy?' },
    ],
  },
  {
    // 11:00 PM – 11:59 PM
    start: 1380,
    end: 1440,
    options: [
      { emoji: '🥱', text: 'Feeling sleepy!! Have a coffee' },
      { emoji: '☕', text: 'Yawning? Coffee time' },
      { emoji: '😪', text: 'Sleepy already — grab a coffee' },
      { emoji: '🌙', text: 'Almost midnight — coffee buddy?' },
      { emoji: '💤', text: 'Eyes heavy? Coffee first' },
    ],
  },
]

function minutesSinceMidnight(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
}

function daySeed(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function pickDaily(options, date = new Date()) {
  const seed = daySeed(date)
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return options[Math.abs(hash) % options.length]
}

function slotForTime(date = new Date()) {
  const mins = minutesSinceMidnight(date)
  return SLOTS.find((slot) => mins >= slot.start && mins < slot.end) || SLOTS[0]
}

export function getGreeting(date = new Date()) {
  const slot = slotForTime(date)
  return pickDaily(slot.options, date)
}
