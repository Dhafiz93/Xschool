"""Eleves (scope ecole) + inscriptions par annee."""
from flask import abort, jsonify

from ..extensions import db
from ..models.people import Enrollment, Student
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import (current_school_id, get_scoped_or_404, scoped_query,
                            teacher_scope_ids)
from . import api_bp
from .common import STAFF, arg, body, commit, err, intval, log_action, write_school_id


def _enr_dict(e):
    return {"id": e.id, "year": e.year, "class_id": e.class_id,
            "statut": e.statut, "regime": e.regime}


def _dict(s, with_enr=True, with_contacts=True):
    d = {
        "id": s.id, "matricule": s.matricule, "nom": s.nom, "prenom": s.prenom,
        "full_name": s.full_name, "sexe": s.sexe, "dob": s.dob, "lieu": s.lieu,
        "pere": s.pere, "contact_pere": s.contact_pere,
        "mere": s.mere, "contact_mere": s.contact_mere,
        "photo": s.photo, "class_id": s.class_id,
    }
    if not with_contacts:
        # Enseignant : on masque les coordonnees des parents (PII) ; les cles
        # restent presentes (vides) pour ne pas casser le front.
        d["contact_pere"] = ""
        d["contact_mere"] = ""
    if with_enr:
        d["enrollments"] = [_enr_dict(e) for e in s.enrollments]
    return d


def _teacher_class_scope():
    """class_ids du perimetre de l'enseignant courant, ou None lorsqu'il n'y a
    aucune restriction a appliquer (admin / surveillant / superadmin)."""
    class_ids, _subject_ids = teacher_scope_ids()
    return class_ids


def _student_in_scope(s, class_ids):
    """True si l'eleve releve d'une classe du perimetre : sa classe de base ou
    l'une de ses inscriptions."""
    if s.class_id in class_ids:
        return True
    return any(e.class_id in class_ids for e in s.enrollments)


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
    # Enseignant : confiner aux eleves de ses classes et masquer les contacts
    # des parents ; admin / surveillant / superadmin voient tout.
    class_ids = _teacher_class_scope()
    if class_ids is not None:
        rows = [s for s in rows if _student_in_scope(s, class_ids)]
    show_contacts = class_ids is None
    return jsonify(items=[_dict(s, with_enr=False, with_contacts=show_contacts)
                          for s in rows])


@api_bp.get("/students/<int:student_id>")
@role_required(*STAFF)
def get_student(student_id):
    s = get_scoped_or_404(Student, student_id)
    # Enseignant : un eleve hors perimetre est refuse en 404 (pas d'oracle) et
    # les contacts des parents sont masques.
    class_ids = _teacher_class_scope()
    if class_ids is not None and not _student_in_scope(s, class_ids):
        abort(404)
    return jsonify(student=_dict(s, with_contacts=(class_ids is None)))


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
    log_action("update_student", "students", s.full_name)
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
    log_action("save_enrollment", "students",
               f"{s.full_name} / {year}")
    commit()
    return jsonify(enrollment=_enr_dict(e)), 201
