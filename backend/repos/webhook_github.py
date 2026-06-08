"""
Register/delete GitHub repo webhooks via REST API when user connects/disconnects.

Uses the user's OAuth token (admin:repo_hook scope) — not the webhook receive path.
"""

import logging

from django.conf import settings

from .github_client import github_request

logger = logging.getLogger(__name__)


def get_webhook_callback_url():
    base = (getattr(settings, "PUBLIC_API_URL", "") or "http://127.0.0.1:8000").rstrip("/")
    return f"{base}/api/webhooks/github/"


def _repo_hooks_path(full_name):
    if "/" not in full_name:
        raise ValueError("full_name must be owner/repo")
    owner, repo = full_name.split("/", 1)
    return f"/repos/{owner}/{repo}/hooks"


def find_existing_hook_id(hooks, callback_url):
    for hook in hooks or []:
        config = hook.get("config") or {}
        if config.get("url") == callback_url:
            return hook.get("id")
    return None


def ensure_repo_webhook(token, full_name):
    """
    Create or reuse a push webhook on the repo.
    Returns (hook_id, error_message).
    """
    secret = getattr(settings, "GITHUB_WEBHOOK_SECRET", "") or ""
    if not secret:
        return None, "Server webhook secret not configured (GITHUB_WEBHOOK_SECRET)"

    callback_url = get_webhook_callback_url()
    path = _repo_hooks_path(full_name)

    list_resp = github_request("GET", path, token)
    if list_resp.status_code == 403:
        return None, "Need admin access on this repo to manage webhooks"
    if not list_resp.ok:
        logger.error("GitHub list hooks failed for %s: %s", full_name, list_resp.text[:300])
        return None, "Could not list GitHub webhooks for this repository"

    existing_id = find_existing_hook_id(list_resp.json(), callback_url)
    if existing_id:
        return int(existing_id), None

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
    if not create_resp.ok:
        logger.error(
            "GitHub create hook failed for %s: %s %s",
            full_name,
            create_resp.status_code,
            create_resp.text[:300],
        )
        return None, f"GitHub rejected webhook setup ({create_resp.status_code})"

    hook_id = create_resp.json().get("id")
    if not hook_id:
        return None, "GitHub did not return a webhook id"
    return int(hook_id), None


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
