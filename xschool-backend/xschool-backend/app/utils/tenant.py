"""Isolation multi-tenant : chaque requete metier est filtree par school_id.

Regle : ne JAMAIS requeter une entite rattachee a une ecole sans passer par
`scoped_query` (ou en filtrant explicitement sur current_school_id).
"""
from flask import abort
from flask_jwt_extended import get_current_user

from ..extensions import db


def current_school_id():
    """Retourne l'ecole de l'utilisateur courant (None pour le superadmin)."""
    user = get_current_user()
    return getattr(user, "school_id", None) if user else None


def scoped_query(model):
    """Query du modele deja filtree sur l'ecole de l'utilisateur.

    Le superadmin (school_id nul) voit tout ; les autres sont confines a leur
    ecole. Le modele doit exposer une colonne `school_id`.
    """
    q = db.session.query(model)
    sid = current_school_id()
    if sid is not None:
        q = q.filter(model.school_id == sid)
    return q


def get_scoped_or_404(model, obj_id):
    obj = scoped_query(model).filter(model.id == obj_id).first()
    if obj is None:
        abort(404)
    return obj
