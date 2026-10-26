"""Enseignants (scope ecole)."""
from flask import jsonify

from ..extensions import db
from ..models.people import Teacher
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, body, commit, err, log_action, write_school_id

_FIELDS = ("nom", "prenom", "dob", "dip", "spec", "tel", "urg_nom", "urg_tel", "photo")


def _dict(t):
    return {
        "id": t.id, "nom": t.nom, "prenom": t.prenom, "full_name": t.full_name,
        "dob": t.dob, "dip": t.dip, "spec": t.spec, "tel": t.tel,
        "urg_nom": t.urg_nom, "urg_tel": t.urg_tel, "photo": t.photo,
        "subs": t.subs or [], "classes": t.classes or [],
    }


def _ids(v):
    """Normalise une valeur en liste d'entiers (ids)."""
    if not isinstance(v, list):
        return []
    out = []
    for x in v:
        try:
            out.append(int(x))
        except (TypeError, ValueError):
            pass
    return out


@api_bp.get("/teachers")
@role_required(*STAFF)
def list_teachers():
    rows = scoped_query(Teacher).order_by(Teacher.nom, Teacher.prenom).all()
    return jsonify(items=[_dict(t) for t in rows])


@api_bp.get("/teachers/<int:teacher_id>")
@role_required(*STAFF)
def get_teacher(teacher_id):
    return jsonify(teacher=_dict(get_scoped_or_404(Teacher, teacher_id)))


@api_bp.post("/teachers")
@role_required(ROLE_ADMIN)
def create_teacher():
    data = body()
    if not (data.get("nom") or "").strip():
        return err("nom_requis")
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    t = Teacher(school_id=sid, subs=_ids(data.get("subs")), classes=_ids(data.get("classes")))
    for f in _FIELDS:
        setattr(t, f, (data.get(f) or "").strip())
    db.session.add(t)
    log_action("create_teacher", "teachers", t.full_name)
    commit()
    return jsonify(teacher=_dict(t)), 201


@api_bp.put("/teachers/<int:teacher_id>")
@role_required(ROLE_ADMIN)
def update_teacher(teacher_id):
    t = get_scoped_or_404(Teacher, teacher_id)
    data = body()
    for f in _FIELDS:
        if f in data:
            setattr(t, f, (data.get(f) or "").strip())
    if "subs" in data:
        t.subs = _ids(data.get("subs"))
    if "classes" in data:
        t.classes = _ids(data.get("classes"))
    commit()
    return jsonify(teacher=_dict(t))


@api_bp.delete("/teachers/<int:teacher_id>")
@role_required(ROLE_ADMIN)
def delete_teacher(teacher_id):
    t = get_scoped_or_404(Teacher, teacher_id)
    log_action("delete_teacher", "teachers", t.full_name)
    db.session.delete(t)
    commit()
    return jsonify(status="ok")
