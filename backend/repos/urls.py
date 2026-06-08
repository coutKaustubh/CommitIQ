from django.urls import path

from . import views

urlpatterns = [
    path("github/", views.list_github_repos, name="repos-github-list"),
    path("connected/", views.list_connected_repos, name="repos-connected-list"),
    path("connect/", views.connect_repo, name="repos-connect"),
    path("disconnect/", views.disconnect_repo, name="repos-disconnect"),
    path("retry-webhook/", views.retry_repo_webhook, name="repos-retry-webhook"),
    path("<int:repo_id>/commits/", views.list_repo_commits, name="repos-commits"),
]
