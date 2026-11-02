"""Factory applicative XSchool (L'ecole connectee - multi-etablissements)."""
import os

from flask import Flask, jsonify, send_from_directory, abort

from config import get_config
from .extensions import cors, db, jwt, limiter, migrate


def create_app(config_object=None):
    app = Flask(__name__)
    app.config.from_object(config_object or get_config())

    _check_secrets(app)
    _init_extensions(app)
    _register_blueprints(app)
    _register_jwt(app)
    _register_errorhandlers(app)
    _register_security_headers(app)
    _register_cli(app)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "xschool-backend"}

    _register_frontend(app)

    return app


def _check_secrets(app):
    """Refuse de demarrer en production avec des secrets faibles.

    SECRET_KEY et JWT_SECRET_KEY signent les sessions et les jetons d'acces :
    s'ils gardent une valeur par defaut / placeholder, n'importe qui peut forger
    un JWT valide. En dev/test on tolere les defauts (demarrage rapide) ; en
    production on exige des secrets definis explicitement et non triviaux.
    """
    weak = {
        "", "dev-secret-change-me", "change-moi-en-prod",
        "change-moi-aussi-en-prod",
    }

    def _is_weak(v):
        v = (v or "").strip()
        return v in weak or v.lower().startswith("change-moi") or len(v) < 16

    is_prod = not app.config.get("DEBUG") and not app.config.get("TESTING")
    if not is_prod:
        return
    faibles = [name for name in ("SECRET_KEY", "JWT_SECRET_KEY")
               if _is_weak(app.config.get(name))]
    if faibles:
        raise RuntimeError(
            "Secrets non securises en production : " + ", ".join(faibles)
            + ". Definis des valeurs aleatoires d'au moins 16 caracteres dans "
            + "l'environnement (ex. `python -c \"import secrets; "
            + "print(secrets.token_urlsafe(48))\"`)."
        )
    if app.config.get("CORS_ORIGINS") == ["*"]:
        app.logger.warning(
            "CORS_ORIGINS='*' en production : restreins aux domaines du front."
        )


def _init_extensions(app):
    db.init_app(app)
    # IMPORTANT : importer les modeles avant migrate pour qu'Alembic les voie.
    from . import models  # noqa: F401

    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    # L'authentification passe par l'en-tete `Authorization: Bearer <jwt>`, PAS
    # par un cookie de session -> supports_credentials reste False : on n'a
    # jamais besoin que le navigateur envoie des cookies cross-origin, ce qui
    # evite d'avoir a renvoyer Access-Control-Allow-Credentials avec une origine
    # permissive. En production, limite CORS_ORIGINS aux domaines du front.
    cors.init_app(
        app,
        resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=False,
    )


def _register_security_headers(app):
    """Ajoute les en-tetes de securite HTTP sur toutes les reponses.

    - X-Content-Type-Options : empeche le MIME-sniffing.
    - X-Frame-Options + CSP frame-ancestors : anti-clickjacking (pas d'iframe).
    - Referrer-Policy : ne fuit pas l'URL complete vers les tiers.
    - Permissions-Policy : coupe les API sensibles du navigateur non utilisees.
    - Strict-Transport-Security : force HTTPS (production uniquement).
    - Content-Security-Policy : restreint les sources de scripts/styles/images.
      La valeur par defaut est calibree pour le front existant (Tailwind Play
      CDN qui compile a la volee -> 'unsafe-eval', scripts inline -> 'unsafe-
      inline', Google Fonts, jsDelivr, photos en data-URL). Surchargeable via la
      variable d'env CONTENT_SECURITY_POLICY ; mettre 'off' pour la desactiver.
    """
    default_csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "https://cdn.tailwindcss.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'"
    )
    csp = os.getenv("CONTENT_SECURITY_POLICY", default_csp)
    is_prod = not app.config.get("DEBUG") and not app.config.get("TESTING")

    @app.after_request
    def _apply_security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        # X-XSS-Protection est obsolete : on le neutralise explicitement.
        resp.headers.setdefault("X-XSS-Protection", "0")
        if csp and csp.lower() != "off":
            resp.headers.setdefault("Content-Security-Policy", csp)
        if is_prod:
            resp.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return resp


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
        from .utils.audit import record_security_event
        # JWT malforme ou signature invalide = signal d'abus (tentative de
        # forge), a distinguer d'un simple token expire (flux normal, non trace).
        record_security_event("token_invalide", detail=str(reason)[:200])
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

    @app.errorhandler(429)
    def _429(e):
        # Leve par Flask-Limiter quand une limite est depassee.
        from .utils.audit import record_security_event
        detail = getattr(e, "description", "limite de requetes atteinte")
        record_security_event("rate_limit", detail=str(detail)[:200])
        return jsonify(error="trop_de_requetes", detail=detail), 429

    @app.errorhandler(500)
    def _500(e):
        from .utils.audit import record_security_event
        db.session.rollback()
        # Trace serveur complete (stacktrace) pour l'audit des erreurs + une
        # ligne d'audit succincte pour correler avec d'eventuels abus.
        app.logger.exception("Erreur serveur non geree")
        record_security_event("erreur_serveur", detail=str(e)[:200])
        return jsonify(error="erreur_serveur"), 500


def _register_cli(app):
    from .cli import register_cli
    from .seed import register_seed_cli

    register_cli(app)
    register_seed_cli(app)


def _register_frontend(app):
    """Sert le frontend statique (SPA) depuis le backend, sur la meme origine.

    Resultat : l'application ne tourne plus en mode prototype hors-ligne. Elle
    parle directement a l'API (meme domaine), donc chaque utilisateur cree via
    l'espace SuperAdmin peut se connecter en conditions reelles.
    """
    frontend_dir = app.config.get("FRONTEND_DIR")
    if not frontend_dir or not os.path.isdir(frontend_dir):
        return
    index_file = os.path.join(frontend_dir, "index.html")
    if not os.path.isfile(index_file):
        return

    @app.get("/")
    def _frontend_index():
        return send_from_directory(frontend_dir, "index.html")

    @app.get("/<path:filename>")
    def _frontend_assets(filename):
        # Ne jamais court-circuiter l'API / l'auth / le health-check.
        if filename.startswith(("api/", "auth/")) or filename == "health":
            abort(404)
        full = os.path.join(frontend_dir, filename)
        if os.path.isfile(full):
            return send_from_directory(frontend_dir, filename)
        # Fallback SPA : toute autre route renvoie l'application.
        return send_from_directory(frontend_dir, "index.html")
