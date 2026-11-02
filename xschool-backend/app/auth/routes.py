"""Authentification : login par email, profil courant."""
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_current_user, jwt_required

from ..extensions import db
from ..extensions import limiter
from ..models.audit import AuditLog
from ..models.people import Teacher
from ..models.school import School
from ..models.user import ROLE_TEACHER, User
from ..services import email as email_service

auth_bp = Blueprint("auth", __name__)

# --- Detection de pic d'echecs de connexion (brute force / attaque) ---
# Fenetre d'observation, seuil de declenchement et periode de calme (anti-spam).
# Exposes pour que les stats de supervision reutilisent les memes valeurs.
SPIKE_WINDOW_MIN = 10     # on regarde les echecs des 10 dernieres minutes
SPIKE_THRESHOLD = 5       # a partir de 5 echecs sur la fenetre -> alerte
SPIKE_COOLDOWN_MIN = 10   # une seule alerte par scope toutes les 10 min


def _norm(s):
    return " ".join(str(s or "").strip().lower().split())


def _autolink_teacher(user):
    """Rattache automatiquement un compte enseignant a sa fiche par le nom.

    Soigne les comptes crees AVANT le lien explicite `teacher_id` : si le compte
    est un enseignant sans fiche liee, on cherche dans SON ecole une fiche dont
    le nom complet correspond (insensible a la casse / aux espaces) et on
    persiste le lien. Ainsi les classes attribuees a la fiche remontent bien
    cote enseignant. Sans correspondance, on ne force rien.
    """
    if user is None or user.role != ROLE_TEACHER or user.teacher_id is not None:
        return
    if user.school_id is None:
        return
    target = _norm(user.full_name)
    if not target:
        return
    rows = db.session.query(Teacher).filter(Teacher.school_id == user.school_id).all()
    match = next((t for t in rows if _norm(t.full_name) == target), None)
    if match is not None:
        user.teacher_id = match.id
        db.session.commit()


def _client_ip():
    return (request.headers.get("X-Forwarded-For", request.remote_addr) or "")[:45]


def _maybe_spike_alert(*, school_id, ip):
    """Cree une alerte automatique si un pic d'echecs de connexion est detecte.

    On surveille DEUX perimetres sur la fenetre glissante `SPIKE_WINDOW_MIN` :
      - l'etablissement (`school_id`, ou le perimetre global si nul) ;
      - l'adresse IP (brute force depuis une meme source).
    Des que le nombre d'echecs atteint `SPIKE_THRESHOLD`, on ecrit une ligne
    `alerte_pic_echecs` dans le journal, SAUF si une alerte de meme perimetre a
    deja ete emise dans les `SPIKE_COOLDOWN_MIN` dernieres minutes (anti-spam).
    Pour chaque NOUVELLE alerte, une notification email est envoyee (best-effort)
    aux destinataires de SECURITY_ALERT_EMAILS.
    Best-effort : la journalisation ne doit jamais faire echouer le login.
    """
    nouvelles = []  # alertes reellement creees ce tour-ci -> notifiees par email
    try:
        now = datetime.now(timezone.utc)
        since = now - timedelta(minutes=SPIKE_WINDOW_MIN)
        cooldown = now - timedelta(minutes=SPIKE_COOLDOWN_MIN)
        # (tag de perimetre, condition de comptage, condition d'anti-spam, detail)
        scopes = [(
            "pic_etab",
            AuditLog.school_id == school_id,
            "{} \u00e9checs en {} min (\u00e9tablissement)",
        )]
        if ip:
            scopes.append((
                "pic_ip",
                AuditLog.ip == ip,
                "{} \u00e9checs en {} min (IP " + ip + ")",
            ))
        for tag, count_cond, detail_tpl in scopes:
            nb = (db.session.query(AuditLog)
                  .filter(AuditLog.action == "login_echec",
                          AuditLog.created_at >= since, count_cond).count())
            if nb < SPIKE_THRESHOLD:
                continue
            already = (db.session.query(AuditLog)
                       .filter(AuditLog.action == "alerte_pic_echecs",
                               AuditLog.target == tag,
                               AuditLog.created_at >= cooldown,
                               count_cond).first())
            if already is not None:
                continue
            detail = detail_tpl.format(nb, SPIKE_WINDOW_MIN)
            db.session.add(AuditLog(
                school_id=school_id, user_id=None,
                action="alerte_pic_echecs", target=tag,
                detail=detail, ip=ip or ""))
            nouvelles.append((tag, detail, nb))
        db.session.commit()
    except Exception:  # la detection ne doit jamais casser l'authentification
        db.session.rollback()
        nouvelles = []
    # Notification email hors de la transaction DB (envoi best-effort).
    if nouvelles:
        _notify_spike_email(school_id=school_id, ip=ip, alertes=nouvelles)


