"""Centre de notifications : notification en page (cloche) + email.

Mutualise la creation de notifications applicatives (table `notifications`) et
l'envoi d'un email de courtoisie au(x) destinataire(s). Tout est best-effort :
une erreur de notification/email ne doit JAMAIS casser l'action metier en cours
(depot d'exercice, soumission...).

Usage typique depuis une route API, APRES avoir prepare l'objet metier mais
AVANT le commit final : les notifications sont ajoutees a la session courante
et partent au meme commit ; les emails sont envoyes juste apres (hors DB).
"""
from datetime import datetime, timezone

from ..extensions import db
from ..models.exercise import Notification
from ..models.user import User
from ..models.device import DeviceToken
from . import email as email_service
from . import push as push_service
from . import push_templates


def add_notification(*, user_id, school_id, kind, title, body="",
                     ref_type="", ref_id=None):
    """Ajoute une notification en page a la session (sans commit)."""
    db.session.add(Notification(
        user_id=user_id, school_id=school_id, kind=kind,
        title=title or "", body=body or "",
        ref_type=ref_type or "", ref_id=ref_id, lu=False,
    ))


def _emails_for_users(user_ids):
    """{user_id: email} pour les comptes actifs ayant une adresse."""
    if not user_ids:
        return {}
    rows = (db.session.query(User)
            .filter(User.id.in_(list(user_ids))).all())
    return {u.id: u.email for u in rows if u.email}


def _device_tokens_for_users(user_ids):
    """Jetons d'appareils ACTIFS des utilisateurs (objets DeviceToken).

    On renvoie les objets (pas seulement les chaines) pour pouvoir desactiver
    en base ceux que le fournisseur signale invalides.
    """
    if not user_ids:
        return []
    return (db.session.query(DeviceToken)
            .filter(DeviceToken.user_id.in_(list(user_ids)),
                    DeviceToken.active.is_(True)).all())


def notify_users(recipients, *, school_id, kind, title, body="",
                 ref_type="", ref_id=None, email=True, email_subject=None,
                 email_body=None, email_html=None, push=True):
    """Notifie plusieurs utilisateurs : cloche (+ email + push optionnels).

    recipients : liste d'ids d'utilisateurs (comptes `users`).
    Les notifications en page sont ajoutees a la session courante (pas de commit
    ici : laisse l'appelant committer). Les emails sont envoyes immediatement,
    en best-effort (le service email est deja protege).
    `email_html` : corps HTML optionnel (alternative multipart du mail).
    `push` : si vrai, envoie aussi une notification push aux appareils connus
    des destinataires (best-effort ; silencieux si aucun jeton / non configure).
    Renvoie la liste des ids reellement notifies.
    """
    ids = [int(u) for u in recipients if u]
    for uid in ids:
        add_notification(user_id=uid, school_id=school_id, kind=kind,
                         title=title, body=body, ref_type=ref_type, ref_id=ref_id)
    if email and ids:
        try:
            mails = list(_emails_for_users(ids).values())
            if mails:
                email_service.send_email(
                    email_subject or title,
                    email_body or body or title,
                    to=mails,
                    html=email_html,
                )
        except Exception:  # noqa: BLE001 - l'email ne doit jamais bloquer
            pass
    if push and ids:
        try:
            rows = _device_tokens_for_users(ids)
            tokens = [r.token for r in rows]
            if tokens:
                payload = push_templates.from_notification(
                    kind=kind, title=title, body=body or title,
                    ref_type=ref_type, ref_id=ref_id)
                result = push_service.send_push(payload, tokens)
                # Nettoyage : desactive les jetons signales invalides par FCM
                # (committe par l'appelant, comme les notifications).
                bad = set(result.get("invalid_tokens") or [])
                if bad:
                    for r in rows:
                        if r.token in bad:
                            r.active = False
        except Exception:  # noqa: BLE001 - le push ne doit jamais bloquer
            pass
    return ids


def mark_read(user_id, ids=None):
    """Marque comme lues les notifications d'un utilisateur (toutes si ids=None)."""
    q = db.session.query(Notification).filter(Notification.user_id == user_id,
                                              Notification.lu.is_(False))
    if ids:
        q = q.filter(Notification.id.in_(list(ids)))
    now = datetime.now(timezone.utc)
    n = 0
    for notif in q.all():
        notif.lu = True
        notif.lu_at = now
        n += 1
    return n
