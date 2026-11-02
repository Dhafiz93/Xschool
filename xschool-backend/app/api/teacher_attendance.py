"""Pointage de presence des ENSEIGNANTS (present|retard|absent).

La table ne persiste que le statut de presence par (enseignant, date). Les
heures prevues / realisees sont calculees cote front a partir de l'emploi du
temps ; le serveur n'a besoin que du statut.
"""
from flask import jsonify

from ..extensions import db
from ..models.grades import TeacherAttendance
from ..models.user import ROLE_ADMIN, ROLE_TEACHER
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg, body, commit, err, intval, log_action, write_school_id

_STATUS = {"present", "retard", "absent"}


def _dict(a):
    return {"id": a.id, "teacher_id": a.teacher_id, "date": a.date, "status": a.status}


@api_bp.get("/teacher-attendance")
@role_required(*STAFF)
def list_teacher_attendance():
    q = scoped_query(TeacherAttendance)
    tid = intval(arg("teacher_id"))
    if tid is not None:
        q = q.filter(TeacherAttendance.teacher_id == tid)
    if arg("date"):
        q = q.filter(TeacherAttendance.date == arg("date"))
    if arg("from"):
        q = q.filter(TeacherAttendance.date >= arg("from"))
    if arg("to"):
        q = q.filter(TeacherAttendance.date <= arg("to"))
    return jsonify(items=[_dict(a) for a in q.order_by(TeacherAttendance.date).all()])


def _save_one(data, sid):
    tid = intval(data.get("teacher_id"))
    date = (data.get("date") or "").strip()
    if tid is None or not date:
        return None, "champs_requis: teacher_id, date"
    status = (data.get("status") or "present").strip()
    if status not in _STATUS:
        status = "present"
    a = scoped_query(TeacherAttendance).filter(
        TeacherAttendance.teacher_id == tid,
        TeacherAttendance.date == date,
    ).first()
    # 'present' = valeur par defaut : on ne garde pas de ligne inutile.
    if status == "present":
        if a is not None:
            db.session.delete(a)
        return None, None
    if a is None:
        a = TeacherAttendance(school_id=sid, teacher_id=tid, date=date)
        db.session.add(a)
    a.status = status
    return a, None


@api_bp.post("/teacher-attendance")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def save_teacher_attendance():
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
            if a is not None:
                out.append(a)
        log_action("save_teacher_attendance", "teacher_attendance",
                   f"{len(data['items'])} pointage(s) enregistre(s)")
        commit()
        return jsonify(items=[_dict(a) for a in out]), 201
    a, e = _save_one(data, sid)
    if e:
        return err(e)
    log_action("save_teacher_attendance", "teacher_attendance",
               f"enseignant {data.get('teacher_id')} / {data.get('date')}")
    commit()
    return jsonify(attendance=(_dict(a) if a is not None else None)), 201


@api_bp.delete("/teacher-attendance/<int:att_id>")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def delete_teacher_attendance(att_id):
    a = get_scoped_or_404(TeacherAttendance, att_id)
    log_action("delete_teacher_attendance", "teacher_attendance",
               f"enseignant {a.teacher_id} / {a.date}")
    db.session.delete(a)
    commit()
    return jsonify(status="ok")
