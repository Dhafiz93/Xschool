"""Garde-fous d'acces : exiger un role, exiger le superadmin."""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_current_user, verify_jwt_in_request

from .audit import record_security_event


def role_required(*roles):
    """Autorise seulement les utilisateurs dont le role est dans `roles`.

    Le superadmin passe toujours. S'utilise APRES @jwt_required (ou appelle
    verify_jwt_in_request lui-meme).
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = get_current_user()
            if user is None or not user.active:
                record_security_event(
                    "acces_refuse",
                    detail="compte absent ou inactif",
                    user_id=getattr(user, "id", None),
                    school_id=getattr(user, "school_id", None),
                )
                return jsonify(error="acces_refuse"), 403
            if user.is_superadmin:
                return fn(*args, **kwargs)
            if roles and user.role not in roles:
                record_security_event(
                    "acces_refuse",
                    detail="role={} requis={}".format(user.role, ",".join(roles)),
                    user_id=user.id,
                    school_id=user.school_id,
                )
                return jsonify(error="role_insuffisant", requis=list(roles)), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def superadmin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = get_current_user()
        if user is None or not user.is_superadmin:
            record_security_event(
                "acces_refuse",
                detail="superadmin requis",
                user_id=getattr(user, "id", None),
                school_id=getattr(user, "school_id", None),
            )
            return jsonify(error="superadmin_requis"), 403
        return fn(*args, **kwargs)

    return wrapper
