"""Journal d'audit (lecture seule). Admin voit son ecole, superadmin voit tout."""
from datetime import datetime, timedelta, timezone

from flask import jsonify

from ..models.audit import AuditLog
from ..models.user import ROLE_ADMIN
from ..utils.audit import SECURITY_ACTIONS
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


@api_bp.get("/logs/suspects")
@role_required(ROLE_ADMIN)
def list_suspects():
    """Agrege les signaux d'abus recents par IP pour reperer les attaques.

    Regroupe les evenements de securite (echecs de login, acces refuses, rate
    limit, tokens invalides, erreurs serveur) des `hours` dernieres heures par
    adresse IP, avec le detail par type d'action. Les IP depassant `seuil`
    evenements sont marquees `suspect=true` : candidates ideales pour un
    blocage reseau / pare-feu. Admin -> son ecole ; superadmin -> tout.
    """
    hours = intval(arg("hours"), 24) or 24
    hours = max(1, min(hours, 24 * 30))
    seuil = intval(arg("seuil"), 10) or 10
    seuil = max(1, min(seuil, 10000))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    rows = (
        scoped_query(AuditLog)
        .filter(
            AuditLog.action.in_(SECURITY_ACTIONS),
            AuditLog.created_at >= since,
        )
        .order_by(AuditLog.id.desc())
        .all()
    )

    par_ip = {}
    for a in rows:
        ip = a.ip or "inconnue"
        bucket = par_ip.setdefault(ip, {
            "ip": ip, "total": 0, "par_action": {},
            "premier": None, "dernier": None,
        })
        bucket["total"] += 1
        bucket["par_action"][a.action] = bucket["par_action"].get(a.action, 0) + 1
        ts = a.created_at.isoformat() if a.created_at else None
        if ts:
            if bucket["dernier"] is None:
                bucket["dernier"] = ts
            bucket["premier"] = ts  # rows tries du plus recent au plus ancien
        if a.user_id is not None:
            bucket.setdefault("user_ids", set()).add(a.user_id)

    suspects = []
    for b in par_ip.values():
        b["user_ids"] = sorted(b.get("user_ids", set()))
        b["suspect"] = b["total"] >= seuil
        suspects.append(b)
    suspects.sort(key=lambda b: b["total"], reverse=True)

    return jsonify(
        fenetre_heures=hours,
        seuil=seuil,
        total_evenements=len(rows),
        total_ip=len(suspects),
        items=suspects,
    )
