"""Reconstruit le schema de la base XSchool directement depuis les modeles.

USAGE (dans le dossier xschool-backend, puis supprimer le fichier) :
    python rebuild_db.py
    flask seed

    ATTENTION DEMO UNIQUEMENT : efface TOUTES les donnees (DROP SCHEMA public CASCADE).
    Ne JAMAIS lancer sur une base de production.

Pourquoi : contourne Alembic (pointeur fantome / migration partielle). db.create_all()
lit directement les modeles SQLAlchemy et recree toutes les colonnes (dont
users.password_hash). La DATABASE_URL est lue depuis le .env via la factory Flask.
"""
from app import create_app
from app.extensions import db


def main():
    app = create_app()
    with app.app_context():
        url = str(db.engine.url)
        # Garde-fou : on refuse d'ecraser une base dont le nom evoque la prod.
        if any(mot in url.lower() for mot in ("prod", "production")):
            raise SystemExit(
                "ABANDON : la base ressemble a de la PROD (%s). "
                "Script reserve a la demo." % url
            )

        print("Base ciblee :", url)
        print("Suppression et recreation du schema public...")
        db.session.execute(db.text("DROP SCHEMA public CASCADE"))
        db.session.execute(db.text("CREATE SCHEMA public"))
        db.session.commit()

        print("Creation des tables depuis les modeles (db.create_all)...")
        db.create_all()

        # Verification : la colonne users.password_hash doit exister.
        from sqlalchemy import inspect
        cols = [c["name"] for c in inspect(db.engine).get_columns("users")]
        if "password_hash" not in cols:
            raise SystemExit(
                "ECHEC : users.password_hash absent apres create_all. "
                "Colonnes trouvees : %s" % cols
            )

        print("OK : schema reconstruit, users.password_hash present.")
        print("Etape suivante -> flask seed")


if __name__ == "__main__":
    main()
