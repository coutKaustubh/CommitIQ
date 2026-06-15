"""
Celery background tasks for CommitIQ.

@shared_task = decorator from Celery that registers a function as a background job.
  - Django/webhook calls: process_commit.delay(commit_id)  → message goes to Redis
  - Worker process runs:  process_commit(commit_id)        → this file's code executes

The worker is a SEPARATE process from runserver (see docker-compose celery_worker service).
"""

import logging

# shared_task: marks a function as a Celery task without importing the Celery app directly.
from celery import shared_task  # pyright: ignore[reportMissingImports]
from django.utils import timezone

from . import analysis_services
from .models import AnalysisIssue, AnalysisJob, Commit

logger = logging.getLogger(__name__)


def _mark_job_failed(job, message):
    """Helper: set AnalysisJob to failed with timestamp and error text."""
    job.status = AnalysisJob.Status.FAILED
    job.error_message = message
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "error_message", "finished_at"])


def _save_issues(job, issue_dicts):
    """
    Replace all issues for a job with fresh results.

    We delete old rows first so retries do not duplicate issues.
    """
    job.issues.all().delete()
    for item in issue_dicts:
        AnalysisIssue.objects.create(
            job=job,
            severity=item["severity"],
            title=item["title"],
            file_path=item["file_path"],
            line_number=item.get("line_number"),
            description=item.get("description") or "",
            suggestion=item.get("suggestion") or "",
        )


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="repos.process_commit",
)
def process_commit(self, commit_id):
    """
    Main analysis pipeline — runs inside the Celery worker process.

    Steps:
      1. Load AnalysisJob + Commit from PostgreSQL
      2. Mark job RUNNING
      3. Fetch GitHub diff (needs owner's github_access_token)
      4. Save FileChange rows
      5. Run rule-based static analysis
      6. Save AnalysisIssue rows + compute risk_level
      7. Mark job DONE

    Args:
        self: Injected by bind=True — gives retry/countdown API (self.retry(...)).
        commit_id: Primary key of Commit row in our database (NOT the git SHA).

    On transient GitHub/network errors, Celery will retry up to max_retries times.
    """
    try:
        job = AnalysisJob.objects.select_related(
            "commit",
            "commit__repository",
            "commit__repository__owner",
        ).get(commit_id=commit_id)
    except AnalysisJob.DoesNotExist:
        logger.error("process_commit: no AnalysisJob for commit_id=%s", commit_id)
        return

    commit = job.commit
    repository = commit.repository
    owner = repository.owner

    # --- Step 1: mark running ---
    job.status = AnalysisJob.Status.RUNNING
    job.error_message = ""
    job.started_at = timezone.now()
    job.finished_at = None
    job.save(update_fields=["status", "error_message", "started_at", "finished_at"])

    token = owner.github_access_token
    if not token:
        _mark_job_failed(
            job,
            "GitHub token missing on user profile. Sign in with GitHub OAuth to analyze diffs.",
        )
        return

    try:
        # --- Step 2: GitHub diff ---
        diff_files, diff_error = analysis_services.fetch_commit_diff(
            token,
            repository.full_name,
            commit.sha,
        )
        if diff_error:
            raise RuntimeError(diff_error)

        # --- Step 3: persist file changes ---
        file_changes = analysis_services.save_file_changes(commit, diff_files)

        # --- Step 4: static analysis rules ---
        issue_dicts = analysis_services.analyze_file_changes(file_changes)
        _save_issues(job, issue_dicts)

        # --- Step 5: finalize job ---
        job.status = AnalysisJob.Status.DONE
        job.risk_level = analysis_services.compute_risk_level(issue_dicts)
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "risk_level", "finished_at"])

        logger.info(
            "process_commit done: commit=%s repo=%s risk=%s issues=%s",
            commit.sha[:7],
            repository.full_name,
            job.risk_level,
            len(issue_dicts),
        )

    except Exception as exc:
        logger.exception("process_commit failed for commit_id=%s", commit_id)

        # self.request.retries = how many times Celery already tried this task.
        if self.request.retries >= self.max_retries:
            _mark_job_failed(job, str(exc)[:2000])
            return

        # Not final failure yet — Celery will re-queue after default_retry_delay (60s).
        job.status = AnalysisJob.Status.PENDING
        job.save(update_fields=["status"])
        raise self.retry(exc=exc)


def enqueue_commit_analysis(commit):
    """
    Create (or reuse) an AnalysisJob and queue process_commit if appropriate.

    Called from webhook_views after saving commits — keeps webhook response fast.

    Rules:
      - get_or_create job per commit (OneToOne)
      - only enqueue if status is PENDING or FAILED (avoid duplicate queue spam)
      - process_commit.delay() sends JSON message to Redis; worker picks it up

    Args:
        commit: Commit model instance just saved from webhook.

    Returns:
        AnalysisJob instance (may already exist).
    """
    job, created = AnalysisJob.objects.get_or_create(
        commit=commit,
        defaults={"status": AnalysisJob.Status.PENDING},
    )

    if job.status in (AnalysisJob.Status.PENDING, AnalysisJob.Status.FAILED):
        # .delay() = Celery API: "run this task asynchronously via the broker (Redis)".
        process_commit.delay(commit.id)

    return job
