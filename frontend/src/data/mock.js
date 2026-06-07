// Mock data for analysis features the backend does not serve yet.
// Replace these with real API calls when the analysis pipeline lands.

export const MOCK_ANALYSIS_FEED = [
  {
    id: 'a1',
    sha: '4f9ab6b',
    message: 'feat(checkout): batch cart product lookup',
    author: 'kaustubh',
    risk: 'CRITICAL',
    topIssue: 'N+1 query in checkout/views.py line 47',
    at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    id: 'a2',
    sha: 'b887a3b',
    message: 'fix(auth): handle token refresh edge case',
    author: 'kaustubh',
    risk: 'OK',
    topIssue: 'No regression in auth/middleware.py',
    at: new Date(Date.now() - 5 * 3600_000).toISOString(),
  },
  {
    id: 'a3',
    sha: '7e2010a',
    message: 'refactor(api): extract contribution parser',
    author: 'contrib-bot',
    risk: 'WARNING',
    topIssue: 'High cyclomatic complexity (18) in parser.py',
    at: new Date(Date.now() - 26 * 3600_000).toISOString(),
  },
  {
    id: 'a4',
    sha: '3e1a18b',
    message: 'chore(deps): bump django to 6.0.5',
    author: 'kaustubh',
    risk: 'OK',
    topIssue: 'No performance impact detected',
    at: new Date(Date.now() - 2 * 86400_000).toISOString(),
  },
]

// API latency (ms) across the last commits — spike marks a regression.
export const MOCK_PERF_SERIES = [
  { commit: 'a1c2', ms: 120 },
  { commit: 'b3d4', ms: 118 },
  { commit: 'e5f6', ms: 132 },
  { commit: 'g7h8', ms: 125 },
  { commit: 'i9j0', ms: 140 },
  { commit: 'k1l2', ms: 138 },
  { commit: 'm3n4', ms: 150 },
  { commit: 'o5p6', ms: 145 },
  { commit: 'q7r8', ms: 162 },
  { commit: 's9t0', ms: 158 },
  { commit: 'u1v2', ms: 470, regression: true },
  { commit: 'w3x4', ms: 180 },
  { commit: 'y5z6', ms: 172 },
]

export const MOCK_COMMIT_DETAIL = {
  sha: '4f9ab6b',
  message: 'feat(checkout): batch cart product lookup',
  author: 'kaustubh',
  at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  risk: 'CRITICAL',
  static: [
    {
      title: 'N+1 Query Detected',
      file: 'checkout/views.py',
      line: 47,
      severity: 'CRITICAL',
      problem: `for item in cart_items:
    product = Product.objects.get(id=item.id)
    total += product.price * item.qty`,
      fix: `product_ids = [item.id for item in cart_items]
products = Product.objects.filter(
    id__in=product_ids
).prefetch_related('variants')`,
    },
  ],
  apm: {
    connected: false,
    delta: '+340ms',
    note: 'Latency increased 340ms after this commit',
  },
  ai: {
    question: 'Why did this commit cause a regression?',
    answer:
      'This commit introduced an N+1 query pattern in the checkout flow. For each item in the cart, a separate database query fetches the product, so a 30-item cart fires 31 queries. Under load this multiplied DB round-trips and pushed p95 latency from ~160ms to ~470ms. Batching the lookup with a single filter(id__in=...) call collapses it to one query.',
  },
}

export const SUGGESTED_QUESTIONS = [
  'Which part of my codebase is most fragile?',
  'What was my worst commit this week?',
  'How can I improve my /checkout endpoint?',
]
