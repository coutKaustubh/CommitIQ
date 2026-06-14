from django.urls import path

from . import analysis_views, views

urlpatterns = [
    path("github/", views.list_github_repos, name="repos-github-list"),
    path("connected/", views.list_connected_repos, name="repos-connected-list"),
    path("connect/", views.connect_repo, name="repos-connect"),
    path("disconnect/", views.disconnect_repo, name="repos-disconnect"),
    path("retry-webhook/", views.retry_repo_webhook, name="repos-retry-webhook"),
    # Analysis API (Celery pipeline results) — must stay BEFORE <int:repo_id> routes
    path(
        "analysis/jobs/<int:job_id>/",
        analysis_views.get_analysis_job,
        name="repos-analysis-job",
    ),
    path(
        "analysis/retry/",
        analysis_views.retry_analysis,
        name="repos-analysis-retry",
    ),
    path(
        "commits/recent-analysis/",
        analysis_views.recent_analysis_feed,
        name="repos-recent-analysis",
    ),
    path(
        "commits/<str:sha>/analysis/",
        analysis_views.get_commit_analysis,
        name="repos-commit-analysis",
    ),
    path("<int:repo_id>/commits/", views.list_repo_commits, name="repos-commits"),
]
