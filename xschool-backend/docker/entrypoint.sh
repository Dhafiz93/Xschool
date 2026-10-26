#!/usr/bin/env sh
# Prepare la base puis demarre le serveur.
# - Attend que PostgreSQL reponde.
# - Si des migrations existent (migrations/versions/*.py) -> flask db upgrade.
#   Sinon -> flask create-tables (db.create_all, demarrage rapide).
# - Si SEED_DEMO=1 -> flask seed (jeu de donnees de demo, idempotent).
set -e

export FLASK_APP="${FLASK_APP:-wsgi.py}"

# 1) Attendre la base (max ~60s) en testant la connexion applicative.
echo "[entrypoint] Attente de la base de donnees..."
i=0
until python - <<'PY' 2>/dev/null
from app import create_app
from app.extensions import db
app = create_app()
with app.app_context():
    db.session.execute(db.text("SELECT 1"))
PY
do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] Base injoignable apres 60s, on continue quand meme..."
    break
  fi
  sleep 2
done

# 2) Schema : migrations si disponibles, sinon create_all.
if ls migrations/versions/*.py >/dev/null 2>&1; then
  echo "[entrypoint] Migrations detectees -> flask db upgrade"
  flask db upgrade
else
  echo "[entrypoint] Aucune migration -> flask create-tables"
  flask create-tables
fi

# 3) Seed optionnel.
if [ "${SEED_DEMO:-0}" = "1" ]; then
  echo "[entrypoint] SEED_DEMO=1 -> flask seed"
  flask seed || echo "[entrypoint] seed ignore (deja peuple ?)"
fi

echo "[entrypoint] Demarrage : $*"
exec "$@"
