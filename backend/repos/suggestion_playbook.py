"""
Curated suggestion catalog for static analysis issues.

Detection lives in analysis_services.py (rules). This module maps stable
`query` keys to rich problem hints and fix suggestions — test-backed, no LLM.

Usage:
    query = resolve_n_plus_one_query(file_path, needle)
    meta = get_suggestion(query, file_path=file_path, context={...})
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Playbook entries — keyed by stable problem id (query string)
# ---------------------------------------------------------------------------

PLAYBOOK: dict[str, dict[str, str]] = {
    # --- N+1 queries ---
    "n_plus_one.django_objects_get": {
        "title": "Possible N+1 Query",
        "severity": "CRITICAL",
        "problem_hint": (
            "Loop body calls Model.objects.get() per iteration — "
            "one DB round-trip per row (classic Django N+1)."
        ),
        "suggestion": """# Before (N+1 — one query per loop iteration):
for item in cart_items:
    product = Product.objects.get(id=item.product_id)

# After (2 queries total — batch fetch, then map in memory):
product_ids = [item.product_id for item in cart_items]
products_by_id = {
    p.id: p for p in Product.objects.filter(id__in=product_ids)
}
for item in cart_items:
    product = products_by_id[item.product_id]

# Or use prefetch_related / select_related when traversing FKs.""",
    },
    "n_plus_one.sequelize_find_by_pk": {
        "title": "Possible N+1 Query",
        "severity": "CRITICAL",
        "problem_hint": (
            "Loop body calls findByPk (or similar) per iteration — "
            "Sequelize runs one query per row."
        ),
        "suggestion": """// Before (N+1):
for (const order of orders) {
  const user = await User.findByPk(order.userId);
}

// After — batch outside the loop:
const userIds = [...new Set(orders.map((o) => o.userId))];
const users = await User.findAll({ where: { id: userIds } });
const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
for (const order of orders) {
  const user = usersById[order.userId];
}""",
    },
    "n_plus_one.prisma_find_unique": {
        "title": "Possible N+1 Query",
        "severity": "CRITICAL",
        "problem_hint": (
            "Loop body calls findUnique / findFirst per iteration — "
            "Prisma issues one query per row."
        ),
        "suggestion": """// Before (N+1):
for (const order of orders) {
  const user = await prisma.user.findUnique({ where: { id: order.userId } });
}

// After — single findMany with IN filter:
const userIds = orders.map((o) => o.userId);
const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
const usersById = new Map(users.map((u) => [u.id, u]));
for (const order of orders) {
  const user = usersById.get(order.userId);
}""",
    },
    "n_plus_one.mongoose_find": {
        "title": "Possible N+1 Query",
        "severity": "CRITICAL",
        "problem_hint": (
            "Loop body calls findOne / findById per iteration — "
            "MongoDB driver runs one query per document."
        ),
        "suggestion": """// Before (N+1):
for (const id of orderIds) {
  const order = await Order.findById(id);
}

// After — single query with $in:
const orders = await Order.find({ _id: { $in: orderIds } });
const ordersById = Object.fromEntries(orders.map((o) => [String(o._id), o]));""",
    },
    "n_plus_one.generic": {
        "title": "Possible N+1 Query",
        "severity": "CRITICAL",
        "problem_hint": "Loop body appears to run a per-row database query.",
        "suggestion": """Move database lookups outside the loop:
1. Collect all IDs/keys in one pass over the collection.
2. Fetch all needed rows in one batch query (WHERE id IN (...)).
3. Build an in-memory map (id → row) and read from it inside the loop.

Avoid calling get/find/findOne/findById inside for/forEach/while bodies.""",
    },
    # --- Large diffs ---
    "large_change": {
        "title": "Large change set",
        "severity": "WARNING",
        "problem_hint": (
            "This file has high line churn ({total_lines} lines: +{additions}/-{deletions}). "
            "Large diffs are harder to review and raise regression risk."
        ),
        "suggestion": """Review strategy for large changes:
1. Split into smaller, focused commits when possible (aim for <200 lines per commit).
2. Add or extend tests specifically for the changed modules.
3. Request a second reviewer for business-critical paths.
4. Deploy to staging and smoke-test before production.""",
    },
    "large_change.frontend_bundle": {
        "title": "Large change set",
        "severity": "WARNING",
        "problem_hint": (
            "Large frontend change ({total_lines} lines) — UI regressions are easy to miss."
        ),
        "suggestion": """For large UI/component changes:
1. Split visual changes from logic changes across commits.
2. Run Storybook or component tests if available.
3. Check bundle size impact (npm run build) before merging.
4. Manual test critical user flows on mobile and desktop.""",
    },
    # --- Sensitive files ---
    "sensitive_file.env": {
        "title": "Sensitive file modified",
        "severity": "WARNING",
        "problem_hint": (
            "Environment file changed ({file_path}) — risk of committed secrets "
            "or wrong values in production."
        ),
        "suggestion": """Environment file checklist:
1. Never commit real API keys, passwords, or tokens — use placeholders in repo.
2. Keep secrets in .env locally and in your host's env vars (Render, Vercel, etc.).
3. Add .env to .gitignore; commit only .env.example with dummy values.
4. If a secret was committed: rotate it immediately and purge from git history.""",
    },
    "sensitive_file.django_settings": {
        "title": "Sensitive file modified",
        "severity": "WARNING",
        "problem_hint": (
            "Django settings module changed ({file_path}) — can affect security, "
            "DEBUG, ALLOWED_HOSTS, and database credentials."
        ),
        "suggestion": """Django settings safety:
1. Never set DEBUG=True in production settings.
2. Load SECRET_KEY and DATABASE_URL from environment variables.
3. Review ALLOWED_HOSTS and CSRF_TRUSTED_ORIGINS after changes.
4. Use separate settings modules (local vs production) if not already.""",
    },
    "sensitive_file.spring_prod_yml": {
        "title": "Sensitive file modified",
        "severity": "WARNING",
        "problem_hint": (
            "Spring production config changed ({file_path}) — JDBC URLs and "
            "credentials often live here."
        ),
        "suggestion": """Spring config safety:
1. Externalize passwords via SPRING_* env vars or a secrets manager.
2. Never commit application-prod.yml with real DB passwords.
3. Use Spring Cloud Config or sealed secrets for production.
4. Review datasource and JWT signing keys after this change.""",
    },
    "sensitive_file.dotnet_appsettings": {
        "title": "Sensitive file modified",
        "severity": "WARNING",
        "problem_hint": (
            ".NET appsettings production file changed ({file_path}) — "
            "connection strings and API keys are common here."
        ),
        "suggestion": """ASP.NET configuration safety:
1. Use User Secrets locally and Azure Key Vault / env vars in production.
2. Never commit appsettings.Production.json with real connection strings.
3. Prefer appsettings.json for structure; override secrets via environment.
4. Rotate any credential that may have been exposed in this commit.""",
    },
    "sensitive_file.secrets_or_keys": {
        "title": "Sensitive file modified",
        "severity": "WARNING",
        "problem_hint": (
            "Private key or secrets file changed ({file_path}) — "
            "high risk of credential exposure."
        ),
        "suggestion": """Key / certificate safety:
1. Private keys (.pem, .key, id_rsa) must never be in git — use .gitignore.
2. Store certs in your platform's secret store or CI masked variables.
3. If committed: revoke/rotate immediately and use git filter-repo to purge.
4. Prefer short-lived tokens over long-lived key files.""",
    },
    "sensitive_file.generic": {
        "title": "Sensitive file modified",
        "severity": "WARNING",
        "problem_hint": (
            "Changes touch a sensitive path ({file_path}). "
            "Double-check secrets and production config."
        ),
        "suggestion": """General secrets hygiene:
1. Ensure no credentials, tokens, or private keys are in the diff.
2. Use environment variables or a secrets manager for all sensitive values.
3. Run a secret scanner (gitleaks, trufflehog) before merging.
4. Rotate any secret that may have been exposed.""",
    },
}

