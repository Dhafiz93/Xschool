"""Factory applicative XSchool (EMS multi-ecoles)."""
from flask import Flask, jsonify

from config import get_config
from .extensions import cors, db, jwt, migrate


def create_app(config_object=None):
    app = Flask(__name__)
    app.config.from_object(config_object or get_config())

    _init_extensions(app)
    _register_blueprints(app)
    _register_jwt(app)
    _register_errorhandlers(app)
    _register_cli(app)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "xschool-backend"}

    return app


def _init_extensions(app):
    db.init_app(app)
    # IMPORTANT : importer les modeles avant migrate pour qu'Alembic les voie.
    from . import models  # noqa: F401

    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}})


def _register_blueprints(app):
    from .auth.routes import auth_bp
    from .api import api_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(api_bp, url_prefix="/api")


def _register_jwt(app):
    from .models.user import User

    @jwt.user_identity_loader
    def _identity(user):
        return str(user.id) if hasattr(user, "id") else str(user)

    @jwt.user_lookup_loader
    def _lookup(_jwt_header, jwt_data):
        return db.session.get(User, int(jwt_data["sub"]))

    @jwt.unauthorized_loader
    def _missing(reason):
        return jsonify(error="token_absent", detail=reason), 401

    @jwt.invalid_token_loader
    def _invalid(reason):
        return jsonify(error="token_invalide", detail=reason), 422

    @jwt.expired_token_loader
    def _expired(_h, _p):
        return jsonify(error="token_expire"), 401


def _register_errorhandlers(app):
    @app.errorhandler(400)
    def _400(e):
        return jsonify(error="requete_invalide", detail=str(e)), 400

    @app.errorhandler(403)
    def _403(e):
        return jsonify(error="acces_refuse", detail=str(e)), 403

    @app.errorhandler(404)
    def _404(e):
        return jsonify(error="introuvable", detail=str(e)), 404

    @app.errorhandler(500)
    def _500(e):
        db.session.rollback()
        return jsonify(error="erreur_serveur"), 500


def _register_cli(app):
    from .cli import register_cli
    from .seed import register_seed_cli

    register_cli(app)
    register_seed_cli(app)
