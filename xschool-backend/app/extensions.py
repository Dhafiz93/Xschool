"""Instances partagees des extensions Flask (importees partout, initialisees dans la factory)."""
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Classe de base declarative SQLAlchemy 2.x."""
    pass


db = SQLAlchemy(model_class=Base)
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
