"""Enregistrement des jetons d'appareil pour les notifications push.

L'appli mobile / le navigateur obtient un jeton aupres de son service push
(FCM, Web Push...) puis l'enregistre ici. A la deconnexion ou quand le jeton
change, il le retire. Les jetons servent ensuite a `notify_center.notify_users`
pour pousser les memes notifications que la cloche et l'email.

Routes :
  POST /api/push/subscribe     {token, platform?}  -> enregistre / reactive
  POST /api/push/unsubscribe   {token}             -> desactive
  GET  /api/push/status                            -> etat du transport (diag)
"""
from datetime import datetime, timezone

from flask import jsonify
from flask_jwt_extended import get_current_user, jwt_required

from ..extensions import db
from ..models.device import DeviceToken
from ..services import push as push_service
from . import api_bp
from .common import body, commit, err

_PLATFORMS = {"web", "android", "ios"}


@api_bp.post("/push/subscribe")
@jwt_required()
def push_subscribe():
    """Enregistre (ou reactive) le jeton d'appareil du compte connecte.

    Le jeton etant unique, s'il existait deja (meme sur un autre compte, cas
    d'un appareil partage), il est reaffecte a l'utilisateur courant.
    """
    user = get_current_user()
    data = body()
    token = (data.get("token") or "").strip()
    if not token:
        return err("token_manquant")
    platform = (data.get("platform") or "web").strip().lower()
    if platform not in _PLATFORMS:
        platform = "web"

    now = datetime.now(timezone.utc)
    row = (db.session.query(DeviceToken)
           .filter(DeviceToken.token == token).first())
    if row is None:
        row = DeviceToken(
            token=token, platform=platform, user_id=user.id,
            school_id=getattr(user, "school_id", None),
            active=True, last_used_at=now)
        db.session.add(row)
    else:
        row.user_id = user.id
        row.school_id = getattr(user, "school_id", None)
        row.platform = platform
        row.active = True
        row.last_used_at = now
    commit()
    return jsonify(ok=True)


@api_bp.post("/push/unsubscribe")
@jwt_required()
def push_unsubscribe():
    """Desactive un jeton d'appareil du compte connecte (desinscription)."""
    user = get_current_user()
    data = body()
    token = (data.get("token") or "").strip()
    if not token:
        return err("token_manquant")
    row = (db.session.query(DeviceToken)
           .filter(DeviceToken.token == token,
                   DeviceToken.user_id == user.id).first())
    if row is not None:
        row.active = False
        commit()
    return jsonify(ok=True)


@api_bp.get("/push/status")
@jwt_required()
def push_status():
    """Etat du transport push (sans secret), pour le diagnostic cote client."""
    return jsonify(push_service.status())
