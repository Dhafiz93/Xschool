"""Liste des utilisateurs (comptes).

Regle d'isolation :
  - un ADMIN d'ecole ne voit que les comptes de SON ecole ;
  - le SUPERADMIN voit tout, et peut restreindre a une ecole via ?school_id=<id>
    (ou ?school_id=all pour tout voir, comportement par defaut).

C'est ce qui permet au front, lorsqu'on selectionne une ecole, de n'afficher
que les utilisateurs de cette ecole.
"""
import re

from flask import jsonify

from ..extensions import db
from ..models.people import Student, Teacher
from ..models.user import (
    ROLE_ADMIN, ROLE_SUPERADMIN, ROLE_SUPERVISOR, ROLE_TEACHER, ROLE_STUDENT, User,
)
from ..utils.security import role_required
from ..utils.tenant import current_school_id, scoped_query
from flask_jwt_extended import get_current_user
from . import api_bp
from .common import arg, body, boolval, intval, log_action

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_LOGIN_RE = re.compile(r"^[a-z0-9._-]{3,80}$")

# Roles qu'un administrateur peut creer depuis l'ecran "Utilisateurs".
# "comptable" n'est pas un role de controle d'acces backend (il est gere par le
# modele de permissions du front) ; on l'accepte comme valeur stockee.
_CREATABLE_ROLES = {ROLE_ADMIN, ROLE_TEACHER, ROLE_SUPERVISOR, ROLE_STUDENT, "comptable"}


@api_bp.get("/users")
@role_required(ROLE_ADMIN)
def list_users():
    # scoped_query confine deja l'admin a son ecole ; le superadmin voit tout.
    q = scoped_query(User)

    # Le superadmin (aucune ecole rattachee) peut filtrer sur une ecole precise.
    if current_school_id() is None:
        raw = arg("school_id")
        if raw not in (None, "", "all"):
            sid = intval(raw)
            if sid is not None:
                q = q.filter(User.school_id == sid)

    rows = q.order_by(User.school_id, User.role, User.full_name).all()
    return jsonify(items=[u.to_dict() for u in rows])


