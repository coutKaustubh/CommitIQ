from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("repos", "0005_analysisjob_filechange_analysisissue"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="github_display_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="GitHub profile name (user.name); falls back to github_username in UI.",
                max_length=255,
            ),
        ),
    ]
