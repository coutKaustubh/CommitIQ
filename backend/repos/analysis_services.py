"""
Commit analysis business logic (no HTTP, no Celery).

Separated from tasks.py so you can:
  - unit test rules without a worker
  - call the same functions from management commands later

Flow: fetch GitHub diff → save FileChange rows → run rules → return issue dicts.
"""

import logging
import re

from .github_client import github_request
from .models import FileChange

logger = logging.getLogger(__name__)

# --- Sensitive file detection (stack-agnostic) ---
# WARNING when a commit touches env, secrets, keys, or framework production config.
# Substring rules are intentionally broad — this is advisory, not a secret scanner.

# Exact basename match (lowercase), any repo language.
SENSITIVE_FILENAMES = (
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.staging",
    ".env.test",
    "secrets.json",
    "secrets.yml",
    "secrets.yaml",
    "credentials.json",
    "credentials.xml",
    "service-account.json",
    "google-services.json",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "kubeconfig",
    "terraform.tfvars",
    "terraform.tfvars.json",
    ".npmrc",
    ".pypirc",
    ".netrc",
    "auth.json",
    "firebase-adminsdk.json",
)

# Framework / runtime config files (exact basename) — not generic "config.js".
SENSITIVE_CONFIG_FILENAMES = (
    # Python / Django
    "settings.py",
    "settings.local.py",
    "settings.prod.py",
    "settings.production.py",
    "local_settings.py",
    # Java / Spring
    "application.properties",
    "application.yml",
    "application.yaml",
    "application-prod.yml",
    "application-prod.yaml",
    "application-production.yml",
    "application-production.yaml",
    # .NET
    "appsettings.production.json",
    "appsettings.secrets.json",
    "web.config",
    # Ruby / Rails
    "database.yml",
    "storage.yml",
    "credentials.yml.enc",
    # PHP
    "wp-config.php",
    # Go (common secret-adjacent names)
    "config.prod.yaml",
    "config.production.yaml",
)

# Private key / cert extensions on the filename.
SENSITIVE_FILENAME_SUFFIXES = (
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    ".jks",
    ".keystore",
)

# Substrings anywhere in the normalized repo path.
SENSITIVE_PATH_MARKERS = (
    "/secrets/",
    "/.secrets/",
    "/credentials/",
    "/.credentials/",
    "/.aws/",
    "/.ssh/",
    "/private/",
    "/middleware/",  # auth middleware (Express, Django, etc.)
    "secrets.",
    "credentials.",
)

# Total line churn above this triggers a WARNING (large blast-radius change).
LARGE_CHANGE_LINE_THRESHOLD = 500

# Skip ALL rules for docs, assets, lockfiles, and generated output — any tech stack.
SKIP_ANALYSIS_EXTENSIONS = (
    ".md",
    ".txt",
    ".rst",
    ".adoc",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".webp",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".pdf",
    ".zip",
    ".map",
    ".lock",
)

SKIP_ANALYSIS_FILENAMES = (
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "pipfile.lock",
    "composer.lock",
    "gemfile.lock",
)

# Path segments that are never worth analyzing (build output, vendored deps).
SKIP_ANALYSIS_PATH_SEGMENTS = (
    "/node_modules/",
    "/dist/",
    "/build/",
    "/.git/",
    "/staticfiles/",
    "/__pycache__/",
)

# Strip quoted strings before pattern matching — avoids docstrings/tests false positives.
_STRING_LITERAL_RE = re.compile(r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')')

# Django ORM N+1: Model.objects.get( inside a loop body (actual code, not a string mention).
_PYTHON_ORM_GET_RE = re.compile(r"\.objects\.get\s*\(")

# Node ORM calls that often cause N+1 when awaited/called per iteration in a loop.
_JS_ORM_CALL_RES = (
    re.compile(r"\.findOne\s*\("),
    re.compile(r"\.findById\s*\("),
    re.compile(r"\.findByPk\s*\("),
    re.compile(r"\.findUnique\s*\("),
    re.compile(r"\.findFirst\s*\("),
)


