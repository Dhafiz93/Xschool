"""Classes de l'ecole courante (filtrees par school_id). Exemple de ressource scopee."""
from datetime import date

from flask import jsonify, request

from ..extensions import db
from ..models.academics import SchoolClass
from ..models.people import Student
from ..models.school import School, SchoolConfig
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import current_school_id, get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF


def _cls_dict(c):
    return {
        "id": c.id, "cycle": c.cycle, "name": c.name,
        "grp": c.grp, "spec": c.spec,
    }


@api_bp.get("/classes")
@role_required(ROLE_ADMIN)
def list_classes():
    rows = scoped_query(SchoolClass).order_by(SchoolClass.cycle, SchoolClass.name).all()
    return jsonify(items=[_cls_dict(c) for c in rows])


@api_bp.post("/classes")
@role_required(ROLE_ADMIN)
def create_class():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    cycle = (data.get("cycle") or "").strip()
    if not name or not cycle:
        return jsonify(error="nom_et_cycle_requis"), 400

    c = SchoolClass(
        school_id=current_school_id(),
        cycle=cycle,
        name=name,
        grp=(data.get("grp") or "").strip(),
        spec=(data.get("spec") or "").strip(),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(klass=_cls_dict(c)), 201


@api_bp.delete("/classes/<int:class_id>")
@role_required(ROLE_ADMIN)
def delete_class(class_id):
    c = get_scoped_or_404(SchoolClass, class_id)
    db.session.delete(c)
    db.session.commit()
    return jsonify(status="ok")


def _current_school_year():
    """Annee scolaire courante au format AAAA-AAAA (bascule en aout)."""
    today = date.today()
    start = today.year if today.month >= 8 else today.year - 1
    return f"{start}-{start + 1}"


@api_bp.get("/classes/<int:class_id>/cards")
@role_required(*STAFF)
def class_cards(class_id):
    """Donnees de carte scolaire pour tous les eleves d'une classe.

    Le rendu visuel (et le QR) est produit cote client ; on renvoie ici
    l'identite de l'ecole, la classe et un bloc par eleve, sans migration
    (le numero de carte est derive du matricule / de l'annee).
    """
    c = get_scoped_or_404(SchoolClass, class_id)
    school = db.session.get(School, c.school_id)
    cfg = (
        db.session.query(SchoolConfig)
        .filter(SchoolConfig.school_id == c.school_id)
        .first()
    )
    year = _current_school_year()
    slug = (school.slug if school else "xs") or "xs"

    students = (
        db.session.query(Student)
        .filter(Student.school_id == c.school_id, Student.class_id == c.id)
        .order_by(Student.nom, Student.prenom)
        .all()
    )

    cards = []
    for s in students:
        enr = next((e for e in s.enrollments if e.year == year), None)
        ref = (s.matricule or str(s.id)).upper()
        card_no = f"{slug.upper()}-{year[:4]}-{ref}"
        qr = "|".join([
            "XSCHOOL-CARD", slug, str(s.id), s.matricule or "",
            s.full_name or "", c.name or "", year,
        ])
        cards.append({
            "student_id": s.id,
            "matricule": s.matricule or "",
            "full_name": s.full_name,
            "nom": s.nom,
            "prenom": s.prenom,
            "sexe": s.sexe or "",
            "dob": s.dob or "",
            "lieu": s.lieu or "",
            "photo": s.photo or "",
            "regime": (enr.regime if enr else ""),
            "statut": (enr.statut if enr else ""),
            "card_no": card_no,
            "qr": qr,
        })

    school_block = {
        "name": (school.name if school else ""),
        "slug": slug,
    }
    if cfg:
        school_block.update({
            "logo": cfg.logo or "",
            "address": cfg.address or "",
            "phone": cfg.phone or "",
            "email": cfg.email or "",
            "director": cfg.director or "",
        })

    klass = {
        "id": c.id, "cycle": c.cycle, "name": c.name,
        "grp": c.grp, "spec": c.spec,
    }
    return jsonify(school=school_block, klass=klass, year=year, cards=cards)
