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
