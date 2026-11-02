"""Supervision : statistiques de connexion + comptage des utilisateurs.

Deux endpoints en lecture seule, isoles par tenant (scoped_query) :

    GET /api/stats/connexions   -> reussites / echecs de connexion + causes,
                                   en global ET par etablissement.
    GET /api/stats/users        -> nombre de comptes par profil (role),
                                   en global ET par etablissement.

Admin  -> confine a son etablissement (scoped_query filtre sur school_id).
Superadmin (school_id nul) -> voit tout, avec le detail par etablissement.

Les causes d'echec sont lues dans AuditLog.detail, ecrit par /auth/login sous
la forme "<cause> \u00b7 <identifiant>". Les anciennes lignes sans code sont
rangees dans la cause "non_precise".
"""
from datetime import datetime, timedelta, timezone

from flask import jsonify

from ..auth.routes import SPIKE_THRESHOLD, SPIKE_WINDOW_MIN
from ..extensions import db
from ..models.audit import AuditLog
from ..models.school import School
from ..models.user import ROLE_ADMIN, User
from ..utils.security import role_required
from ..utils.tenant import scoped_query
from . import api_bp
from .common import arg, intval

# Causes d'echec connues (ecrites par /auth/login). Tout le reste -> non_precise.
_CAUSES = ("inconnu", "compte_inactif", "mauvais_mot_de_passe")


def _school_names():
    """{school_id: nom} pour nommer les etablissements des buckets."""
    return {s.id: s.name for s in db.session.query(School.id, School.name).all()}


def _cause_of(detail):
    """Extrait le code de cause d'une ligne login_echec."""
    head = (detail or "").split("\u00b7", 1)[0].strip()
    return head if head in _CAUSES else "non_precise"


@api_bp.get("/stats/connexions")
@role_required(ROLE_ADMIN)
def stats_connexions():
    """Reussites / echecs de connexion sur une fenetre glissante.

    Parametres de query :
        jours   fenetre en jours (defaut 30, max 365).

    Reponse :
        {
          jours, depuis,
          global: {reussite, echec, total, taux_reussite, causes:{...},
                   pic_actif},
          etablissements: [ {school_id, name, reussite, echec, total,
                             taux_reussite, causes:{...}, pic_actif}, ... ],
          seuil_pic, fenetre_pic_min,
          alertes: [ {scope, school_id, name, detail, quand}, ... ]
        }
    """
    jours = intval(arg("jours"), 30) or 30
    jours = max(1, min(jours, 365))
    since = datetime.now(timezone.utc) - timedelta(days=jours)

    rows = (
        scoped_query(AuditLog)
        .filter(
            AuditLog.action.in_(("login", "login_echec")),
            AuditLog.created_at >= since,
        )
        .all()
    )

    def _bucket():
        return {
            "reussite": 0, "echec": 0, "total": 0,
            "causes": {c: 0 for c in _CAUSES + ("non_precise",)},
        }

    glob = _bucket()
    par_ecole = {}
    for a in rows:
        sid = a.school_id
        b = par_ecole.setdefault(sid, _bucket())
        if a.action == "login":
            glob["reussite"] += 1
            b["reussite"] += 1
        else:
            cause = _cause_of(a.detail)
            glob["echec"] += 1
            glob["causes"][cause] += 1
            b["echec"] += 1
            b["causes"][cause] += 1
        glob["total"] += 1
        b["total"] += 1

    def _taux(bk):
        return round(bk["reussite"] / bk["total"] * 100) if bk["total"] else None

    glob["taux_reussite"] = _taux(glob)
    names = _school_names()
    etabs = []
    for sid, b in par_ecole.items():
        b["school_id"] = sid
        b["name"] = names.get(sid) if sid is not None else "Hors \u00e9tablissement / inconnu"
        b["taux_reussite"] = _taux(b)
        etabs.append(b)
    etabs.sort(key=lambda b: -b["total"])

    # --- Alertes "pic d'echecs" ---------------------------------------------
    # 1) Historique des alertes deja ecrites par /auth/login sur la fenetre.
    alertes = []
    for a in (
        scoped_query(AuditLog)
        .filter(
            AuditLog.action == "alerte_pic_echecs",
            AuditLog.created_at >= since,
        )
        .order_by(AuditLog.created_at.desc())
        .all()
    ):
        alertes.append({
            "scope": a.target or "",
            "school_id": a.school_id,
            "name": (names.get(a.school_id) if a.school_id is not None
                     else "Hors \u00e9tablissement / inconnu"),
            "detail": a.detail or "",
            "quand": a.created_at.isoformat() if a.created_at else None,
        })

    # 2) Pic ACTIF en live : echecs sur la fenetre glissante SPIKE_WINDOW_MIN,
    #    global et par etablissement (seuil >= SPIKE_THRESHOLD).
    live_since = datetime.now(timezone.utc) - timedelta(minutes=SPIKE_WINDOW_MIN)
    live = (
        scoped_query(AuditLog)
        .filter(
            AuditLog.action == "login_echec",
            AuditLog.created_at >= live_since,
        )
        .all()
    )
    live_total = len(live)
    live_par_ecole = {}
    for a in live:
        live_par_ecole[a.school_id] = live_par_ecole.get(a.school_id, 0) + 1
    glob["pic_actif"] = live_total >= SPIKE_THRESHOLD
    for b in etabs:
        b["pic_actif"] = live_par_ecole.get(b["school_id"], 0) >= SPIKE_THRESHOLD

    return jsonify(
        jours=jours,
        depuis=since.isoformat(),
        seuil_pic=SPIKE_THRESHOLD,
        fenetre_pic_min=SPIKE_WINDOW_MIN,
        alertes=alertes,
        **{"global": glob},
        etablissements=etabs,
    )


@api_bp.get("/stats/users")
@role_required(ROLE_ADMIN)
def stats_users():
    """Comptage des comptes par profil (role), global + par etablissement.

    Reponse :
        {
          total, actifs, inactifs,
          global: {<role>: n, ...},
          etablissements: [ {school_id, name, total, actifs, inactifs,
                             roles:{<role>: n, ...}}, ... ]
        }
    """
    rows = scoped_query(User).all()

    glob = {}
    total = actifs = inactifs = 0
    par_ecole = {}
    for u in rows:
        total += 1
        if u.active:
            actifs += 1
        else:
            inactifs += 1
        glob[u.role] = glob.get(u.role, 0) + 1
        sid = u.school_id
        b = par_ecole.setdefault(sid, {
            "school_id": sid, "total": 0, "actifs": 0, "inactifs": 0, "roles": {},
        })
        b["total"] += 1
        b["actifs"] += 1 if u.active else 0
        b["inactifs"] += 0 if u.active else 1
        b["roles"][u.role] = b["roles"].get(u.role, 0) + 1

    names = _school_names()
    etabs = []
    for sid, b in par_ecole.items():
        b["name"] = names.get(sid) if sid is not None else "Super-admin / hors \u00e9tablissement"
        etabs.append(b)
    etabs.sort(key=lambda b: -b["total"])

    return jsonify(
        total=total, actifs=actifs, inactifs=inactifs,
        **{"global": glob},
        etablissements=etabs,
    )
