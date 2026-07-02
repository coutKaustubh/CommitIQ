"""
Celery application bootstrap for CommitIQ.

Celery = third-party Python library for background tasks (like a job queue runner).
Redis   = message broker where Django drops "run this task" messages; workers pick them up.

This file creates the Celery *app* object and wires it to Django settings (CELERY_* in settings.py).
The worker process runs: celery -A core worker -l info
"""

import os

from core.ml_env import configure_ml_runtime

configure_ml_runtime()

# Celery's main class — you create one app per Django project.
from celery import Celery

# Tell Celery which Django settings module to load (same as manage.py / wsgi.py).
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# "commitiq" is just a label for this Celery app (logging / monitoring).
app = Celery("commitiq")

# Read CELERY_BROKER_URL, CELERY_RESULT_BACKEND, etc. from django.conf.settings.
# namespace="CELERY" means settings keys must be prefixed with CELERY_ in settings.py.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Scan every INSTALLED_APPS app for tasks.py and register @shared_task functions.
# That is how repos.tasks.process_commit gets discovered without manual imports.
app.autodiscover_tasks()
