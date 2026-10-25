# XSchool backend — image de production (Flask + gunicorn + psycopg3)
FROM python:3.12-slim

# Reglages Python : pas de .pyc, logs non bufferises
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# psycopg[binary] n'exige pas de libpq systeme, mais on ajoute curl pour le healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# 1) Dependances (couche cache tant que requirements.txt ne change pas)
COPY requirements.txt .
RUN pip install -r requirements.txt

# 2) Code applicatif
COPY . .

# Entrypoint : prepare la base (migrations ou create-tables) puis lance gunicorn
RUN chmod +x /app/docker/entrypoint.sh

ENV FLASK_APP=wsgi.py \
    FLASK_ENV=production \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["gunicorn", "wsgi:app", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
