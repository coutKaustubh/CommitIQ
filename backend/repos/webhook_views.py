"""
GitHub webhook endpoint — 

Why ngrok (dev) or Railway (prod)?
  git push → GitHub POST https://PUBLIC_URL/api/webhooks/github/
  localhost:8000 is not on the internet — ngrok tunnels public URL → your laptop.
  Same Django code runs after deploy; only the GitHub webhook Payload URL changes.

This view RECEIVES JSON — it does not call GitHub API (that is Phase 3 pull flow).
"""

import json
import logging
from urllib.parse import parse_qs
# urllib.parse = used to parse the URL and extract the query parameters
# parse_qs = used to parse the query parameters and return a dictionary
# keep_blank_values = used to keep the blank values in the query parameters
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Commit, Repository
from .views import parse_github_datetime
from .webhook_utils import verify_github_signature

logger = logging.getLogger(__name__)


def _parse_github_webhook_body(raw_body: bytes, content_type: str) -> dict:
    #raw_body: bytes = the raw body of the request
    #content_type: str = the content type of the request
    """
    GitHub can POST either:
      - application/json → body is the JSON payload (preferred)
      - application/x-www-form-urlencoded → JSON is in the `payload` field
    Signature is always computed on raw_body bytes (before parsing).
    """
    if not raw_body:
        raise ValueError("empty body")#if the raw body is empty, raise an error

    ct = (content_type or "").split(";")[0].strip().lower()
    text = raw_body.decode("utf-8")#converts the raw body to a string

    if ct == "application/x-www-form-urlencoded":
        form = parse_qs(text, keep_blank_values=True) 
        payload_parts = form.get("payload") or [] #payload is the JSON payload in the request
        if not payload_parts:
            raise ValueError("missing payload field")#if the payload is missing, raise an error
        return json.loads(payload_parts[0])#converts the payload to a dictionary

    return json.loads(text)#converts the text to a dictionary


def _save_commits_from_webhook_payload(repository, commits_payload):
    """
    Save commits from a GitHub *push* webhook body.

    Webhook shape ≠ REST API (Phase 3 list_repo_commits):
      webhook: commits[].id (sha), .message, .timestamp, .author.name
      REST:    items[].sha, nested .commit.author.date

    update_or_create = idempotent — duplicate delivery won't crash.
    """
    saved = 0
    for item in commits_payload:
        sha = item.get("id")
        if not sha:
            continue

        message = (item.get("message") or "").strip()
        author = item.get("author") or {}
        committer = item.get("committer") or {}
        author_name = author.get("name") or committer.get("name") or ""
        committed_at = parse_github_datetime(item.get("timestamp"))
        html_url = item.get("url") or ""

        Commit.objects.update_or_create(
            repository=repository,
            sha=sha,
            defaults={
                "message": message,
                "author_name": author_name,
                "committed_at": committed_at,
                "html_url": html_url,
            },
        )
        saved += 1
    return saved


@csrf_exempt
@require_http_methods(["POST"])
def github_webhook(request):
    """
    POST /api/webhooks/github/

    Step A — Route is in middleware EXEMPT_ROUTES (no Bearer JWT).
             GitHub auth = X-Hub-Signature-256 + shared secret.

    Step B — csrf_exempt: external POST has no Django CSRF cookie.

    Step C — Verify signature on raw request.body (see webhook_utils.py).

    Step D — X-GitHub-Event:
               ping  → GitHub connectivity test when you add the webhook (not network ping)
               push  → save commits
               other → 200 ignore

    Step E — Only Repository rows with is_active=True (user clicked Connect in app).

    Step F — Return 200 quickly; Celery analysis comes in Week 3.
    """
    raw_body = request.body
    signature = request.headers.get("X-Hub-Signature-256", "")
    secret = getattr(settings, "GITHUB_WEBHOOK_SECRET", "") or ""

    if not secret:
        logger.error("GITHUB_WEBHOOK_SECRET missing in settings/.env")
        return JsonResponse(
            {"error": "webhook secret not configured"},
            status=500,
        )

    if not verify_github_signature(raw_body, signature, secret):
        # 401 only for bad signature — not for unknown repos (see below).
        return JsonResponse({"error": "invalid signature"}, status=401)

    event = request.headers.get("X-GitHub-Event", "")

    if event == "ping":
        return JsonResponse({"ok": True, "message": "pong"}, status=200)

    if event != "push":
        return JsonResponse({"ok": True, "ignored": event}, status=200)

    content_type = request.headers.get("Content-Type", "")
    try:
        payload = _parse_github_webhook_body(raw_body, content_type)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        logger.warning(
            "Webhook push JSON parse failed (Content-Type=%r): %s",
            content_type,
            exc,
        )
        return JsonResponse(
            {
                "error": "invalid json",
                "hint": "Set GitHub webhook Content type to application/json",
            },
            status=400,
        )

    repository_data = payload.get("repository") or {}
    full_name = repository_data.get("full_name") or ""

    if not full_name:
        return JsonResponse({"ok": True, "skipped": "no_repository"}, status=200)

    repo = Repository.objects.filter(full_name=full_name, is_active=True).first()
    if not repo:
        # Still 200 — 4xx/5xx makes GitHub retry delivery many times.
        logger.info("Webhook push for unconnected repo: %s", full_name)
        return JsonResponse({"ok": True, "skipped": "not_connected"}, status=200)

    commits_payload = payload.get("commits") or []
    saved_count = _save_commits_from_webhook_payload(repo, commits_payload)

    logger.info("Webhook saved %s commits for %s", saved_count, full_name)

    return JsonResponse(
        {"ok": True, "saved": saved_count, "repository": full_name},
        status=200,
    )
