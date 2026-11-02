# rebuild_db.py  (dans xschool-backend\, lancer une fois puis supprimer)
from app import create_app, db

app = create_app()
with app.app_context():
    # DEMO UNIQUEMENT — efface tout le schema et le recree a neuf
    db.session.execute(db.text("DROP SCHEMA public CASCADE"))
    db.session.execute(db.text("CREATE SCHEMA public"))
    db.session.commit()
    # recree toutes les tables a partir des modeles (password_hash inclus)
    db.create_all()
    print("Schema reconstruit depuis les modeles. OK.")