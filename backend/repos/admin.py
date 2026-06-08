from django.contrib import admin

from .models import Commit, Repository, UserProfile


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
