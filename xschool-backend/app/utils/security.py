"""Garde-fous d'acces : exiger un role, exiger le superadmin."""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_current_user, verify_jwt_in_request


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
                return jsonify(error="acces_refuse"), 403
            if user.is_superadmin:
                return fn(*args, **kwargs)
            if roles and user.role not in roles:
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
            return jsonify(error="superadmin_requis"), 403
        return fn(*args, **kwargs)

    return wrapper
