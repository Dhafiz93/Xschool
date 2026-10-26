"""Appel / presence (present|retard|absent)."""
from flask import jsonify

from ..extensions import db
from ..models.grades import Attendance
from ..models.user import ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_TEACHER
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg, body, commit, err, intval, write_school_id

_STATUS = {"present", "retard", "absent"}


def _dict(a):
    return {"id": a.id, "student_id": a.student_id, "class_id": a.class_id,
            "date": a.date, "status": a.status}


@api_bp.get("/attendance")
@role_required(*STAFF)
def list_attendance():
    q = scoped_query(Attendance)
    cid = intval(arg("class_id"))
    if cid is not None:
        q = q.filter(Attendance.class_id == cid)
    stid = intval(arg("student_id"))
    if stid is not None:
        q = q.filter(Attendance.student_id == stid)
    if arg("date"):
        q = q.filter(Attendance.date == arg("date"))
    return jsonify(items=[_dict(a) for a in q.order_by(Attendance.date).all()])


def _save_one(data, sid):
    stid = intval(data.get("student_id"))
    cid = intval(data.get("class_id"))
    date = (data.get("date") or "").strip()
    if None in (stid, cid) or not date:
        return None, "champs_requis: student_id, class_id, date"
    status = (data.get("status") or "present").strip()
    if status not in _STATUS:
        status = "present"
    a = scoped_query(Attendance).filter(
        Attendance.student_id == stid, Attendance.class_id == cid,
        Attendance.date == date).first()
    if a is None:
        a = Attendance(school_id=sid, student_id=stid, class_id=cid, date=date)
        db.session.add(a)
    a.status = status
    return a, None


@api_bp.post("/attendance")
@role_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_SUPERVISOR)
def save_attendance():
    data = body()
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    if isinstance(data.get("items"), list):
        out = []
        for item in data["items"]:
            a, e = _save_one(item, sid)
            if e:
                return err(e)
            out.append(a)
        commit()
        return jsonify(items=[_dict(a) for a in out]), 201
    a, e = _save_one(data, sid)
    if e:
        return err(e)
    commit()
    return jsonify(attendance=_dict(a)), 201


@api_bp.delete("/attendance/<int:att_id>")
@role_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_SUPERVISOR)
def delete_attendance(att_id):
    a = get_scoped_or_404(Attendance, att_id)
    db.session.delete(a)
    commit()
    return jsonify(status="ok")