# When exact query is missing, fall back to the generic entry for that rule family.
RULE_FALLBACKS: dict[str, str] = {
    "n_plus_one": "n_plus_one.generic",
    "large_change": "large_change",
    "sensitive_file": "sensitive_file.generic",
}

_FRONTEND_PATH_HINTS = re.compile(
    r"\.(jsx|tsx|vue|svelte|css|scss)$|/(components|pages|src)/",
    re.IGNORECASE,
)


def resolve_n_plus_one_query(file_path: str, needle: str | None) -> str:
    """Map detected ORM needle to a playbook query key."""
    if needle == "objects.get(":
        return "n_plus_one.django_objects_get"
    if needle == ".findByPk(":
        return "n_plus_one.sequelize_find_by_pk"
    if needle in (".findUnique(", ".findFirst("):
        return "n_plus_one.prisma_find_unique"
    if needle in (".findOne(", ".findById("):
        return "n_plus_one.mongoose_find"
    return "n_plus_one.generic"


def resolve_sensitive_query(file_path: str) -> str:
    """Map file path to the most specific sensitive-file playbook key."""
    lower = (file_path or "").lower().replace("\\", "/")
    basename = lower.rsplit("/", 1)[-1]

    if basename == ".env" or basename.startswith(".env.") or "/.env" in lower:
        return "sensitive_file.env"
    if basename in ("settings.py", "settings.local.py", "settings.production.py", "local_settings.py"):
        return "sensitive_file.django_settings"
    if "application-prod" in lower or "application-production" in lower:
        return "sensitive_file.spring_prod_yml"
    if "appsettings.production" in lower or "appsettings.secrets" in lower:
        return "sensitive_file.dotnet_appsettings"
    if any(
        lower.endswith(ext)
        for ext in (".pem", ".key", ".p12", ".pfx", ".jks", ".keystore")
    ) or basename in ("id_rsa", "id_ecdsa", "id_ed25519"):
        return "sensitive_file.secrets_or_keys"
    return "sensitive_file.generic"


