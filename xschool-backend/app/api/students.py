"""Eleves (scope ecole) + inscriptions par annee."""
from flask import jsonify

from ..extensions import db
from ..models.people import Enrollment, Student
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import current_school_id, get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg, body, commit, err, intval, log_action, write_school_id


def _enr_dict(e):
    return {"id": e.id, "year": e.year, "class_id": e.class_id,
            "statut": e.statut, "regime": e.regime}


def _dict(s, with_enr=True):
    d = {
        "id": s.id, "matricule": s.matricule, "nom": s.nom, "prenom": s.prenom,
        "full_name": s.full_name, "sexe": s.sexe, "dob": s.dob, "lieu": s.lieu,
        "pere": s.pere, "contact_pere": s.contact_pere,
        "mere": s.mere, "contact_mere": s.contact_mere,
        "photo": s.photo, "class_id": s.class_id,
    }
    if with_enr:
        d["enrollments"] = [_enr_dict(e) for e in s.enrollments]
    return d


_FIELDS = ("matricule", "nom", "prenom", "sexe", "dob", "lieu",
           "pere", "contact_pere", "mere", "contact_mere", "photo")


@api_bp.get("/students")
@role_required(*STAFF)
def list_students():
    q = scoped_query(Student)
    cid = intval(arg("class_id"))
    if cid is not None:
        q = q.filter(Student.class_id == cid)
    term = (arg("q") or "").strip().lower()
    rows = q.order_by(Student.nom, Student.prenom).all()
    if term:
        rows = [s for s in rows
                if term in (s.nom or "").lower()
                or term in (s.prenom or "").lower()
                or term in (s.matricule or "").lower()]
    return jsonify(items=[_dict(s, with_enr=False) for s in rows])


@api_bp.get("/students/<int:student_id>")
@role_required(*STAFF)
def get_student(student_id):
    s = get_scoped_or_404(Student, student_id)
    return jsonify(student=_dict(s))


@api_bp.post("/students")
@role_required(ROLE_ADMIN)
def create_student():
    data = body()
    if not (data.get("nom") or "").strip():
        return err("nom_requis")
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    s = Student(school_id=sid, class_id=intval(data.get("class_id")))
    for f in _FIELDS:
        setattr(s, f, (data.get(f) or "").strip())
    db.session.add(s)
    db.session.flush()
    # inscription initiale optionnelle (year + class_id)
    year = (data.get("year") or "").strip()
    if year:
        db.session.add(Enrollment(
            school_id=sid, student_id=s.id, year=year,
            class_id=s.class_id, statut=(data.get("statut") or "").strip()))
    log_action("create_student", "students", s.full_name)
    commit()
    return jsonify(student=_dict(s)), 201


@api_bp.put("/students/<int:student_id>")
@role_required(ROLE_ADMIN)
def update_student(student_id):
    s = get_scoped_or_404(Student, student_id)
    data = body()
    for f in _FIELDS:
        if f in data:
            setattr(s, f, (data.get(f) or "").strip())
    if "class_id" in data:
        s.class_id = intval(data.get("class_id"))
    commit()
    return jsonify(student=_dict(s))


@api_bp.delete("/students/<int:student_id>")
@role_required(ROLE_ADMIN)
def delete_student(student_id):
    s = get_scoped_or_404(Student, student_id)
    log_action("delete_student", "students", s.full_name)
    db.session.delete(s)
    commit()
    return jsonify(status="ok")


# --- Inscriptions (enrollments) d'un eleve ---
@api_bp.post("/students/<int:student_id>/enrollments")
@role_required(ROLE_ADMIN)
def upsert_enrollment(student_id):
    s = get_scoped_or_404(Student, student_id)
    data = body()
    year = (data.get("year") or "").strip()
    if not year:
        return err("annee_requise")
    e = next((x for x in s.enrollments if x.year == year), None)
    if e is None:
        e = Enrollment(school_id=s.school_id, student_id=s.id, year=year)
        db.session.add(e)
    if "class_id" in data:
        e.class_id = intval(data.get("class_id"))
    if "statut" in data:
        e.statut = (data.get("statut") or "").strip()
    if "regime" in data:
        e.regime = (data.get("regime") or "").strip()
    commit()
    return jsonify(enrollment=_enr_dict(e)), 201