def _normalize_repo_path(file_path):
    """Lowercase path with forward slashes — for cross-platform matching."""
    return (file_path or "").lower().replace("\\", "/")


def _is_sensitive_file(file_path):
    """
    True if the path likely touches secrets, env, keys, or production config.

    Works across Python, Node, Java, .NET, Rails, Go, etc. — path/name based only
    (no language parser). False positives are acceptable at WARNING severity.
    """
    lower = _normalize_repo_path(file_path)
    if not lower:
        return False

    basename = lower.rsplit("/", 1)[-1] # last part of the path for example /path/to/file.txt -> file.txt

    if basename in SENSITIVE_FILENAMES or basename in SENSITIVE_CONFIG_FILENAMES:
        return True

    # .env, .env.local, .env.production, ...
    if basename == ".env" or basename.startswith(".env."):
        return True

    if any(basename.endswith(suffix) for suffix in SENSITIVE_FILENAME_SUFFIXES):
        return True

    return any(marker in lower for marker in SENSITIVE_PATH_MARKERS)


def _should_analyze_file(file_path):
    # sourcery skip: assign-if-exp, boolean-if-exp-identity, invert-any-all, reintroduce-else, remove-unnecessary-cast
    """
    Return False for docs, assets, lockfiles, and vendored paths.

    Works for Python, Node/Express, Go, etc. — we analyze source code files only,
    not markdown READMEs or PNG icons regardless of repo language.
    """
    if not file_path:
        return False

    lower = file_path.lower().replace("\\", "/")
    basename = lower.rsplit("/", 1)[-1]

    if basename in SKIP_ANALYSIS_FILENAMES:
        return False
    if any(lower.endswith(ext) for ext in SKIP_ANALYSIS_EXTENSIONS):
        return False
    if any(segment in lower for segment in SKIP_ANALYSIS_PATH_SEGMENTS):
        return False

    return True


def _added_patch_lines(patch):
    """Extract newly added lines from a unified diff patch (lines starting with +)."""
    return [
        line[1:] # 1: isliye kyunki + line ke pehle space hai eg: + line -> line
        for line in (patch or "").splitlines() #patch is a string and we are splitting it into lines
        if line.startswith("+") and not line.startswith("+++")
    ]


def _code_without_strings(line):
    """Remove '...' and \"...\" chunks so we match code patterns only, not doc/test strings."""
    return _STRING_LITERAL_RE.sub("", line)


def _line_indent(line):
    return len(line) - len(line.lstrip(" "))


def _is_loop_statement_line(line):
    """
    True for statement-level loops (for/while/forEach), not list-comp 'x for x in y' mid-line.
    """
    stripped = line.lstrip()
    if stripped.startswith("#"):
        return False
    code = _code_without_strings(stripped).strip()
    if not code:
        return False
    return (
        code.startswith("for ")
        or code.startswith("for(")
        or code.startswith("while ")
        or code.startswith("for await ")
        or ".forEach(" in code
    )


def _line_has_python_orm_get(line): 
    code = _code_without_strings(line)
    return bool(_PYTHON_ORM_GET_RE.search(code))


def _line_has_js_orm_get(line): 
    code = _code_without_strings(line)
    return any(pattern.search(code) for pattern in _JS_ORM_CALL_RES)


def _block_has_n_plus_one(added_lines, body_checker):
    """
    Walk added diff lines: find a loop statement, then check indented body lines
    for ORM calls. Only flags when DB access appears INSIDE the loop block.
    """
    i = 0
    while i < len(added_lines):
        line = added_lines[i]
        if not _is_loop_statement_line(line):
            i += 1
            continue

        loop_indent = _line_indent(line)
        j = i + 1
        while j < len(added_lines):
            body_line = added_lines[j]
            body_stripped = body_line.lstrip()
            if not body_stripped or body_stripped.startswith("#"):
                j += 1
                continue

            body_indent = _line_indent(body_line)
            if body_indent <= loop_indent:
                break

            if body_checker(body_line):
                code = _code_without_strings(body_line)
                if _PYTHON_ORM_GET_RE.search(code):
                    return True, "objects.get("
                for pattern in _JS_ORM_CALL_RES:
                    match = pattern.search(code)
                    if match:
                        return True, match.group(0).split("(")[0] + "("

            j += 1

        i += 1

    return False, None


