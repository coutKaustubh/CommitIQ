# Generated for Phase 3

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("repos", "0002_userprofile_github_access_token"),
    ]

    operations = [
        migrations.CreateModel(
            name="Commit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sha", models.CharField(max_length=40)),
                ("message", models.TextField()),
                ("author_name", models.CharField(blank=True, default="", max_length=255)),
                ("committed_at", models.DateTimeField()),
                ("html_url", models.URLField(blank=True, default="", max_length=512)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "repository",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="commits",
                        to="repos.repository",
                    ),
                ),
            ],
            options={
                "ordering": ["-committed_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="commit",
            constraint=models.UniqueConstraint(
                fields=("repository", "sha"),
                name="unique_commit_per_repo",
            ),
        ),
    ]
