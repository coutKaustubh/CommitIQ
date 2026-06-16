from django.db import models


class UserProfile(models.Model):
    """
    Bridge between Supabase auth and our app data.
    supabase_user_id matches request.supabase_user.id from middleware.
    """

    supabase_user_id = models.UUIDField(unique=True)
    email = models.EmailField()
    github_username = models.CharField(max_length=255, blank=True, default="")
    github_display_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="GitHub profile name (user.name); falls back to github_username in UI.",
    )
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


class AnalysisJob(models.Model):
    """
    Tracks background analysis for a single commit.

    One commit → one job (OneToOne). The Celery worker moves status through:
    pending → running → done (or failed). Frontend polls this row for UI state.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    commit = models.OneToOneField(
        Commit,
        on_delete=models.CASCADE,
        related_name="analysis_job",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    risk_level = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="OK, WARNING, or CRITICAL — set by the Celery worker after static analysis.",
    )
    error_message = models.TextField(
        blank=True,
        default="",
        help_text="If status=failed, human-readable reason (e.g. missing GitHub token).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AnalysisJob({self.commit.sha[:7]} — {self.status})"


class FileChange(models.Model):
    """
    One row per file changed in a commit (from GitHub diff API).

    The worker saves these before running static analysis rules on each patch.
    """

    commit = models.ForeignKey(
        Commit,
        on_delete=models.CASCADE,
        related_name="file_changes",
    )
    file_path = models.CharField(max_length=512)
    status = models.CharField(
        max_length=20,
        help_text="GitHub status: added, modified, removed, renamed, etc.",
    )
    additions = models.PositiveIntegerField(default=0)
    deletions = models.PositiveIntegerField(default=0)
    patch = models.TextField(
        blank=True,
        default="",
        help_text="Unified diff text for this file — used by rule-based static analysis.",
    )

    class Meta:
        ordering = ["file_path"]
        constraints = [
            models.UniqueConstraint(
                fields=["commit", "file_path"],
                name="unique_file_change_per_commit",
            ),
        ]

    def __str__(self):
        return f"{self.file_path} ({self.status})"


class AnalysisIssue(models.Model):
    """
    A single problem found by static analysis (N+1 query, large diff, sensitive file, etc.).

    Linked to AnalysisJob (not Commit directly) so retry clears/rebuilds issues cleanly.
    """

    class Severity(models.TextChoices):
        OK = "OK", "OK"
        WARNING = "WARNING", "Warning"
        CRITICAL = "CRITICAL", "Critical"

    job = models.ForeignKey(
        AnalysisJob,
        on_delete=models.CASCADE,
        related_name="issues",
    )
    severity = models.CharField(max_length=20, choices=Severity.choices)
    title = models.CharField(max_length=255)
    file_path = models.CharField(max_length=512)
    line_number = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True, default="")
    suggestion = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-severity", "file_path"]

    def __str__(self):
        return f"{self.severity}: {self.title}"
