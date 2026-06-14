"""
REST API views for commit analysis results.

These endpoints are called by the React Dashboard / CommitDetail pages.
All routes require Supabase JWT (except webhook — see middleware EXEMPT_ROUTES).

Polling flow (CommitDetail):
  GET /commits/{sha}/analysis/  → job status + issues
  while status is pending/running → poll GET /analysis/jobs/{id}/ every 2s
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .analysis_services import build_ai_summary
from .models import AnalysisJob, Commit
from .tasks import enqueue_commit_analysis
from .views import get_user_profile


def _user_owns_commit(profile, commit):
    """True if commit belongs to one of the user's connected (active) repositories."""
    return commit.repository.owner_id == profile.id and commit.repository.is_active


def _find_commit_for_user(profile, sha):
    """
    Resolve commit by full SHA or short prefix (frontend may link with 7-char sha).

    Returns Commit or None.
    """
    commits = Commit.objects.filter(
        repository__owner=profile,
        repository__is_active=True,
    ).select_related("repository", "analysis_job")

    exact = commits.filter(sha=sha).first()
    if exact:
        return exact

    if len(sha) >= 7:
        return commits.filter(sha__startswith=sha).first()

    return None


def _serialize_issue(issue):
    """Convert AnalysisIssue model → JSON for frontend."""
    return {
        "id": issue.id,
        "severity": issue.severity,
        "title": issue.title,
        "file": issue.file_path,
        "file_path": issue.file_path,
        "line": issue.line_number,
        "line_number": issue.line_number,
        "problem": issue.description,
        "description": issue.description,
        "fix": issue.suggestion,
        "suggestion": issue.suggestion,
    }


def _serialize_file_change(fc):
    """Convert FileChange model → JSON."""
    return {
        "file_path": fc.file_path,
        "status": fc.status,
        "additions": fc.additions,
        "deletions": fc.deletions,
    }


def _serialize_job(job, *, include_issues=False, include_files=False):
    """Build analysis job payload; optionally nest issues and file changes."""
    commit = job.commit
    payload = {
        "job_id": job.id,
        "status": job.status,
        "risk_level": job.risk_level or "OK",
        "risk": job.risk_level or "OK",
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "commit": {
            "id": commit.id,
            "sha": commit.sha,
            "short_sha": commit.sha[:7],
            "message": commit.message,
            "author_name": commit.author_name,
            "committed_at": commit.committed_at.isoformat(),
            "html_url": commit.html_url,
            "repository": commit.repository.full_name,
        },
    }

    if include_issues:
        payload["issues"] = [_serialize_issue(i) for i in job.issues.all()]
        payload["static"] = payload["issues"]

    if include_files:
        payload["file_changes"] = [
            _serialize_file_change(fc) for fc in commit.file_changes.all()
        ]

    return payload


