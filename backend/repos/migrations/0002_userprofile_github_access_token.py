# Generated manually for Phase 1

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("repos", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="github_access_token",
            field=models.TextField(
                blank=True,
                default="",
                help_text="GitHub OAuth token from Supabase session (provider_token).",
            ),
        ),
    ]
