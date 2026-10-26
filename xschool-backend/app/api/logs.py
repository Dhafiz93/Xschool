"""Journal d'audit (lecture seule). Admin voit son ecole, superadmin voit tout."""
from flask import jsonify

from ..models.audit import AuditLog
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import scoped_query
from . import api_bp
from .common import arg, intval


def _dict(a):
    return {
        "id": a.id, "school_id": a.school_id, "user_id": a.user_id,
        "action": a.action, "target": a.target, "detail": a.detail,
        "ip": a.ip,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@api_bp.get("/logs")
@role_required(ROLE_ADMIN)
def list_logs():
    # scoped_query filtre sur school_id pour l'admin ; le superadmin voit tout.
    q = scoped_query(AuditLog).order_by(AuditLog.id.desc())
    limit = intval(arg("limit"), 200) or 200
    limit = max(1, min(limit, 1000))
    rows = q.limit(limit).all()
    return jsonify(items=[_dict(a) for a in rows])
