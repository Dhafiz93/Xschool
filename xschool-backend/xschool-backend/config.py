"""Configuration de l'application, chargee depuis l'environnement (.env)."""
import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


def _bool(name, default=False):
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _normalize_db_url(url):
    """Force le driver psycopg3 attendu par SQLAlchemy 2.x.

    Les hebergeurs (Render, Railway, Heroku, Neon...) fournissent souvent une
    URL en 'postgres://' ou 'postgresql://' SANS driver. SQLAlchemy 2.0 refuse
    'postgres://', et on veut explicitement psycopg3 -> on reecrit le schema.
    """
    if not url:
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # SQLAlchemy
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://xschool:xschool@localhost:5432/xschool",
    ))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_MINUTES", "120"))
    )

    # CORS
    CORS_ORIGINS = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ]


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    DEBUG = False


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(os.getenv(
        "TEST_DATABASE_URL", "postgresql+psycopg://xschool:xschool@localhost:5432/xschool_test"
    ))


def get_config():
    env = os.getenv("FLASK_ENV", "development").lower()
    return {
        "development": DevelopmentConfig,
        "production": ProductionConfig,
        "testing": TestingConfig,
    }.get(env, DevelopmentConfig)