def resolve_large_change_query(file_path: str) -> str:
    """Pick large-change variant based on path hints."""
    if _FRONTEND_PATH_HINTS.search(file_path or ""):
        return "large_change.frontend_bundle"
    return "large_change"


def _format_text(template: str, context: dict | None) -> str:
    """Safe-ish format: missing keys stay as {placeholder}."""
    if not context:
        return template
    try:
        return template.format(**context)
    except KeyError:
        return template


def get_suggestion(
    query: str,
    *,
    file_path: str = "",
    needle: str | None = None,
    context: dict | None = None,
) -> dict[str, str]:
    """
    Return playbook metadata for a detected problem.

    Args:
        query: Stable problem id, e.g. "n_plus_one.django_objects_get".
        file_path: Repo-relative path (for {file_path} in templates).
        needle: Optional ORM pattern that triggered detection (unused in lookup;
                kept for API symmetry and future template use).
        context: Optional dict for .format() on problem_hint / suggestion
                 (e.g. total_lines, additions, deletions).

    Returns:
        dict with keys: query, title, severity, problem_hint, suggestion
    """
    _ = needle  # reserved for future template placeholders

    ctx = {"file_path": file_path, **(context or {})}

    entry = PLAYBOOK.get(query)
    if entry is None:
        family = query.split(".", 1)[0]
        fallback_key = RULE_FALLBACKS.get(family, query)
        entry = PLAYBOOK.get(fallback_key, {})

    if not entry:
        return {
            "query": query,
            "title": "Analysis issue",
            "severity": "WARNING",
            "problem_hint": f"Issue detected in {file_path or 'unknown file'}.",
            "suggestion": "Review this change carefully before merging.",
        }

    return {
        "query": query,
        "title": entry.get("title", "Analysis issue"),
        "severity": entry.get("severity", "WARNING"),
        "problem_hint": _format_text(entry.get("problem_hint", ""), ctx),
        "suggestion": _format_text(entry.get("suggestion", ""), ctx),
    }


def summary_line_for_query(query: str) -> str:
    """Short label for build_ai_summary from playbook query."""
    entry = PLAYBOOK.get(query) or PLAYBOOK.get(
        RULE_FALLBACKS.get(query.split(".", 1)[0], ""),
        {},
    )
    return entry.get("title", query)