def _notify_spike_email(*, school_id, ip, alertes):
    """Envoie un email recapitulant les pics d'echecs detectes (best-effort).

    Ne fait rien si aucun destinataire n'est configure ; n'echoue jamais
    (l'envoi lui-meme est deja protege dans le service email).
    """
    try:
        if not email_service.alert_recipients():
            return
        lignes = [
            "- " + detail + " (" + str(nb) + " \u00e9checs)"
            for _tag, detail, nb in alertes
        ]
        etab = school_id if school_id is not None else "(hors \u00e9tablissement / inconnu)"
        quand = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        subject = "[XSchool] Alerte s\u00e9curit\u00e9 : pic d'\u00e9checs de connexion"
        body = (
            "Un pic d'\u00e9checs de connexion vient d'\u00eatre d\u00e9tect\u00e9 sur XSchool.\n\n"
            "Horodatage : " + quand + "\n"
            "\u00c9tablissement (school_id) : " + str(etab) + "\n"
            "Adresse IP : " + (ip or "(inconnue)") + "\n"
            "Seuil de d\u00e9clenchement : " + str(SPIKE_THRESHOLD)
            + " \u00e9checs sur " + str(SPIKE_WINDOW_MIN) + " min\n\n"
            "D\u00e9tail :\n" + "\n".join(lignes) + "\n\n"
            "V\u00e9rifie le journal d'audit (section Supervision) pour le contexte "
            "complet. Ceci peut indiquer une tentative de force brute.\n"
        )
        email_service.send_email(subject, body)
    except Exception:  # noqa: BLE001 - la notif ne doit jamais casser le login
        pass


@auth_bp.get("/schools")
@limiter.limit("60 per minute")
def public_schools():
    """Liste PUBLIQUE des etablissements actifs (ecran de connexion/tenant).

    Appele AVANT toute authentification : aucun JWT requis. On n'expose que le
    strict necessaire (id, nom, slug) pour peupler le selecteur d'etablissement
    de l'ecran de connexion. C'est ce qui permet aux ecoles creees par le
    superadmin d'apparaitre immediatement dans la liste a la connexion.
    """
    rows = (
        db.session.query(School)
        .filter(School.active.is_(True))
        .order_by(School.name)
        .all()
    )
    return jsonify(items=[
        {"id": s.id, "name": s.name, "slug": s.slug} for s in rows
    ])


@auth_bp.post("/login")
@limiter.limit("10 per minute; 60 per hour")
def login():
    data = request.get_json(silent=True) or {}
    # Accepte "identifiant" (email OU login) ; "email" reste supporte par compat.
    ident = (data.get("identifiant") or data.get("email") or data.get("login") or "").strip().lower()
    password = data.get("password") or ""
    if not ident or not password:
        return jsonify(error="identifiant_et_mot_de_passe_requis"), 400

    user = User.find_by_identifier(ident)
    if user is None or not user.active or not user.check_password(password):
        # Cause precise de l'echec (lue par les stats de connexion) :
        #   inconnu              -> aucun compte pour cet identifiant
        #   compte_inactif       -> compte existant mais desactive
        #   mauvais_mot_de_passe -> compte valide mais mot de passe errone
        if user is None:
            cause = "inconnu"
        elif not user.active:
            cause = "compte_inactif"
        else:
            cause = "mauvais_mot_de_passe"
        db.session.add(AuditLog(
            school_id=getattr(user, "school_id", None) if user else None,
            user_id=getattr(user, "id", None) if user else None,
            action="login_echec", target="auth",
            detail="{} \u00b7 {}".format(cause, ident), ip=_client_ip()))
        db.session.commit()
        # Alerte automatique si ces echecs forment un pic (brute force / attaque).
        _maybe_spike_alert(
            school_id=getattr(user, "school_id", None) if user else None,
            ip=_client_ip())
        return jsonify(error="identifiants_invalides"), 401

    db.session.add(AuditLog(
        school_id=user.school_id, user_id=user.id,
        action="login", target="auth", detail=ident, ip=_client_ip()))
    db.session.commit()
    _autolink_teacher(user)
    token = create_access_token(identity=user)
    return jsonify(access_token=token, user=user.to_dict())


@auth_bp.get("/me")
@jwt_required()
def me():
    user = get_current_user()
    _autolink_teacher(user)
    return jsonify(user=user.to_dict())


@auth_bp.post("/change-password")
@jwt_required()
@limiter.limit("10 per minute")
def change_password():
    data = request.get_json(silent=True) or {}
    old = data.get("old_password") or ""
    new = data.get("new_password") or ""
    user = get_current_user()
    if not user.check_password(old):
        return jsonify(error="ancien_mot_de_passe_invalide"), 400
    if len(new) < 8:
        return jsonify(error="mot_de_passe_trop_court", min=8), 400
    user.set_password(new)
    db.session.add(AuditLog(
        school_id=user.school_id, user_id=user.id,
        action="change_password", target="auth", detail="", ip=_client_ip()))
    db.session.commit()
    return jsonify(status="ok")