@api_view(["GET"])
def get_analysis_job(request, job_id):
    """
    GET /api/repos/analysis/jobs/{job_id}/

    Lightweight poll endpoint — frontend checks status while worker runs.
    Returns: { job_id, status, risk_level, error_message, commit summary }
    """
    profile = get_user_profile(request)
    if not profile:
        return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        job = AnalysisJob.objects.select_related(
            "commit",
            "commit__repository",
        ).get(id=job_id, commit__repository__owner=profile)
    except AnalysisJob.DoesNotExist:
        return Response({"error": "Analysis job not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response(_serialize_job(job))


@api_view(["GET"])
def get_commit_analysis(request, sha):
    """
    GET /api/repos/commits/{sha}/analysis/

    Full commit analysis page data: job + issues + file_changes + AI summary text.
    sha can be full 40-char SHA or short prefix (e.g. 4f9ab6b).
    """
    profile = get_user_profile(request)
    if not profile:
        return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    commit = _find_commit_for_user(profile, sha)
    if not commit:
        return Response({"error": "Commit not found"}, status=status.HTTP_404_NOT_FOUND)

    job = getattr(commit, "analysis_job", None)
    if not job:
        return Response(
            {
                "error": "No analysis job for this commit yet",
                "code": "no_analysis_job",
                "commit": {
                    "sha": commit.sha,
                    "short_sha": commit.sha[:7],
                    "message": commit.message,
                },
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    data = _serialize_job(job, include_issues=True, include_files=True)
    data["sha"] = commit.sha
    data["short_sha"] = commit.sha[:7]
    data["message"] = commit.message
    data["author"] = commit.author_name
    data["at"] = commit.committed_at.isoformat()
    data["risk"] = job.risk_level or "OK"
    data["ai"] = {
        "question": "Why does this commit matter?",
        "answer": build_ai_summary(
            [{"severity": i.severity, "title": i.title, "file_path": i.file_path, "description": i.description}
             for i in job.issues.all()],
            commit.message,
        ),
    }
    return Response(data)


@api_view(["GET"])
def recent_analysis_feed(request):
    """
    GET /api/repos/commits/recent-analysis/

    Dashboard feed: latest analyzed commits across user's connected repos.
    Replaces MOCK_ANALYSIS_FEED in the frontend.
    """
    profile = get_user_profile(request)
    if not profile:
        return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    jobs_qs = (
        AnalysisJob.objects.filter(
            commit__repository__owner=profile,
            commit__repository__is_active=True,
        )
        .select_related("commit")
        .prefetch_related("issues")
        .order_by("-commit__committed_at")
    )

    done_count = jobs_qs.filter(status=AnalysisJob.Status.DONE).count()
    critical_count = jobs_qs.filter(risk_level="CRITICAL").count()
    jobs = list(jobs_qs[:20])
    feed = []
    for job in jobs:
        commit = job.commit
        top_issue = job.issues.first()
        top_issue_text = (
            f"{top_issue.title} in {top_issue.file_path}"
            if top_issue
            else "No issues detected"
        )
        feed.append(
            {
                "id": job.id,
                "job_id": job.id,
                "sha": commit.sha[:7],
                "full_sha": commit.sha,
                "message": commit.message.split("\n")[0],
                "author": commit.author_name,
                "risk": job.risk_level or "OK",
                "status": job.status,
                "topIssue": top_issue_text,
                "at": commit.committed_at.isoformat(),
            }
        )

    return Response(
        {
            "feed": feed,
            "stats": {
                "analyzed": done_count,
                "critical": critical_count,
            },
        }
    )


@api_view(["POST"])
def retry_analysis(request):
    """
    POST /api/repos/analysis/retry/

    Body JSON: { "job_id": 123 } OR { "commit_id": 456 }

    Re-queues process_commit for failed or stuck jobs (user clicked Retry in UI).
    """
    profile = get_user_profile(request)
    if not profile:
        return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    job_id = request.data.get("job_id")
    commit_id = request.data.get("commit_id")

    if not job_id and not commit_id:
        return Response(
            {"error": "Provide job_id or commit_id in JSON body"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        if job_id:
            job = AnalysisJob.objects.select_related("commit").get(
                id=job_id,
                commit__repository__owner=profile,
            )
        else:
            job = AnalysisJob.objects.select_related("commit").get(
                commit_id=commit_id,
                commit__repository__owner=profile,
            )
    except AnalysisJob.DoesNotExist:
        return Response({"error": "Analysis job not found"}, status=status.HTTP_404_NOT_FOUND)

    job.status = AnalysisJob.Status.PENDING
    job.error_message = ""
    job.risk_level = ""
    job.started_at = None
    job.finished_at = None
    job.save(
        update_fields=[
            "status",
            "error_message",
            "risk_level",
            "started_at",
            "finished_at",
        ]
    )

    enqueue_commit_analysis(job.commit)

    return Response(
        {
            "message": "Analysis re-queued",
            "job": _serialize_job(job),
        },
        status=status.HTTP_200_OK,
    )
