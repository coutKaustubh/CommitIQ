from django.db import models


class UserProfile(models.Model):
    """
    Bridge between Supabase auth and our app data.
    supabase_user_id matches request.supabase_user.id from middleware.
    """

    supabase_user_id = models.UUIDField(unique=True)
    email = models.EmailField()
    github_username = models.CharField(max_length=255, blank=True, default="")
    github_access_token = models.TextField(
        blank=True,
        default="",
        help_text="GitHub OAuth token from Supabase session (provider_token).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email or str(self.supabase_user_id)


class Repository(models.Model):
    """
    A GitHub repo the user connected to CommitIQ.
    """

    owner = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name="repositories",
    )
    github_id = models.BigIntegerField()
    full_name = models.CharField(max_length=255, help_text="e.g. username/repo-name")
    is_active = models.BooleanField(default=True)
    github_webhook_id = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="GitHub hook id — set when push webhook is registered on connect.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "full_name"],
                name="unique_repo_per_user",
            ),
        ]

    def __str__(self):
        return self.full_name


class Commit(models.Model):
    """A commit on a connected repository (synced from GitHub)."""

    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        related_name="commits",
    )
    sha = models.CharField(max_length=40)
    message = models.TextField()
    author_name = models.CharField(max_length=255, blank=True, default="")
    committed_at = models.DateTimeField()
    html_url = models.URLField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-committed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "sha"],
                name="unique_commit_per_repo",
            ),
        ]

    def __str__(self):
        return f"{self.repository.full_name}@{self.sha[:7]}"
