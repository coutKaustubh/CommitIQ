from django.urls import path

from . import views

urlpatterns = [
    path("github/", views.list_github_repos, name="repos-github-list"),
]