@api_bp.post("/users")
@role_required(ROLE_ADMIN)
def create_user():
    """Cree un compte utilisateur AVEC mot de passe (scope ecole).

    Corps JSON attendu :
      full_name : nom complet                         (obligatoire)
      email     : email de connexion                 (obligatoire, unique)
      password  : mot de passe (8 car. minimum)       (obligatoire)
      role      : admin|teacher|supervisor|student|comptable (defaut teacher)
      login     : identifiant de connexion optionnel  (unique si fourni)
      school_id : seulement pour le superadmin (admin confine a son ecole)

    L'admin d'ecole ne peut creer que dans SA propre ecole ; le superadmin
    doit preciser school_id. Le mot de passe est hache (jamais stocke en clair).
    """
    data = body()
    full_name = (data.get("full_name") or data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    login = (data.get("login") or "").strip().lower() or None
    password = data.get("password") or ""
    role = (data.get("role") or ROLE_TEACHER).strip().lower()

    # --- validations ---
    if not full_name:
        return jsonify(error="nom_requis"), 400
    if role not in _CREATABLE_ROLES:
        return jsonify(error="role_invalide", roles=sorted(_CREATABLE_ROLES)), 400
    if not email or not _EMAIL_RE.match(email):
        return jsonify(error="email_invalide"), 400
    if len(password) < 8:
        return jsonify(error="mot_de_passe_trop_court", min=8), 400
    if login is not None and not _LOGIN_RE.match(login):
        return jsonify(error="login_invalide",
                       detail="3-80 car. : minuscules, chiffres, . _ -"), 400
    if User.find_by_identifier(email):
        return jsonify(error="email_deja_utilise", email=email), 409
    if login is not None and User.find_by_identifier(login):
        return jsonify(error="login_deja_utilise", login=login), 409

    # --- ecole de rattachement ---
    sid = current_school_id()
    if sid is None:  # superadmin : l'ecole doit etre precisee
        sid = intval(data.get("school_id"))
        if sid is None:
            return jsonify(error="school_id_requis"), 400

    user = User(email=email, login=login, role=role,
                full_name=full_name, school_id=sid, active=True)

    # Lien explicite compte -> fiche (meme ecole). Sert a retrouver de maniere
    # fiable la fiche de l'enseignant/eleve connecte (classes attribuees, etc.).
    if role == ROLE_TEACHER:
        tid = intval(data.get("teacher_id"))
        if tid is not None:
            t = db.session.query(Teacher).filter(
                Teacher.id == tid, Teacher.school_id == sid
            ).first()
            if t is None:
                return jsonify(error="enseignant_introuvable", teacher_id=tid), 400
            user.teacher_id = t.id
    elif role == ROLE_STUDENT:
        stid = intval(data.get("student_id"))
        if stid is not None:
            s = db.session.query(Student).filter(
                Student.id == stid, Student.school_id == sid
            ).first()
            if s is None:
                return jsonify(error="eleve_introuvable", student_id=stid), 400
            user.student_id = s.id

    user.set_password(password)
    db.session.add(user)
    log_action("compte_cree", target=email, detail=f"role={role}")
    db.session.commit()
    return jsonify(user=user.to_dict()), 201


def _get_target(uid):
    """Retrouve l'utilisateur cible en respectant l'isolation par ecole.

    Renvoie (user, None) ou (None, (reponse, code)). L'admin ne peut agir que
    sur les comptes de son ecole ; le superadmin sur tous.
    """
    target = scoped_query(User).filter(User.id == uid).first()
    if target is None:
        return None, (jsonify(error="utilisateur_introuvable"), 404)
    # On ne touche jamais a un superadmin via cette route.
    if target.role == ROLE_SUPERADMIN:
        return None, (jsonify(error="action_interdite_superadmin"), 403)
    return target, None


def _is_last_active_admin(target):
    """Vrai si `target` est le dernier administrateur ACTIF de son ecole."""
    if target.role != ROLE_ADMIN or target.school_id is None:
        return False
    count = (
        db.session.query(User)
        .filter(
            User.school_id == target.school_id,
            User.role == ROLE_ADMIN,
            User.active.is_(True),
        )
        .count()
    )
    return count <= 1


@api_bp.patch("/users/<int:uid>")
@role_required(ROLE_ADMIN)
def update_user(uid):
    """Active/desactive un compte (body {active:bool}).

    Garde-fous : pas d'auto-desactivation, et on ne desactive jamais le dernier
    administrateur actif d'une ecole (sinon plus personne ne peut la gerer).
    """
    target, err = _get_target(uid)
    if err is not None:
        return err

    me = get_current_user()
    data = body()

    if "active" in data:
        active = boolval(data.get("active"), True)
        if not active:
            if me is not None and me.id == target.id:
                return jsonify(error="auto_desactivation_interdite"), 400
            if _is_last_active_admin(target):
                return jsonify(error="dernier_admin_actif",
                               detail="Garde au moins un administrateur actif."), 409
        target.active = active
        db.session.add(target)
        log_action("compte_actif" if active else "compte_desactive",
                   target=str(target.id), detail=target.email)
        db.session.commit()

    return jsonify(user=target.to_dict())


@api_bp.delete("/users/<int:uid>")
@role_required(ROLE_ADMIN)
def delete_user(uid):
    """Supprime un compte.

    Garde-fous : pas d'auto-suppression, et on ne supprime jamais le dernier
    administrateur actif d'une ecole.
    """
    target, err = _get_target(uid)
    if err is not None:
        return err

    me = get_current_user()
    if me is not None and me.id == target.id:
        return jsonify(error="auto_suppression_interdite"), 400
    if _is_last_active_admin(target):
        return jsonify(error="dernier_admin_actif",
                       detail="Impossible de supprimer le dernier administrateur."), 409

    email = target.email
    db.session.delete(target)
    log_action("compte_supprime", target=str(uid), detail=email)
    db.session.commit()
    return jsonify(status="ok", id=uid)
