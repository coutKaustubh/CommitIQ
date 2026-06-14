# Generated manually for AnalysisJob, FileChange, AnalysisIssue models.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("repos", "0004_repository_github_webhook_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="AnalysisJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("done", "Done"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "risk_level",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="OK, WARNING, or CRITICAL — set by the Celery worker after static analysis.",
                        max_length=20,
                    ),
                ),
                (
                    "error_message",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="If status=failed, human-readable reason (e.g. missing GitHub token).",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                (
                    "commit",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="analysis_job",
                        to="repos.commit",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="FileChange",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file_path", models.CharField(max_length=512)),
                (
                    "status",
                    models.CharField(
                        help_text="GitHub status: added, modified, removed, renamed, etc.",
                        max_length=20,
                    ),
                ),
                ("additions", models.PositiveIntegerField(default=0)),
                ("deletions", models.PositiveIntegerField(default=0)),
                (
                    "patch",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="Unified diff text for this file — used by rule-based static analysis.",
                    ),
                ),
                (
                    "commit",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="file_changes",
                        to="repos.commit",
                    ),
                ),
            ],
            options={
                "ordering": ["file_path"],
            },
        ),
        migrations.CreateModel(
            name="AnalysisIssue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "severity",
                    models.CharField(
                        choices=[("OK", "OK"), ("WARNING", "Warning"), ("CRITICAL", "Critical")],
                        max_length=20,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("file_path", models.CharField(max_length=512)),
                ("line_number", models.PositiveIntegerField(blank=True, null=True)),
                ("description", models.TextField(blank=True, default="")),
                ("suggestion", models.TextField(blank=True, default="")),
                (
                    "job",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="issues",
                        to="repos.analysisjob",
                    ),
                ),
            ],
            options={
                "ordering": ["-severity", "file_path"],
            },
        ),
        migrations.AddConstraint(
            model_name="filechange",
            constraint=models.UniqueConstraint(
                fields=("commit", "file_path"),
                name="unique_file_change_per_commit",
            ),
        ),
    ]
