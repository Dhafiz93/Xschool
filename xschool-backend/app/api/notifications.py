"""Notifications en page (cloche) de l'utilisateur connecte.

Chaque utilisateur (enseignant comme eleve) lit SES propres notifications et
peut les marquer comme lues. Aucune fuite inter-utilisateur : tout est filtre
sur l'id du compte courant.

Routes :
  GET  /api/notifications            -> liste (option ?unread=1, ?limit=N)
  GET  /api/notifications/count      -> nombre de non-lues (pour la pastille)
  POST /api/notifications/read       -> marque lues ({ids:[...]} ou toutes)
"""
from flask import jsonify
from flask_jwt_extended import get_current_user, jwt_required

from ..extensions import db
from ..models.exercise import Notification
from ..services import notify_center
from . import api_bp
from .common import arg, body, boolval, commit, intval


def _dict(n):
    return {
        "id": n.id, "kind": n.kind, "title": n.title, "body": n.body,
        "ref_type": n.ref_type, "ref_id": n.ref_id, "lu": bool(n.lu),
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@api_bp.get("/notifications")
@jwt_required()
def list_notifications():
    user = get_current_user()
    q = (db.session.query(Notification)
         .filter(Notification.user_id == user.id))
    if boolval(arg("unread"), False):
        q = q.filter(Notification.lu.is_(False))
    q = q.order_by(Notification.created_at.desc())
    limit = intval(arg("limit"), 50) or 50
    rows = q.limit(min(max(limit, 1), 200)).all()
    unread = (db.session.query(Notification)
              .filter(Notification.user_id == user.id,
                      Notification.lu.is_(False)).count())
    return jsonify(items=[_dict(n) for n in rows], unread=unread)


@api_bp.get("/notifications/count")
@jwt_required()
def notifications_count():
    user = get_current_user()
    unread = (db.session.query(Notification)
              .filter(Notification.user_id == user.id,
                      Notification.lu.is_(False)).count())
    return jsonify(unread=unread)


@api_bp.post("/notifications/read")
@jwt_required()
def mark_notifications_read():
    """Marque comme lues : {ids:[...]} pour un sous-ensemble, sinon toutes."""
    user = get_current_user()
    data = body()
    ids = data.get("ids")
    ids = [int(i) for i in ids] if isinstance(ids, list) else None
    n = notify_center.mark_read(user.id, ids)
    commit()
    return jsonify(ok=True, marked=n)
