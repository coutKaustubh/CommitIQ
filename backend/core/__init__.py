"""
Load Celery when Django starts (optional until `pip install celery redis`).

If Celery is not installed yet, Django runserver/migrate still work —
only background tasks and `celery -A core worker` need the package.
"""

try:
    from .celery import app as celery_app
except ImportError:
    celery_app = None

__all__ = ("celery_app",)
