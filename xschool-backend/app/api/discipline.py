"""Discipline : incidents par eleve (date, motif, gravite)."""
from flask import jsonify

from ..extensions import db
from ..models.grades import Discipline
from ..models.user import ROLE_ADMIN, ROLE_SUPERVISOR
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg, body, commit, err, intval, log_action, write_school_id


def _dict(d):
    return {"id": d.id, "student_id": d.student_id, "date": d.date,
            "motif": d.motif, "gravite": d.gravite}


@api_bp.get("/discipline")
@role_required(*STAFF)
def list_discipline():
    q = scoped_query(Discipline)
    stid = intval(arg("student_id"))
    if stid is not None:
        q = q.filter(Discipline.student_id == stid)
    return jsonify(items=[_dict(d) for d in q.order_by(Discipline.date.desc()).all()])


@api_bp.post("/discipline")
@role_required(ROLE_ADMIN, ROLE_SUPERVISOR)
def create_discipline():
    data = body()
    stid = intval(data.get("student_id"))
    if stid is None:
        return err("eleve_requis")
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    d = Discipline(
        school_id=sid, student_id=stid,
        date=(data.get("date") or "").strip(),
        motif=(data.get("motif") or "").strip(),
        gravite=(data.get("gravite") or "").strip(),
    )
    db.session.add(d)
    log_action("create_discipline", "discipline", d.motif)
    commit()
    return jsonify(discipline=_dict(d)), 201


@api_bp.delete("/discipline/<int:disc_id>")
@role_required(ROLE_ADMIN, ROLE_SUPERVISOR)
def delete_discipline(disc_id):
    d = get_scoped_or_404(Discipline, disc_id)
    log_action("delete_discipline", "discipline", d.motif)
    db.session.delete(d)
    commit()
    return jsonify(status="ok")
