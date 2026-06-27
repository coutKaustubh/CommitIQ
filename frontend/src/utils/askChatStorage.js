const SESSIONS_KEY = 'commitiq_ask_sessions'
const LEGACY_KEY = 'commitiq_ask_chats'
const LEGACY_REPO_KEY = 'commitiq_ask_repo_id'
const MAX_MESSAGES = 80
const MAX_CHATS_PER_REPO = 50

function readSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeSessions(all) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(all))
}

export function createChatId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function chatTitleFromMessage(text) {
  const t = (text || '').trim()
  if (!t) return 'New chat'
  return t.length > 42 ? `${t.slice(0, 42)}…` : t
}

/** One-time migration from single-thread-per-repo storage. */
export function migrateLegacyChats() {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY)
    if (!legacyRaw) return

    const legacy = JSON.parse(legacyRaw)
    const all = readSessions()
    const now = new Date().toISOString()

    for (const [repoId, messages] of Object.entries(legacy)) {
      if (!Array.isArray(messages) || messages.length === 0) continue
      if (all[repoId] && Object.keys(all[repoId]).length > 0) continue

      const firstUser = messages.find((m) => m.role === 'user')
      const id = createChatId()
      all[repoId] = {
        [id]: {
          id,
          title: firstUser ? chatTitleFromMessage(firstUser.text) : 'Previous chat',
          messages: messages.slice(-MAX_MESSAGES),
          createdAt: now,
          updatedAt: now,
        },
      }
    }

    writeSessions(all)
    localStorage.removeItem(LEGACY_KEY)
    localStorage.removeItem(LEGACY_REPO_KEY)
  } catch {
    // ignore corrupt legacy data
  }
}

export function listChatsForRepo(repoId) {
  const all = readSessions()
  const bucket = all[String(repoId)] || {}
  return Object.values(bucket).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function getChat(repoId, chatId) {
  const all = readSessions()
  return all[String(repoId)]?.[chatId] || null
}

export function saveChat(repoId, chat) {
  const all = readSessions()
  const key = String(repoId)
  if (!all[key]) all[key] = {}

  const trimmed = {
    ...chat,
    messages: (chat.messages || []).slice(-MAX_MESSAGES),
    updatedAt: new Date().toISOString(),
  }
  all[key][chat.id] = trimmed

  const ids = Object.keys(all[key])
  if (ids.length > MAX_CHATS_PER_REPO) {
    const sorted = ids
      .map((id) => all[key][id])
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    const drop = sorted.slice(0, ids.length - MAX_CHATS_PER_REPO)
    drop.forEach((c) => delete all[key][c.id])
  }

  writeSessions(all)
  return trimmed
}

export function deleteChat(repoId, chatId) {
  const all = readSessions()
  const key = String(repoId)
  if (!all[key]?.[chatId]) return
  delete all[key][chatId]
  if (Object.keys(all[key]).length === 0) delete all[key]
  writeSessions(all)
}

export function createEmptyChat() {
  const now = new Date().toISOString()
  return {
    id: createChatId(),
    title: 'New chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}
