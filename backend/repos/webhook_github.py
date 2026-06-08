"""
Register/delete GitHub repo webhooks via REST API when user connects/disconnects.

Uses the user's OAuth token (admin:repo_hook scope) — not the webhook receive path.
"""

import logging
from urllib.parse import urlparse

from django.conf import settings

from .github_client import github_request

logger = logging.getLogger(__name__)

WEBHOOK_PATH_SUFFIX = "/api/webhooks/github"


def get_webhook_callback_url():
    base = (getattr(settings, "PUBLIC_API_URL", "") or "http://127.0.0.1:8000").rstrip("/")
    return f"{base}{WEBHOOK_PATH_SUFFIX}/"


def _normalize_hook_url(url):
    """Compare hook URLs ignoring trailing slash differences."""
    if not url:
        return ""
    parsed = urlparse(url.strip().rstrip("/"))
    host = (parsed.hostname or "").lower()
    path = (parsed.path or "").rstrip("/") or ""
    scheme = (parsed.scheme or "https").lower()
    port = parsed.port
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        netloc = f"{host}:{port}"
    else:
        netloc = host
    return f"{scheme}://{netloc}{path}"


def _urls_match(a, b):
    return _normalize_hook_url(a) == _normalize_hook_url(b)


def _is_commitiq_hook_url(url):
    """True if this hook points at our webhook endpoint (any host)."""
    norm = _normalize_hook_url(url)
    return norm.endswith(WEBHOOK_PATH_SUFFIX)


def _parse_github_error(response):
    try:
        data = response.json()
    except ValueError:
        return response.text[:200] or f"HTTP {response.status_code}"
    parts = [data.get("message") or ""]
    for err in data.get("errors") or []:
        msg = err.get("message") or err.get("code") or ""
        if msg:
            parts.append(str(msg))
    return " — ".join(p for p in parts if p) or f"HTTP {response.status_code}"


def _validate_callback_url(callback_url):
    host = (urlparse(callback_url).hostname or "").lower()
    if host in ("127.0.0.1", "localhost") and not settings.DEBUG:
        return (
            "Server PUBLIC_API_URL is not set for production. "
            "On Render add: PUBLIC_API_URL=https://commitiq-etsu.onrender.com"
        )
    if not callback_url.startswith("https://") and not settings.DEBUG:
        return "Webhook URL must be HTTPS in production (check PUBLIC_API_URL)"
    return None


def _repo_hooks_path(full_name):
    if "/" not in full_name:
        raise ValueError("full_name must be owner/repo")
    owner, repo = full_name.split("/", 1)
    return f"/repos/{owner}/{repo}/hooks"


def _list_repo_hooks(token, full_name):
    path = _repo_hooks_path(full_name)
    resp = github_request("GET", path, token, params={"per_page": 100})
    if resp.status_code == 403:
        return None, "Need admin access on this repo to manage webhooks"
    if not resp.ok:
        logger.error("GitHub list hooks failed for %s: %s", full_name, resp.text[:300])
        return None, "Could not list GitHub webhooks for this repository"
    return resp.json(), None


def find_existing_hook_id(hooks, callback_url):
    """
    Find an existing CommitIQ webhook:
    1. Exact URL match (normalized)
    2. Any hook whose path is /api/webhooks/github (reuse manual hooks)
    """
    exact_match = None
    path_match = None
    for hook in hooks or []:
        hook_url = (hook.get("config") or {}).get("url") or ""
        hook_id = hook.get("id")
        if not hook_id:
            continue
        if _urls_match(hook_url, callback_url):
            exact_match = hook_id
            break
        if path_match is None and _is_commitiq_hook_url(hook_url):
            path_match = hook_id
    return exact_match or path_match


def ensure_repo_webhook(token, full_name):
    """
    Create or reuse a push webhook on the repo.
    Returns (hook_id, error_message).
    """
    secret = getattr(settings, "GITHUB_WEBHOOK_SECRET", "") or ""
    if not secret:
        return None, "Server webhook secret not configured (GITHUB_WEBHOOK_SECRET)"

    callback_url = get_webhook_callback_url()
    config_error = _validate_callback_url(callback_url)
    if config_error:
        return None, config_error

    hooks, list_error = _list_repo_hooks(token, full_name)
    if list_error:
        return None, list_error

    existing_id = find_existing_hook_id(hooks, callback_url)
    if existing_id:
        return int(existing_id), None

    path = _repo_hooks_path(full_name)
    create_resp = github_request(
        "POST",
        path,
        token,
        json={
            "name": "web",
            "active": True,
            "events": ["push"],
            "config": {
                "url": callback_url,
                "content_type": "json",
                "secret": secret,
                "insecure_ssl": "0",
            },
        },
    )
    if create_resp.status_code == 403:
        return None, "Missing admin:repo_hook scope — sign out and sign in with GitHub again"

    if create_resp.ok:
        hook_id = create_resp.json().get("id")
        if hook_id:
            return int(hook_id), None
        return None, "GitHub did not return a webhook id"

    # 422 often means hook already exists — re-list and reuse
    if create_resp.status_code == 422:
        hooks_retry, list_error = _list_repo_hooks(token, full_name)
        if not list_error and hooks_retry:
            retry_id = find_existing_hook_id(hooks_retry, callback_url)
            if retry_id:
                return int(retry_id), None

    gh_msg = _parse_github_error(create_resp)
    logger.error(
        "GitHub create hook failed for %s: %s %s",
        full_name,
        create_resp.status_code,
        create_resp.text[:500],
    )
    return None, f"GitHub rejected webhook setup ({create_resp.status_code}): {gh_msg}"


def delete_repo_webhook(token, full_name, hook_id):
    """
    Remove webhook from GitHub. Returns (ok, error_message).
    """
    if not hook_id:
        return True, None

    path = f"{_repo_hooks_path(full_name)}/{hook_id}"
    resp = github_request("DELETE", path, token)
    if resp.status_code in (204, 404):
        return True, None
    logger.warning(
        "GitHub delete hook failed for %s hook %s: %s",
        full_name,
        hook_id,
        resp.text[:300],
    )
    return False, "Could not delete webhook on GitHub"
