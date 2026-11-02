"""Classes de l'ecole courante (filtrees par school_id). Exemple de ressource scopee."""
from datetime import date

from flask import jsonify, request

from ..extensions import db
from ..models.academics import SchoolClass
from ..models.people import Student, Teacher
from ..models.school import School, SchoolConfig
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import (current_school_id, get_scoped_or_404,
                            scoped_query, teacher_scope_ids)
from . import api_bp
from .common import STAFF, err, log_action


def _cls_dict(c):
    return {
        "id": c.id, "cycle": c.cycle, "name": c.name,
        "grp": c.grp, "spec": c.spec,
        "titulaire_id": c.titulaire_id,
        "titulaires_by_year": c.titulaires_by_year or {},
    }


def _apply_titulaire(c, tit, year):
    """Applique l'affectation du titulaire a la classe `c`.

    - Si `year` est fourni : l'affectation est scopee a cette annee scolaire
      (map `titulaires_by_year`). `tit is None` retire le titulaire de l'annee.
    - Sinon : on met a jour le titulaire "par defaut" (`titulaire_id`, retro-compat).
    JSONB n'est pas suivi en mutation in-place -> on reaffecte un nouveau dict.
    """
    if year:
        mapping = dict(c.titulaires_by_year or {})
        if tit is None:
            mapping.pop(year, None)
        else:
            mapping[year] = tit
        c.titulaires_by_year = mapping
    else:
        c.titulaire_id = tit


def _resolve_titulaire(data, school_id):
    """Normalise la valeur `titulaire_id` du payload.

    Renvoie (valeur, erreur). `valeur` vaut None (aucun titulaire) ou l'id d'un
    enseignant appartenant a la meme ecole. Toute autre valeur => (None, reponse
    d'erreur) pour empecher d'affecter un enseignant d'un autre etablissement.
    """
    if "titulaire_id" not in data:
        return (False, None)  # champ absent : ne rien changer
    raw = data.get("titulaire_id")
    if raw in (None, "", 0, "0"):
        return (None, None)   # titulaire retire
    try:
        tid = int(raw)
    except (TypeError, ValueError):
        return (None, err("titulaire_invalide"))
    t = db.session.get(Teacher, tid)
    if t is None or t.school_id != school_id:
        return (None, err("titulaire_introuvable"))
    return (tid, None)


@api_bp.get("/classes")
@role_required(*STAFF)
def list_classes():
    q = scoped_query(SchoolClass)
    # Un enseignant ne voit que les classes ou il intervient.
    class_ids, _ = teacher_scope_ids()
    if class_ids is not None:
        if not class_ids:
            return jsonify(items=[])
        q = q.filter(SchoolClass.id.in_(class_ids))
    rows = q.order_by(SchoolClass.cycle, SchoolClass.name).all()
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
    tit, tit_err = _resolve_titulaire(data, c.school_id)
    if tit_err is not None:
        return tit_err
    if tit is not False:
        _apply_titulaire(c, tit, (data.get("year") or "").strip())
    db.session.add(c)
    log_action("create_class", "classes", f"{c.cycle} {c.name}".strip())
    db.session.commit()
    return jsonify(klass=_cls_dict(c)), 201


@api_bp.put("/classes/<int:class_id>")
@role_required(ROLE_ADMIN)
def update_class(class_id):
    """Met a jour une classe (notamment l'affectation du titulaire).

    Les champs d'identite (name/grp/spec) sont modifiables si fournis ; le champ
    `titulaire_id` affecte/retire l'enseignant titulaire (null ou 0 => retire).
    """
    c = get_scoped_or_404(SchoolClass, class_id)
    data = request.get_json(silent=True) or {}
    for f in ("name", "grp", "spec"):
        if f in data:
            setattr(c, f, (data.get(f) or "").strip())
    tit, tit_err = _resolve_titulaire(data, c.school_id)
    if tit_err is not None:
        return tit_err
    if tit is not False:
        _apply_titulaire(c, tit, (data.get("year") or "").strip())
    log_action("update_class", "classes", f"{c.cycle} {c.name}".strip())
    db.session.commit()
    return jsonify(klass=_cls_dict(c))


@api_bp.delete("/classes/<int:class_id>")
@role_required(ROLE_ADMIN)
def delete_class(class_id):
    c = get_scoped_or_404(SchoolClass, class_id)
    log_action("delete_class", "classes", f"{c.cycle} {c.name}".strip())
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
