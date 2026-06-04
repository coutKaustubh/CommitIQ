import logging

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .github_client import github_request
from .models import UserProfile

logger = logging.getLogger(__name__)


def get_user_profile(request):
    """UserProfile for the authenticated Supabase user, or None."""
    user = request.supabase_user
    try:
        return UserProfile.objects.get(supabase_user_id=user.id)
    except UserProfile.DoesNotExist:
        return None


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
