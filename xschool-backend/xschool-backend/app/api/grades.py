"""Notes : lignes (classe, matiere, periode, eleve, annee). Upsert cle unique."""
from flask import jsonify

from ..extensions import db
from ..models.grades import Grade
from ..models.user import ROLE_ADMIN, ROLE_TEACHER
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg, as_float, body, commit, err, intval, write_school_id


def _dict(g):
    return {
        "id": g.id, "year": g.year, "period": g.period, "class_id": g.class_id,
        "subject_id": g.subject_id, "student_id": g.student_id,
        "detail": g.detail or [], "moy": as_float(g.moy),
    }


@api_bp.get("/grades")
@role_required(*STAFF)
def list_grades():
    q = scoped_query(Grade)
    for field, col in (("class_id", Grade.class_id), ("subject_id", Grade.subject_id),
                       ("student_id", Grade.student_id)):
        v = intval(arg(field))
        if v is not None:
            q = q.filter(col == v)
    if arg("period"):
        q = q.filter(Grade.period == arg("period"))
    if arg("year"):
        q = q.filter(Grade.year == arg("year"))
    return jsonify(items=[_dict(g) for g in q.all()])


def _upsert_one(data, sid):
    year = (data.get("year") or "").strip()
    period = (data.get("period") or "").strip()
    cid = intval(data.get("class_id"))
    subid = intval(data.get("subject_id"))
    stid = intval(data.get("student_id"))
    if not year or not period or None in (cid, subid, stid):
        return None, "champs_requis: year, period, class_id, subject_id, student_id"
    g = scoped_query(Grade).filter(
        Grade.year == year, Grade.period == period, Grade.class_id == cid,
        Grade.subject_id == subid, Grade.student_id == stid).first()
    if g is None:
        g = Grade(school_id=sid, year=year, period=period,
                  class_id=cid, subject_id=subid, student_id=stid)
        db.session.add(g)
    if "detail" in data:
        g.detail = data.get("detail") if isinstance(data.get("detail"), list) else []
    if "moy" in data:
        g.moy = as_float(data.get("moy"))
    return g, None


@api_bp.post("/grades")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def save_grades():
    data = body()
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    # mode lot : {"items": [ ... ]}
    if isinstance(data.get("items"), list):
        out = []
        for item in data["items"]:
            payload = dict(item)
            payload.setdefault("school_id", sid)
            g, e = _upsert_one(payload, sid)
            if e:
                return err(e)
            out.append(g)
        commit()
        return jsonify(items=[_dict(g) for g in out]), 201
    g, e = _upsert_one(data, sid)
    if e:
        return err(e)
    commit()
    return jsonify(grade=_dict(g)), 201


@api_bp.delete("/grades/<int:grade_id>")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def delete_grade(grade_id):
    g = get_scoped_or_404(Grade, grade_id)
    db.session.delete(g)
    commit()
    return jsonify(status="ok")