def _patch_has_n_plus_one(patch, file_path):
    """
    Detect likely N+1 DB access inside a loop body — multi-language.

    Requires a loop statement AND an ORM call on a deeper-indented line below it.
    Ignores mentions inside strings (docs, test fixtures, error messages).
    """
    if not _should_analyze_file(file_path):
        return False, None

    added_lines = _added_patch_lines(patch)
    if not added_lines:
        return False, None

    lower_path = file_path.lower()

    if lower_path.endswith(".py"):
        return _block_has_n_plus_one(added_lines, _line_has_python_orm_get)

    if lower_path.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")):
        return _block_has_n_plus_one(added_lines, _line_has_js_orm_get)

    return False, None


def fetch_commit_diff(token, full_name, sha):
    """
    Call GitHub REST API for one commit's full diff.

    Uses github_request() from github_client.py (requests library under the hood).

    Args:
        token: User's GitHub OAuth token (from UserProfile.github_access_token).
        full_name: "owner/repo" string.
        sha: Full 40-char commit SHA.

    Returns:
        tuple (files_list, error_message)
        - On success: (list of file dicts from GitHub JSON, None)
        - On failure: ([], "reason string")
    """
    path = f"/repos/{full_name}/commits/{sha}"
    response = github_request("GET", path, token)

    if response.status_code == 401:
        return [], "GitHub token expired or revoked. Sign in with GitHub again."

    if not response.ok:
        logger.error(
            "GitHub commit diff failed for %s@%s: %s %s",
            full_name,
            sha[:7],
            response.status_code,
            response.text[:300],
        )
        return [], f"GitHub API error ({response.status_code}) while fetching commit diff."

    payload = response.json()
    files = payload.get("files") or []
    return files, None


def save_file_changes(commit, diff_files):
    """
    Persist GitHub diff files[] into FileChange rows (upsert per commit + path).

    Args:
        commit: Commit model instance.
        diff_files: List of dicts from GitHub API (filename, status, patch, additions, ...).

    Returns:
        QuerySet of FileChange for this commit (fresh from DB).
    """
    for file_item in diff_files:
        file_path = file_item.get("filename") or ""
        if not file_path:
            continue

        FileChange.objects.update_or_create(
            commit=commit,
            file_path=file_path,
            defaults={
                "status": file_item.get("status") or "modified",
                "additions": file_item.get("additions") or 0,
                "deletions": file_item.get("deletions") or 0,
                # GitHub omits patch for very large files — store empty string then.
                "patch": file_item.get("patch") or "",
            },
        )

    return commit.file_changes.all()


def _guess_line_number(patch, needle):
    """
    Find approximate line number of `needle` inside a unified diff patch.

    Counts lines starting with '+' (added lines in diff) — good enough for MVP UI.
    Returns None if not found.
    """
    if not patch or not needle:
        return None

    added_line_no = 0
    for line in patch.splitlines():
        if line.startswith("@@"):
            continue
        if line.startswith("+"):
            added_line_no += 1
            if needle.strip() in line:
                return added_line_no
    return None


def _extract_problem_snippet(patch, max_lines=6):
    """Return a few lines from the patch for display in the UI description field."""
    if not patch:
        return ""
    lines = [ln for ln in patch.splitlines() if ln.startswith("+") and not ln.startswith("+++")]
    snippet = "\n".join(line[1:] for line in lines[:max_lines])
    return snippet.strip()


