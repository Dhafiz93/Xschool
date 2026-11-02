"""Espace ELEVE : vue agregee en lecture seule pour le compte connecte.

Contexte : en mode connecte (donnees reelles), la demo est purgee et les
listes de reference (/classes, /students, /grades, ...) sont reservees au
STAFF (403 pour un eleve). L'espace Eleve se retrouvait donc vide dans TOUS
ses menus (dashboard, bulletin, presences, scolarite, profil).

Ce module expose UN endpoint eleve `GET /me/overview` qui renvoie, scopes a
l'eleve connecte uniquement (jamais les donnees d'autrui) :
  - sa fiche eleve + ses inscriptions,
  - sa (ses) classe(s) et le programme associe,
  - les matieres referencees,
  - ses notes, ses presences et ses paiements.

Le front hydrate les MEMES structures memoire que les vues lisent deja, sans
nouvelle logique d'affichage. Lecture seule : aucune ecriture ici.
"""
from flask import jsonify
from flask_jwt_extended import get_current_user

from ..extensions import db
from ..models.academics import Program, SchoolClass, Subject
from ..models.grades import Attendance, Grade
from ..models.finance import Payment
from ..models.people import Student
from ..models.user import ROLE_STUDENT
from ..utils.security import role_required
from ..utils.tenant import scoped_query
from . import api_bp
from .common import err

# On reutilise les serialiseurs existants (format identique aux listes STAFF,
# donc compatibles avec les mappeurs front mapApi*). Alias pour eviter les
# collisions de noms (_dict present dans plusieurs modules).
from .students import _dict as _student_dict
from .classes import _cls_dict
from .programs import _dict as _program_dict
from .subjects import _dict as _subject_dict
from .grades import _dict as _grade_dict
from .attendance import _dict as _attendance_dict
from .payments import _dict as _payment_dict


def _current_student():
    """Fiche eleve liee au compte courant (scopee ecole), ou None."""
    u = get_current_user()
    sid = getattr(u, "student_id", None)
    if not sid:
        return None
    return scoped_query(Student).filter(Student.id == sid).first()


def _class_ids_of(st):
    """Toutes les classes rattachees a l'eleve : classe courante + inscriptions."""
    ids = set()
    if st.class_id:
        ids.add(st.class_id)
    for e in (st.enrollments or []):
        if e.class_id:
            ids.add(e.class_id)
    return ids


@api_bp.get("/me/overview")
@role_required(ROLE_STUDENT)
def my_overview():
    """Vue agregee (lecture seule) de l'eleve connecte.

    Tout est scope a l'eleve : ses propres notes / presences / paiements, sa
    (ses) classe(s) et le programme correspondant. Un compte non lie a une
    fiche eleve recoit 403 (aucune donnee devinee).
    """
    st = _current_student()
    if st is None:
        return err("compte_non_lie_eleve", 403)

    class_ids = _class_ids_of(st)

    # Classes de l'eleve.
    classes = []
    if class_ids:
        classes = (scoped_query(SchoolClass)
                   .filter(SchoolClass.id.in_(class_ids)).all())

    # Programme (couples classe/matiere) des classes de l'eleve.
    programs = []
    if class_ids:
        programs = (scoped_query(Program)
                    .filter(Program.class_id.in_(class_ids)).all())

    # Notes / presences / paiements de l'eleve UNIQUEMENT.
    grades = scoped_query(Grade).filter(Grade.student_id == st.id).all()
    attendance = (scoped_query(Attendance)
                  .filter(Attendance.student_id == st.id).all())
    payments = (scoped_query(Payment)
                .filter(Payment.student_id == st.id).all())

    # Matieres referencees par le programme et les notes de l'eleve.
    subject_ids = {p.subject_id for p in programs if p.subject_id}
    subject_ids |= {g.subject_id for g in grades if g.subject_id}
    subjects = []
    if subject_ids:
        subjects = (scoped_query(Subject)
                    .filter(Subject.id.in_(subject_ids)).all())

    return jsonify(
        student=_student_dict(st),
        classes=[_cls_dict(c) for c in classes],
        programs=[_program_dict(p) for p in programs],
        subjects=[_subject_dict(s) for s in subjects],
        grades=[_grade_dict(g) for g in grades],
        attendance=[_attendance_dict(a) for a in attendance],
        payments=[_payment_dict(p) for p in payments],
    )
