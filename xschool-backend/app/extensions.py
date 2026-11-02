"""Instances partagees des extensions Flask (importees partout, initialisees dans la factory)."""
from flask import request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Classe de base declarative SQLAlchemy 2.x."""
    pass


def client_ip_key():
    """Clef de rate limiting = IP reelle du client.

    Derriere un reverse-proxy, `remote_addr` vaut l'IP du proxy : on prend donc
    la premiere entree de `X-Forwarded-For` quand elle est presente (meme
    logique que l'audit d'authentification). A n'utiliser que derriere un proxy
    de confiance, car cet en-tete est falsifiable par le client en direct.
    """
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()[:45]
    return get_remote_address()


db = SQLAlchemy(model_class=Base)
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
# Le stockage (memory:// par defaut) et l'activation sont lus depuis la config
# / l'environnement au moment de init_app (RATELIMIT_STORAGE_URI, etc.).
limiter = Limiter(key_func=client_ip_key)
