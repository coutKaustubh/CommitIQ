import logging

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .github_client import github_request
from .models import Repository, UserProfile

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
        "created_at": repo.created_at.isoformat(),
    }


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

    connected = set(
        profile.repositories.filter(is_active=True).values_list("full_name", flat=True)
    )

    repos = []
    for item in response.json():
        full_name = item.get("full_name") or ""
        repos.append(
            {
                "id": item.get("id"),
                "full_name": full_name,
                "private": bool(item.get("private")),
                "html_url": item.get("html_url"),
                "description": item.get("description") or "",
                "connected": full_name in connected,
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

    return Response(
        {
            "message": "Repository connected",
            "repository": serialize_repository(repo),
            "created": created,
        },
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

    repo.is_active = False
    repo.save(update_fields=["is_active", "updated_at"])

    return Response(
        {"message": "Repository disconnected", "repository": serialize_repository(repo)},
        status=status.HTTP_200_OK,
    )