def analyze_file_changes(file_changes):
    """
    Rule-based static analysis on saved FileChange rows (Week 3 MVP — no AI/AST).

    Rules:
      0. Skip docs/assets/lockfiles ( .md, images, node_modules, etc. )
      1. N+1 pattern: loop + ORM call in added lines → CRITICAL
         - Python: objects.get(
         - Node/Express: .findOne(, .findById(, .findByPk(, .findUnique(
      2. Large change: additions + deletions > 500 → WARNING
      3. Sensitive file path (env, secrets, keys, prod config — any stack) → WARNING

    Returns:
        List of dicts ready to insert as AnalysisIssue rows:
        { severity, title, file_path, line_number, description, suggestion }
    """
    issues = []

    for fc in file_changes:
        if not _should_analyze_file(fc.file_path):
            continue

        patch = fc.patch or ""
        total_lines = (fc.additions or 0) + (fc.deletions or 0)

        # --- Rule 1: possible ORM N+1 inside a loop (Python + Node/Express) ---
        has_n_plus_one, needle = _patch_has_n_plus_one(patch, fc.file_path)
        if has_n_plus_one:
            line_no = _guess_line_number(patch, needle)
            lower_path = fc.file_path.lower()
            if lower_path.endswith(".py"):
                suggestion = (
                    "Collect IDs in the loop, then fetch all rows with "
                    "Model.objects.filter(id__in=ids) outside the loop."
                )
                problem_hint = "Loop body appears to call objects.get() per iteration."
            else:
                suggestion = (
                    "Batch the lookup outside the loop — e.g. fetch all IDs with "
                    "findAll({ where: { id: ids } }) or $in query, then map in memory."
                )
                problem_hint = "Loop body appears to run a per-row database query."
            issues.append(
                {
                    "severity": "CRITICAL",
                    "title": "Possible N+1 Query",
                    "file_path": fc.file_path,
                    "line_number": line_no,
                    "description": _extract_problem_snippet(patch) or problem_hint,
                    "suggestion": suggestion,
                }
            )

        # --- Rule 2: very large diff ---
        if total_lines > LARGE_CHANGE_LINE_THRESHOLD:
            issues.append(
                {
                    "severity": "WARNING",
                    "title": "Large change set",
                    "file_path": fc.file_path,
                    "line_number": None,
                    "description": (
                        f"This file changed {total_lines} lines "
                        f"(+{fc.additions}/-{fc.deletions}). Review carefully."
                    ),
                    "suggestion": "Split into smaller commits or add extra tests for this area.",
                }
            )

        # --- Rule 3: sensitive paths (stack-agnostic) ---
        if _is_sensitive_file(fc.file_path):
            issues.append(
                {
                    "severity": "WARNING",
                    "title": "Sensitive file modified",
                    "file_path": fc.file_path,
                    "line_number": None,
                    "description": (
                        f"Changes touch a sensitive path ({fc.file_path}). "
                        "Double-check secrets and production config."
                    ),
                    "suggestion": "Ensure no credentials are committed; use environment variables.",
                }
            )

    return issues


def compute_risk_level(issues):
    """
    Roll up issue severities into one commit-level badge for the Dashboard.

    Priority: any CRITICAL → CRITICAL; else any WARNING → WARNING; else OK.
    """
    if any(issue.get("severity") == "CRITICAL" for issue in issues):
        return "CRITICAL"
    if any(issue.get("severity") == "WARNING" for issue in issues):
        return "WARNING"
    return "OK"


def build_ai_summary(issues, commit_message):
    """
    Simple text summary for CommitDetail "AI Explanation" section (no LLM yet).

    Later you can swap this for an OpenAI/Anthropic call inside the worker.
    """
    if not issues:
        return (
            f"No rule-based issues were found for commit «{commit_message.split(chr(10))[0]}». "
            "Static checks passed for N+1 patterns, large diffs, and sensitive files."
        )

    critical = [i for i in issues if i.get("severity") == "CRITICAL"]
    warnings = [i for i in issues if i.get("severity") == "WARNING"]

    parts = [f"Analysis found {len(issues)} issue(s) in this commit."]
    if critical:
        parts.append(
            f"Critical: {critical[0]['title']} in {critical[0]['file_path']} — "
            f"{critical[0].get('description', '')[:200]}"
        )
    if warnings:
        parts.append(f"Warnings: {len(warnings)} item(s) including {warnings[0]['title']}.")

    return " ".join(parts)
