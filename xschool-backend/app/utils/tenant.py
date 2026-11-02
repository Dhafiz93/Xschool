"""Isolation multi-tenant : chaque requete metier est filtree par school_id.

Regle : ne JAMAIS requeter une entite rattachee a une ecole sans passer par
`scoped_query` (ou en filtrant explicitement sur current_school_id).
"""
from flask import abort
from flask_jwt_extended import get_current_user

from ..extensions import db


def current_school_id():
    """Retourne l'ecole de l'utilisateur courant (None pour le superadmin)."""
    user = get_current_user()
    return getattr(user, "school_id", None) if user else None


def scoped_query(model):
    """Query du modele deja filtree sur l'ecole de l'utilisateur.

    Le superadmin (school_id nul) voit tout ; les autres sont confines a leur
    ecole. Le modele doit exposer une colonne `school_id`.
    """
    q = db.session.query(model)
    sid = current_school_id()
    if sid is not None:
        q = q.filter(model.school_id == sid)
    return q


def get_scoped_or_404(model, obj_id):
    obj = scoped_query(model).filter(model.id == obj_id).first()
    if obj is None:
        abort(404)
    return obj


# --------------------------------------------------------------------------
# Perimetre d'un ENSEIGNANT : il ne voit que les classes et matieres ou il
# intervient. Les listes `classes` / `subs` de la fiche enseignant (JSONB)
# portent les ids concernes. L'admin, le surveillant et le superadmin ne sont
# PAS restreints (ils gardent la vue complete de l'ecole).
# --------------------------------------------------------------------------
def current_teacher():
    """Fiche enseignant liee au compte courant, ou None.

    None dans tous les cas ou il n'y a pas de restriction a appliquer :
    compte admin / surveillant / superadmin, ou enseignant non rattache a une
    fiche (teacher_id absent).
    """
    from ..models.people import Teacher
    from ..models.user import ROLE_TEACHER

    user = get_current_user()
    if not user or getattr(user, "role", None) != ROLE_TEACHER:
        return None
    tid = getattr(user, "teacher_id", None)
    if not tid:
        return None
    return db.session.query(Teacher).filter(Teacher.id == tid).first()


def _as_id_set(values):
    """Convertit une liste JSONB d'ids (int ou str) en set d'int, en ignorant
    les valeurs vides / non numeriques."""
    out = set()
    for v in (values or []):
        try:
            if v is None or str(v).strip() == "":
                continue
            out.add(int(v))
        except (TypeError, ValueError):
            continue
    return out


def teacher_scope_ids():
    """Perimetre de l'enseignant courant.

    Renvoie (class_ids, subject_ids) :
      - (None, None)  -> AUCUNE restriction (admin / surveillant / superadmin) ;
      - (set, set)    -> l'enseignant est limite a ces classes / matieres
                         (un set vide = il n'intervient nulle part -> rien a
                         afficher).
    """
    t = current_teacher()
    if t is None:
        return None, None
    return _as_id_set(t.classes), _as_id_set(t.subs)
