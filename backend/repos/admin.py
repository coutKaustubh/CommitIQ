from django.contrib import admin

from .models import Repository, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("email", "github_username", "supabase_user_id", "created_at")
    search_fields = ("email", "github_username", "supabase_user_id")
    readonly_fields = ("supabase_user_id", "created_at", "updated_at")


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ("full_name", "owner", "github_id", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("full_name", "owner__email")
