import { api } from './client.js'

/** POST /api/repos/{repoId}/ask/ — RAG answer from indexed commit chunks. */
export function askRepository(repoId, question) {
  return api(`/api/repos/${repoId}/ask/`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

/** POST /api/repos/commits/{sha}/ask/ — RAG scoped to one commit (Commit Detail). */
export function askCommit(sha, question) {
  return api(`/api/repos/commits/${encodeURIComponent(sha)}/ask/`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}
