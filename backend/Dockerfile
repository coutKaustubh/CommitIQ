# Backend Docker image for Django API + Celery worker (same image, different command in compose).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# libpq-dev + gcc: needed to build psycopg2-binary on slim images if wheels fail.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default when running container without compose override (compose sets runserver / celery worker).
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
