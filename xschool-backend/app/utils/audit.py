"""Journalisation best-effort des evenements de securite / abus.

Ce module centralise l'ecriture d'une ligne `AuditLog` pour les signaux
d'abus (acces refuse, rate limit, token invalide, erreur serveur) depuis des
endroits ou le contexte applicatif normal n'est pas garanti (gestionnaires
d'erreur globaux, decorateurs d'acces). La regle d'or : NE JAMAIS casser la
requete en cours a cause de la journalisation -> toute exception est avalee et
la session est nettoyee.
"""
from flask import has_request_context, request

from ..extensions import db
from ..models.audit import AuditLog

# Actions considerees comme des signaux d'abus (lues par /api/logs/suspects).
SECURITY_ACTIONS = (
    "login_echec",      # mot de passe / identifiant errone
    "alerte_pic_echecs", # pic d'echecs de connexion detecte (brute force)
    "acces_refuse",     # 403 : role insuffisant / compte inactif
    "rate_limit",       # 429 : trop de requetes
    "token_invalide",   # JWT malforme / signature invalide
    "erreur_serveur",   # 500 : exception non geree
)


def _client_ip():
    if not has_request_context():
        return ""
    return (request.headers.get("X-Forwarded-For", request.remote_addr) or "")[:45]


def _path():
    return request.path if has_request_context() else ""


def record_security_event(action, *, target=None, detail="",
                          user_id=None, school_id=None):
    """Ecrit un evenement de securite sans jamais faire echouer la requete.

    `target` par defaut = chemin de la requete courante. `detail` est borne
    pour ne pas gonfler la base. Commit dedie (les gestionnaires d'erreur
    peuvent avoir une session deja rollbackee).
    """
    try:
        db.session.add(AuditLog(
            school_id=school_id,
            user_id=user_id,
            action=action,
            target=(target if target is not None else _path())[:120],
            detail=(detail or "")[:1000],
            ip=_client_ip(),
        ))
        db.session.commit()
    except Exception:  # pragma: no cover - la journalisation ne doit pas lever
        db.session.rollback()
