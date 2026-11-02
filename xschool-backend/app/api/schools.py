"""Gestion des ecoles (reserve au superadmin). Exemple de ressource CRUD."""
import re

from flask import jsonify, request
from flask_jwt_extended import get_current_user, jwt_required

from ..extensions import db
from ..models.school import School, SchoolConfig
from ..models.user import ROLE_ADMIN, User
from ..utils.security import role_required, superadmin_required
from . import api_bp
from .common import log_action


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_LOGIN_RE = re.compile(r"^[a-z0-9._-]{3,80}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _slugify(value):
    s = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return s or "ecole"


def _school_dict(s):
    return {"id": s.id, "name": s.name, "slug": s.slug, "active": s.active}


def _school_full_dict(s):
    """Ecole + sa configuration d'identite (pour l'etablissement courant)."""
    d = _school_dict(s)
    cfg = s.config
    if cfg is not None:
        d["config"] = {
            "phone": cfg.phone or "",
            "email": cfg.email or "",
            "address": cfg.address or "",
            "director": cfg.director or "",
            "logo": cfg.logo or "",
            "grade_max": float(cfg.grade_max) if cfg.grade_max is not None else 20,
            "pass_mark": float(cfg.pass_mark) if cfg.pass_mark is not None else 10,
            "avg_mode": cfg.avg_mode or "weighted",
            "avg_decimals": cfg.avg_decimals if cfg.avg_decimals is not None else 2,
            "rank_visible": bool(cfg.rank_visible),
            "rank_ties": bool(cfg.rank_ties),
            "opt_fac_coef1": bool(cfg.opt_fac_coef1),
            "bulletin_tpl": cfg.bulletin_tpl or "officiel",
            "bulletin_fmt": cfg.bulletin_fmt or "vrac",
            "bulletin_fmt_by_cycle": cfg.bulletin_fmt_by_cycle or {},
            "periods": cfg.periods or {},
            "teacher_grades": cfg.teacher_grades or {},
            "deadlines": cfg.deadlines or {},
            "mentions": cfg.mentions or [],
            "sms": bool(cfg.sms),
            "whatsapp": bool(cfg.whatsapp),
            "sender": cfg.sender or "XSCHOOL",
        }
    return d


def _create_admin(school_id, payload):
    """Cree un administrateur d'ecole. Renvoie (user, None) ou (None, (err, code)).

    `payload` attendu : {full_name, email, login?, password}. Le login est
    optionnel ; s'il est fourni il doit etre unique et respecter le format.
    """
    full_name = (payload.get("full_name") or payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    login = (payload.get("login") or "").strip().lower() or None
    password = payload.get("password") or ""

    if not email or not _EMAIL_RE.match(email):
        return None, (jsonify(error="email_admin_invalide"), 400)
    if len(password) < 8:
        return None, (jsonify(error="mot_de_passe_trop_court", min=8), 400)
    if login is not None and not _LOGIN_RE.match(login):
        return None, (jsonify(error="login_invalide",
                              detail="3-80 car. : minuscules, chiffres, . _ -"), 400)

    if User.find_by_identifier(email):
        return None, (jsonify(error="email_deja_utilise", email=email), 409)
    if login is not None and User.find_by_identifier(login):
        return None, (jsonify(error="login_deja_utilise", login=login), 409)

    admin = User(email=email, login=login, role=ROLE_ADMIN,
                 full_name=full_name or email, school_id=school_id, active=True)
    admin.set_password(password)
    db.session.add(admin)
    return admin, None


@api_bp.get("/schools/current")
@jwt_required()
def current_school():
    """Etablissement de l'utilisateur connecte (admin, enseignant, etc.).

    Permet au frontend d'afficher dynamiquement l'ecole du compte connecte au
    lieu d'une ecole de demo. Le superadmin n'etant rattache a aucune ecole,
    on renvoie school=None.
    """
    user = get_current_user()
    sid = getattr(user, "school_id", None) if user else None
    if sid is None:
        return jsonify(school=None)
    s = db.session.get(School, sid)
    if s is None:
        return jsonify(school=None)
    return jsonify(school=_school_full_dict(s))


@api_bp.get("/schools")
@superadmin_required
def list_schools():
    rows = db.session.query(School).order_by(School.name).all()
    return jsonify(items=[_school_dict(s) for s in rows])


@api_bp.post("/schools")
@superadmin_required
def create_school():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify(error="nom_requis"), 400

    slug = _slugify(data.get("slug") or name)
    if db.session.query(School).filter(School.slug == slug).first():
        return jsonify(error="slug_deja_utilise", slug=slug), 409

    # Bloc admin optionnel : {full_name, email, login?, password}. S'il est
    # fourni, on cree l'ecole ET son administrateur dans la meme transaction
    # (tout ou rien : en cas d'erreur sur l'admin, on annule l'ecole aussi).
    admin_payload = data.get("admin")
    admin = None

    school = School(name=name, slug=slug)
    school.config = SchoolConfig(
        mentions=[
            {"l": "Excellent", "min": 18}, {"l": "Tres Bien", "min": 16},
            {"l": "Bien", "min": 14}, {"l": "Assez Bien", "min": 12},
            {"l": "Passable", "min": 10},
        ],
        bulletin_fmt_by_cycle={},
        periods={},
        teacher_grades={},
        deadlines={},
    )
    db.session.add(school)
    db.session.flush()  # pour obtenir school.id

    if admin_payload:
        admin, err = _create_admin(school.id, admin_payload)
        if err is not None:
            db.session.rollback()
            return err

    db.session.commit()
    out = {"school": _school_dict(school)}
    if admin is not None:
        out["admin"] = admin.to_dict()
    return jsonify(out), 201


@api_bp.post("/schools/<int:sid>/admin")
@superadmin_required
def create_school_admin(sid):
    """Ajoute un administrateur a une ecole existante (avec mot de passe + login)."""
    school = db.session.get(School, sid)
    if school is None:
        return jsonify(error="ecole_introuvable"), 404

    data = request.get_json(silent=True) or {}
    admin, err = _create_admin(school.id, data)
    if err is not None:
        return err
    db.session.commit()
    return jsonify(admin=admin.to_dict()), 201


# ---------------------------------------------------------------------------
# Sauvegarde des reglages d'etablissement (config)
# ---------------------------------------------------------------------------
_AVG_MODES = {"weighted", "simple"}
_BULLETIN_TPL = {"officiel", "standard", "detaille", "compact"}
_BULLETIN_FMT = {"vrac", "groupe", "specialite"}


def _as_bool(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() in ("1", "true", "vrai", "oui", "yes", "on")
    return bool(v)


def _apply_config(cfg, data):
    """Applique un payload (partiel) de config sur `cfg`.

    On ne touche qu'aux cles presentes (mise a jour partielle), chaque valeur
    est validee/normalisee. Renvoie None en cas de succes, ou un couple
    (reponse_json, code) a retourner tel quel en cas d'erreur.
    """
    if not isinstance(data, dict):
        return jsonify(error="config_invalide"), 400

    # --- Identite (chaines) ---
    if "phone" in data:
        cfg.phone = str(data.get("phone") or "").strip()[:40]
    if "email" in data:
        email = str(data.get("email") or "").strip().lower()
        if email and not _EMAIL_RE.match(email):
            return jsonify(error="email_invalide"), 400
        cfg.email = email[:160]
    if "address" in data:
        cfg.address = str(data.get("address") or "").strip()
    if "director" in data:
        cfg.director = str(data.get("director") or "").strip()[:160]
    if "logo" in data:
        cfg.logo = str(data.get("logo") or "")
    if "sender" in data:
        cfg.sender = (str(data.get("sender") or "XSCHOOL").strip() or "XSCHOOL")[:11]

    # --- Bareme ---
    if "grade_max" in data:
        try:
            gm = float(data.get("grade_max"))
        except (TypeError, ValueError):
            return jsonify(error="grade_max_invalide"), 400
        if gm < 10 or gm > 100:
            return jsonify(error="grade_max_invalide", min=10, max=100), 400
        cfg.grade_max = gm
    if "pass_mark" in data:
        try:
            pm = float(data.get("pass_mark"))
        except (TypeError, ValueError):
            return jsonify(error="pass_mark_invalide"), 400
        gmax = float(cfg.grade_max) if cfg.grade_max is not None else 20
        if pm < 0 or pm > gmax:
            return jsonify(error="pass_mark_invalide", max=gmax), 400
        cfg.pass_mark = pm

    # --- Regles de calcul ---
    if "avg_mode" in data:
        am = str(data.get("avg_mode") or "weighted")
        if am not in _AVG_MODES:
            return jsonify(error="avg_mode_invalide", valides=sorted(_AVG_MODES)), 400
        cfg.avg_mode = am
    if "avg_decimals" in data:
        try:
            ad = int(data.get("avg_decimals"))
        except (TypeError, ValueError):
            return jsonify(error="avg_decimals_invalide"), 400
        if ad < 0 or ad > 3:
            return jsonify(error="avg_decimals_invalide", min=0, max=3), 400
        cfg.avg_decimals = ad
    if "rank_visible" in data:
        cfg.rank_visible = _as_bool(data.get("rank_visible"))
    if "rank_ties" in data:
        cfg.rank_ties = _as_bool(data.get("rank_ties"))
    if "opt_fac_coef1" in data:
        cfg.opt_fac_coef1 = _as_bool(data.get("opt_fac_coef1"))

    # --- Bulletin ---
    if "bulletin_tpl" in data:
        tpl = str(data.get("bulletin_tpl") or "officiel")
        if tpl not in _BULLETIN_TPL:
            return jsonify(error="bulletin_tpl_invalide", valides=sorted(_BULLETIN_TPL)), 400
        cfg.bulletin_tpl = tpl
    if "bulletin_fmt" in data:
        fmt = str(data.get("bulletin_fmt") or "vrac")
        if fmt not in _BULLETIN_FMT:
            return jsonify(error="bulletin_fmt_invalide", valides=sorted(_BULLETIN_FMT)), 400
        cfg.bulletin_fmt = fmt
    if "bulletin_fmt_by_cycle" in data:
        m = data.get("bulletin_fmt_by_cycle") or {}
        if not isinstance(m, dict):
            return jsonify(error="bulletin_fmt_by_cycle_invalide"), 400
        clean = {}
        for k, v in m.items():
            if v in _BULLETIN_FMT:
                clean[str(k)] = v
        cfg.bulletin_fmt_by_cycle = clean  # reassignation => JSONB marque modifie

    # --- Type de periode : par annee scolaire puis par cycle ---
    # Format attendu : {annee: {cycle: 'trimestre'|'semestre'}}. On tolere aussi
    # l'ancien format plat {cycle: type} (retro-compat) pour ne pas casser les
    # configs existantes. Tout ce qui n'est pas une valeur valide est ignore.
    if "periods" in data:
        m = data.get("periods") or {}
        if not isinstance(m, dict):
            return jsonify(error="periods_invalide"), 400
        clean = {}
        for k, v in m.items():
            if isinstance(v, dict):
                inner = {ck: cv for ck, cv in v.items() if cv in ("trimestre", "semestre")}
                clean[str(k)] = {str(ck): cv for ck, cv in inner.items()}
            elif v in ("trimestre", "semestre"):
                clean[str(k)] = v
        cfg.periods = clean  # reassignation => JSONB marque modifie

    # --- Blocage de la saisie des notes par les enseignants : {cycle: bool} ---
    # false => enseignants en consultation seule pour ce cycle (admin non affecte).
    if "teacher_grades" in data:
        m = data.get("teacher_grades") or {}
        if not isinstance(m, dict):
            return jsonify(error="teacher_grades_invalide"), 400
        cfg.teacher_grades = {str(k): _as_bool(v) for k, v in m.items()}

    # --- Dates limites de saisie : {"annee|cycle|periode": "YYYY-MM-DD"} ---
    # On ne garde que les cles dont la valeur est une date ISO valide ; une
    # valeur vide supprime la limite (cle ignoree).
    if "deadlines" in data:
        m = data.get("deadlines") or {}
        if not isinstance(m, dict):
            return jsonify(error="deadlines_invalide"), 400
        clean = {}
        for k, v in m.items():
            v = str(v or "").strip()
            if _DATE_RE.match(v):
                clean[str(k)] = v
        cfg.deadlines = clean  # reassignation => JSONB marque modifie

    # --- Mentions : liste [{l, min}] ---
    if "mentions" in data:
        raw = data.get("mentions") or []
        if not isinstance(raw, list):
            return jsonify(error="mentions_invalides"), 400
        mentions = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            label = str(item.get("l") or "").strip()
            if not label:
                continue
            try:
                mn = float(item.get("min") or 0)
            except (TypeError, ValueError):
                mn = 0
            mentions.append({"l": label, "min": mn})
        mentions.sort(key=lambda x: x["min"], reverse=True)
        cfg.mentions = mentions  # reassignation => JSONB marque modifie

    # --- Communication ---
    if "sms" in data:
        cfg.sms = _as_bool(data.get("sms"))
    if "whatsapp" in data:
        cfg.whatsapp = _as_bool(data.get("whatsapp"))

    return None


def _ensure_config(school):
    """Garantit qu'une ecole possede une ligne de config (cree si absente)."""
    if school.config is None:
        school.config = SchoolConfig(mentions=[], bulletin_fmt_by_cycle={}, periods={},
                                     teacher_grades={}, deadlines={})
        db.session.flush()
    return school.config


@api_bp.route("/schools/current/config", methods=["PUT", "PATCH"])
@role_required(ROLE_ADMIN)
def update_current_school_config():
    """Sauvegarde les reglages de l'etablissement de l'admin connecte.

    Accepte un payload partiel ayant les memes cles que le bloc `config`
    renvoye par GET /schools/current. Le payload peut etre soit directement
    les cles de config, soit enveloppe dans {"config": {...}, "name"?: ...}.
    """
    user = get_current_user()
    sid = getattr(user, "school_id", None) if user else None
    if sid is None:
        return jsonify(error="aucune_ecole_rattachee"), 400
    s = db.session.get(School, sid)
    if s is None:
        return jsonify(error="ecole_introuvable"), 404

    data = request.get_json(silent=True) or {}
    cfg_payload = data.get("config") if isinstance(data.get("config"), dict) else data
    err = _apply_config(_ensure_config(s), cfg_payload)
    if err is not None:
        db.session.rollback()
        return err
    if "name" in data and str(data.get("name") or "").strip():
        s.name = str(data.get("name")).strip()[:160]
    log_action("update_config", "schools", "reglages etablissement")
    db.session.commit()
    return jsonify(school=_school_full_dict(s))


@api_bp.put("/schools/<int:sid>/config")
@superadmin_required
def update_school_config(sid):
    """Variante superadmin : sauvegarde la config d'une ecole quelconque."""
    s = db.session.get(School, sid)
    if s is None:
        return jsonify(error="ecole_introuvable"), 404

    data = request.get_json(silent=True) or {}
    cfg_payload = data.get("config") if isinstance(data.get("config"), dict) else data
    err = _apply_config(_ensure_config(s), cfg_payload)
    if err is not None:
        db.session.rollback()
        return err
    if "name" in data and str(data.get("name") or "").strip():
        s.name = str(data.get("name")).strip()[:160]
    db.session.commit()
    return jsonify(school=_school_full_dict(s))
