# reset_alembic.py  (a mettre dans xschool-backend\, lancer une fois puis supprimer)
from app import create_app, db

app = create_app()
with app.app_context():
    db.session.execute(db.text("DROP TABLE IF EXISTS alembic_version"))
    db.session.commit()
    print("Pointeur alembic_version supprime. OK.")