"""Helpers partages par les routes API : corps JSON, school_id de creation,
conversions numeriques, journal d'audit.
"""
from flask import jsonify, request
from flask_jwt_extended import get_current_user

from ..extensions import db
from ..models.audit import AuditLog
from ..models.user import ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_TEACHER
from ..utils.tenant import current_school_id

# Jeux de roles reutilisables (le superadmin passe toujours via role_required).
STAFF = (ROLE_ADMIN, ROLE_TEACHER, ROLE_SUPERVISOR)


def body():
    """Corps JSON de la requete (dict), jamais None."""
    return request.get_json(silent=True) or {}


def arg(name, default=None):
    """Parametre de query string."""
    return request.args.get(name, default)


def write_school_id(data):
    """school_id a utiliser pour une creation.

    - utilisateur rattache a une ecole -> son ecole ;
    - superadmin (school_id nul) -> champ `school_id` du payload, sinon None.
    """
    sid = current_school_id()
    if sid is None:
        try:
            sid = int(data.get("school_id")) if data.get("school_id") not in (None, "") else None
        except (TypeError, ValueError):
            sid = None
    return sid


def intval(v, default=None):
    try:
        if v is None or v == "":
            return default
        return int(v)
    except (TypeError, ValueError):
        return default


def numval(v, default=None):
    try:
        if v is None or v == "":
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def boolval(v, default=False):
    if isinstance(v, bool):
        return v
    if v is None:
        return default
    return str(v).strip().lower() in {"1", "true", "yes", "on", "oui"}


def as_float(v):
    """Convertit un Numeric SQLAlchemy (Decimal) en float JSON, ou None."""
    return None if v is None else float(v)


def commit():
    db.session.commit()


def log_action(action, target="", detail=""):
    """Ecrit une ligne de journal d'audit pour l'utilisateur courant."""
    user = get_current_user()
    db.session.add(AuditLog(
        school_id=current_school_id(),
        user_id=getattr(user, "id", None),
        action=action, target=target, detail=detail,
        ip=(request.headers.get("X-Forwarded-For", request.remote_addr) or "")[:45],
    ))


def err(message, code=400, **extra):
    payload = {"error": message}
    payload.update(extra)
    return jsonify(payload), code
