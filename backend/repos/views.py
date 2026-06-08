import logging

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .github_client import github_request
from .models import Commit, Repository, UserProfile
from .webhook_github import delete_repo_webhook, ensure_repo_webhook

logger = logging.getLogger(__name__)


def get_user_profile(request):
    """UserProfile for the authenticated Supabase user, or None."""
    user = request.supabase_user
    try:
        return UserProfile.objects.get(supabase_user_id=user.id)
    except UserProfile.DoesNotExist:
        return None


def require_profile_with_github(request):
    """Return (profile, None) or (None, error Response)."""
    profile = get_user_profile(request)
    if not profile or not profile.github_access_token:
        return None, Response(
            {
                "error": "GitHub not connected. Sign in with GitHub first.",
                "code": "no_github_token",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    return profile, None


def serialize_repository(repo):
    return {
        "id": repo.id,
        "github_id": repo.github_id,
        "full_name": repo.full_name,
        "is_active": repo.is_active,
        "webhook_active": bool(repo.is_active and repo.github_webhook_id),
        "created_at": repo.created_at.isoformat(),
    }


def serialize_commit(commit):
    return {
        "id": commit.id,
        "sha": commit.sha,
        "short_sha": commit.sha[:7],
        "message": commit.message,
        "author_name": commit.author_name,
        "committed_at": commit.committed_at.isoformat(),
        "html_url": commit.html_url,
    }


def parse_github_datetime(value):
    if not value:
        return timezone.now()
    normalized = value.replace("Z", "+00:00")
    dt = parse_datetime(normalized)
    if dt is None:
        return timezone.now()
    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt


def get_connected_repository(profile, repo_id):
    try:
        return Repository.objects.get(
            id=repo_id,
            owner=profile,
            is_active=True,
        )
    except Repository.DoesNotExist:
        return None


def sync_commits_from_github(repository, items):
    """Upsert commits from GitHub API response into DB."""
    for item in items:
        sha = item.get("sha")
        if not sha:
            continue
        commit_data = item.get("commit") or {}
        author = commit_data.get("author") or {}
        message = (commit_data.get("message") or "").strip()
        author_name = author.get("name") or ""
        committed_at = parse_github_datetime(author.get("date"))
        html_url = item.get("html_url") or ""

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


def _save_webhook_on_repo(repo, token, full_name):
    hook_id, hook_error = ensure_repo_webhook(token, full_name)
    if hook_id:
        repo.github_webhook_id = hook_id
        repo.save(update_fields=["github_webhook_id", "updated_at"])
    return hook_id, hook_error


@api_view(["GET"])
def list_github_repos(request):
    """
    List repos from GitHub for the logged-in user (uses stored provider token).
    """
    profile = get_user_profile(request)
    if not profile or not profile.github_access_token:
        return Response(
            {
                "error": "GitHub not connected. Sign in with “Continue with GitHub”, then open this page again.",
                "code": "no_github_token",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    token = profile.github_access_token
    response = github_request(
        "GET",
        "/user/repos",
        token,
        params={"per_page": 100, "sort": "updated", "affiliation": "owner,collaborator,organization_member"},
    )

    if response.status_code == 401:
        return Response(
            {
                "error": "GitHub token expired or revoked. Sign in with GitHub again.",
                "code": "github_token_invalid",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not response.ok:
        logger.error("GitHub repos API error: %s %s", response.status_code, response.text[:500])
        return Response(
            {"error": "Could not load repositories from GitHub."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    connected_repos = {
        r.full_name: r for r in profile.repositories.filter(is_active=True)
    }

    repos = []
    for item in response.json():
        full_name = item.get("full_name") or ""
        connected = connected_repos.get(full_name)
        repos.append(
            {
                "id": item.get("id"),
                "full_name": full_name,
                "private": bool(item.get("private")),
                "html_url": item.get("html_url"),
                "description": item.get("description") or "",
                "connected": connected is not None,
                "db_id": connected.id if connected else None,
                "webhook_active": bool(
                    connected and connected.is_active and connected.github_webhook_id
                ),
            }
        )

    return Response(
        {
            "repos": repos,
            "github_username": profile.github_username,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
def list_connected_repos(request):
    """Repositories the user has connected to CommitIQ (is_active=True)."""
    profile = get_user_profile(request)
    if not profile:
        return Response({"connected": []}, status=status.HTTP_200_OK)

    connected = profile.repositories.filter(is_active=True).order_by("-updated_at")
    return Response(
        {
            "connected": [serialize_repository(r) for r in connected],
            "count": connected.count(),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
def connect_repo(request):
    """
    Connect a GitHub repo to CommitIQ.
    Body: { "github_id": 123, "full_name": "owner/repo" }
    """
    profile, err = require_profile_with_github(request)
    if err:
        return err

    github_id = request.data.get("github_id")
    full_name = (request.data.get("full_name") or "").strip()

    if not github_id or not full_name:
        return Response(
            {"error": "github_id and full_name are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        github_id = int(github_id)
    except (TypeError, ValueError):
        return Response(
            {"error": "github_id must be a number"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    repo, created = Repository.objects.update_or_create(
        owner=profile,
        full_name=full_name,
        defaults={"github_id": github_id, "is_active": True},
    )

    hook_id, hook_error = _save_webhook_on_repo(repo, profile.github_access_token, full_name)

    payload = {
        "message": "Repository connected",
        "repository": serialize_repository(repo),
        "created": created,
        "webhook_active": hook_id is not None,
    }
    if hook_error:
        payload["webhook_error"] = hook_error
        logger.warning("Connect %s: webhook setup failed: %s", full_name, hook_error)

    return Response(
        payload,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
def disconnect_repo(request):
    """
    Disconnect a repo (soft delete — is_active=False).
    Body: { "full_name": "owner/repo" }
    """
    profile, err = require_profile_with_github(request)
    if err:
        return err

    full_name = (request.data.get("full_name") or "").strip()
    if not full_name:
        return Response(
            {"error": "full_name is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        repo = Repository.objects.get(owner=profile, full_name=full_name)
    except Repository.DoesNotExist:
        return Response(
            {"error": "Repository not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not repo.is_active:
        return Response(
            {"message": "Repository already disconnected", "repository": serialize_repository(repo)},
            status=status.HTTP_200_OK,
        )

    if repo.github_webhook_id:
        ok, del_error = delete_repo_webhook(
            profile.github_access_token,
            full_name,
            repo.github_webhook_id,
        )
        if not ok:
            logger.warning("Disconnect %s: webhook delete failed: %s", full_name, del_error)

    repo.is_active = False
    repo.github_webhook_id = None
    repo.save(update_fields=["is_active", "github_webhook_id", "updated_at"])

    return Response(
        {"message": "Repository disconnected", "repository": serialize_repository(repo)},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
def retry_repo_webhook(request):
    """
    Retry GitHub webhook setup for an already-connected repo.
    Body: { "full_name": "owner/repo" }
    """
    profile, err = require_profile_with_github(request)
    if err:
        return err

    full_name = (request.data.get("full_name") or "").strip()
    if not full_name:
        return Response(
            {"error": "full_name is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        repo = Repository.objects.get(owner=profile, full_name=full_name, is_active=True)
    except Repository.DoesNotExist:
        return Response(
            {"error": "Connected repository not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    hook_id, hook_error = _save_webhook_on_repo(repo, profile.github_access_token, full_name)
    repo.refresh_from_db()

    payload = {
        "message": "Webhook active" if hook_id else "Webhook setup failed",
        "repository": serialize_repository(repo),
        "webhook_active": hook_id is not None,
    }
    if hook_error:
        payload["webhook_error"] = hook_error
        logger.warning("Retry webhook %s failed: %s", full_name, hook_error)

    status_code = status.HTTP_200_OK if hook_id else status.HTTP_502_BAD_GATEWAY
    return Response(payload, status=status_code)


@api_view(["GET"])
def list_repo_commits(request, repo_id):
    """
    Latest commits for a connected repository (GitHub API + DB cache).
    """
    profile, err = require_profile_with_github(request)
    if err:
        return err

    repository = get_connected_repository(profile, repo_id)
    if not repository:
        return Response(
            {"error": "Connected repository not found", "code": "repo_not_found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    token = profile.github_access_token
    path = f"/repos/{repository.full_name}/commits"
    response = github_request("GET", path, token, params={"per_page": 20})

    if response.status_code == 401:
        return Response(
            {
                "error": "GitHub token expired or revoked. Sign in with GitHub again.",
                "code": "github_token_invalid",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not response.ok:
        logger.error(
            "GitHub commits API error for %s: %s %s",
            repository.full_name,
            response.status_code,
            response.text[:500],
        )
        return Response(
            {"error": "Could not load commits from GitHub."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    items = response.json()
    sync_commits_from_github(repository, items)

    commits = list(repository.commits.order_by("-committed_at")[:20])
    return Response(
        {
            "repository": serialize_repository(repository),
            "commits": [serialize_commit(c) for c in commits],
            "count": len(commits),
        },
        status=status.HTTP_200_OK,
    )
