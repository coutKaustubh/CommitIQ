"""
Ask AI API — RAG query over indexed commit chunks for one repository.
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response

from core.throttling import AskAIRateThrottle

from .rag_services import ask_commit, ask_repository
from .views import get_connected_repository, get_user_profile

logger = logging.getLogger(__name__)

MAX_QUESTION_LENGTH = 4000


def _parse_question(request):
    question = (request.data.get("question") or "").strip()
    if not question:
        return None, Response(
            {"error": "question is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(question) > MAX_QUESTION_LENGTH:
        return None, Response(
            {"error": f"question must be at most {MAX_QUESTION_LENGTH} characters"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return question, None


@api_view(["POST"])
@throttle_classes([AskAIRateThrottle])
def ask_commit_view(request, sha):
    """
    POST /api/repos/commits/{sha}/ask/

    Body JSON: { "question": "What logic was added here?" }
    """
    from .analysis_views import _find_commit_for_user

    profile = get_user_profile(request)
    if not profile:
        return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    commit = _find_commit_for_user(profile, sha)
    if not commit:
        return Response({"error": "Commit not found"}, status=status.HTTP_404_NOT_FOUND)

    question, error_response = _parse_question(request)
    if error_response:
        return error_response

    try:
        result = ask_commit(commit, question)
    except RuntimeError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception:
        logger.exception("ask_commit_view failed sha=%s", sha)
        return Response(
            {"error": "Could not generate an answer. Try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            **result,
            "commit_sha": commit.sha,
            "commit_sha_short": commit.sha[:7],
            "repository_id": commit.repository_id,
            "repository_full_name": commit.repository.full_name,
        }
    )


@api_view(["POST"])
@throttle_classes([AskAIRateThrottle])
def ask_repo(request, repo_id):
    """
    POST /api/repos/{repo_id}/ask/

    Body JSON: { "question": "Where is my N+1 problem?" }

    Returns: { answer, sources, chunks_used }
    """
    profile = get_user_profile(request)
    if not profile:
        return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    repo = get_connected_repository(profile, repo_id)
    if not repo:
        return Response(
            {"error": "Repository not found or not connected"},
            status=status.HTTP_404_NOT_FOUND,
        )

    question, error_response = _parse_question(request)
    if error_response:
        return error_response

    try:
        result = ask_repository(repo, question)
    except RuntimeError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception:
        logger.exception("ask_repo failed repo_id=%s", repo_id)
        return Response(
            {"error": "Could not generate an answer. Try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            **result,
            "repository_id": repo.id,
            "repository_full_name": repo.full_name,
        }
    )
