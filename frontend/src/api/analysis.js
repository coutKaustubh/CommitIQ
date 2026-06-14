/**
 * Analysis API helpers — talk to Django Celery pipeline results.
 *
 * Uses the shared `api()` client (fetch + Supabase JWT from localStorage).
 * Endpoints map to backend/repos/analysis_views.py + urls.py.
 */

import { api } from './client.js'

/** Dashboard feed: recent commits with risk badges and top issue text. */
export function fetchRecentAnalysis() {
  return api('/api/repos/commits/recent-analysis/')
}

/**
 * Full commit analysis page (job + issues + file changes + AI summary).
 * @param {string} sha — full or short commit SHA from the URL
 */
export function fetchCommitAnalysis(sha) {
  return api(`/api/repos/commits/${encodeURIComponent(sha)}/analysis/`)
}

/**
 * Poll job status while Celery worker runs (pending → running → done).
 * @param {number} jobId — AnalysisJob.id from PostgreSQL
 */
export function fetchAnalysisJob(jobId) {
  return api(`/api/repos/analysis/jobs/${jobId}/`)
}

/**
 * Re-queue a failed analysis (Retry button on CommitDetail).
 * @param {{ job_id?: number, commit_id?: number }} payload
 */
export function retryAnalysis(payload) {
  return api('/api/repos/analysis/retry/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
