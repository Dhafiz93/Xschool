"""Authentification : login par email, profil courant."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_current_user, jwt_required

from ..extensions import db
from ..models.user import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify(error="email_et_mot_de_passe_requis"), 400

    user = db.session.query(User).filter(User.email == email).first()
    if user is None or not user.active or not user.check_password(password):
        return jsonify(error="identifiants_invalides"), 401

    token = create_access_token(identity=user)
    return jsonify(access_token=token, user=user.to_dict())


@auth_bp.get("/me")
@jwt_required()
def me():
    user = get_current_user()
    return jsonify(user=user.to_dict())


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    data = request.get_json(silent=True) or {}
    old = data.get("old_password") or ""
    new = data.get("new_password") or ""
    user = get_current_user()
    if not user.check_password(old):
        return jsonify(error="ancien_mot_de_passe_invalide"), 400
    if len(new) < 8:
        return jsonify(error="mot_de_passe_trop_court", min=8), 400
    user.set_password(new)
    db.session.commit()
    return jsonify(status="ok")
