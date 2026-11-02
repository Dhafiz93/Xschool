"""Programme : affectation matiere -> classe (coef, obligatoire, specialite)."""
from flask import jsonify

from ..extensions import db
from ..models.academics import Program, SchoolClass, Subject
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query, teacher_scope_ids
from . import api_bp
from .common import STAFF, arg, as_float, body, boolval, commit, err, intval, log_action, write_school_id


def _dict(p):
    return {
        "id": p.id, "class_id": p.class_id, "subject_id": p.subject_id,
        "coef": as_float(p.coef), "oblig": bool(p.oblig), "spec": bool(p.spec),
    }


@api_bp.get("/programs")
@role_required(*STAFF)
def list_programs():
    q = scoped_query(Program)
    cid = intval(arg("class_id"))
    if cid is not None:
        q = q.filter(Program.class_id == cid)
    # Un enseignant ne voit que les lignes de programme de SES classes et de
    # SES matieres (les couples classe/matiere ou il intervient).
    class_ids, subject_ids = teacher_scope_ids()
    if class_ids is not None:
        if not class_ids or not subject_ids:
            return jsonify(items=[])
        q = q.filter(Program.class_id.in_(class_ids),
                     Program.subject_id.in_(subject_ids))
    rows = q.order_by(Program.class_id, Program.subject_id).all()
    return jsonify(items=[_dict(p) for p in rows])


@api_bp.post("/programs")
@role_required(ROLE_ADMIN)
def create_program():
    data = body()
    cid, subid = intval(data.get("class_id")), intval(data.get("subject_id"))
    if cid is None or subid is None:
        return err("classe_et_matiere_requises")
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    # garde-fou : classe et matiere doivent appartenir a l'ecole
    get_scoped_or_404(SchoolClass, cid)
    get_scoped_or_404(Subject, subid)
    p = scoped_query(Program).filter(
        Program.class_id == cid, Program.subject_id == subid).first()
    if p is None:
        p = Program(school_id=sid, class_id=cid, subject_id=subid)
        db.session.add(p)
    p.coef = as_float(data.get("coef")) or 1
    p.oblig = boolval(data.get("oblig"), True)
    p.spec = boolval(data.get("spec"), False)
    log_action("save_program", "programs",
               f"classe {p.class_id} / matiere {p.subject_id}")
    commit()
    return jsonify(program=_dict(p)), 201


@api_bp.put("/programs/<int:program_id>")
@role_required(ROLE_ADMIN)
def update_program(program_id):
    p = get_scoped_or_404(Program, program_id)
    data = body()
    if "coef" in data:
        p.coef = as_float(data.get("coef")) or 1
    if "oblig" in data:
        p.oblig = boolval(data.get("oblig"), True)
    if "spec" in data:
        p.spec = boolval(data.get("spec"), False)
    log_action("update_program", "programs",
               f"classe {p.class_id} / matiere {p.subject_id}")
    commit()
    return jsonify(program=_dict(p))


@api_bp.delete("/programs/<int:program_id>")
@role_required(ROLE_ADMIN)
def delete_program(program_id):
    p = get_scoped_or_404(Program, program_id)
    log_action("delete_program", "programs",
               f"classe {p.class_id} / matiere {p.subject_id}")
    db.session.delete(p)
    commit()
    return jsonify(status="ok")
