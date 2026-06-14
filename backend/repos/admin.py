from django.contrib import admin

from .models import AnalysisIssue, AnalysisJob, Commit, FileChange, Repository, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("email", "github_username", "supabase_user_id", "created_at")
    search_fields = ("email", "github_username", "supabase_user_id")
    readonly_fields = ("supabase_user_id", "created_at", "updated_at")


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ("full_name", "owner", "github_id", "github_webhook_id", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("full_name", "owner__email")


@admin.register(Commit)
class CommitAdmin(admin.ModelAdmin):
    list_display = ("short_sha_display", "repository", "author_name", "committed_at")
    list_filter = ("repository",)
    search_fields = ("sha", "message", "repository__full_name")
    readonly_fields = ("sha", "created_at")

    @admin.display(description="SHA")
    def short_sha_display(self, obj):
        return obj.sha[:7]


@admin.register(AnalysisJob)
class AnalysisJobAdmin(admin.ModelAdmin):
    list_display = ("id", "commit_short_sha", "status", "risk_level", "created_at", "finished_at")
    list_filter = ("status", "risk_level")
    search_fields = ("commit__sha", "commit__repository__full_name")
    readonly_fields = ("created_at", "started_at", "finished_at")

    @admin.display(description="Commit")
    def commit_short_sha(self, obj):
        return obj.commit.sha[:7]


@admin.register(FileChange)
class FileChangeAdmin(admin.ModelAdmin):
    list_display = ("file_path", "commit_short_sha", "status", "additions", "deletions")
    list_filter = ("status",)
    search_fields = ("file_path", "commit__sha")

    @admin.display(description="Commit")
    def commit_short_sha(self, obj):
        return obj.commit.sha[:7]


@admin.register(AnalysisIssue)
class AnalysisIssueAdmin(admin.ModelAdmin):
    list_display = ("title", "severity", "file_path", "job_id", "line_number")
    list_filter = ("severity",)
    search_fields = ("title", "file_path", "job__commit__sha")
