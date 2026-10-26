"""Matieres (scope ecole)."""
from flask import jsonify

from ..extensions import db
from ..models.academics import DOMAINS, Subject
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, body, commit, err, write_school_id


def _dict(s):
    return {"id": s.id, "name": s.name, "dom": s.dom}


@api_bp.get("/subjects")
@role_required(*STAFF)
def list_subjects():
    rows = scoped_query(Subject).order_by(Subject.name).all()
    return jsonify(items=[_dict(s) for s in rows])


@api_bp.post("/subjects")
@role_required(ROLE_ADMIN)
def create_subject():
    data = body()
    name = (data.get("name") or "").strip()
    if not name:
        return err("nom_requis")
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    dom = (data.get("dom") or "autre").strip()
    if dom not in DOMAINS:
        dom = "autre"
    s = Subject(school_id=sid, name=name, dom=dom)
    db.session.add(s)
    commit()
    return jsonify(subject=_dict(s)), 201


@api_bp.put("/subjects/<int:subject_id>")
@role_required(ROLE_ADMIN)
def update_subject(subject_id):
    s = get_scoped_or_404(Subject, subject_id)
    data = body()
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return err("nom_requis")
        s.name = name
    if "dom" in data:
        dom = (data.get("dom") or "autre").strip()
        s.dom = dom if dom in DOMAINS else "autre"
    commit()
    return jsonify(subject=_dict(s))


@api_bp.delete("/subjects/<int:subject_id>")
@role_required(ROLE_ADMIN)
def delete_subject(subject_id):
    s = get_scoped_or_404(Subject, subject_id)
    db.session.delete(s)
    commit()
    return jsonify(status="ok")
