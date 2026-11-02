"""Notifications sortantes (WhatsApp / SMS) via la passerelle serveur.

Complete le mode "liens wa.me" cote front : ici l'envoi est fait par le
serveur, sans action du destinataire, des qu'une passerelle est configuree
(variables d'env, voir app/services/messaging.py). Si aucune passerelle n'est
branchee, l'envoi passe en mode simulation (aucun appel reseau) et le front
peut retomber sur les liens wa.me.

Routes :
  GET  /api/notify/status  -> etat passerelle + canaux actives de l'ecole
  POST /api/notify/send    -> envoie un message a une cible (role admin/superviseur)
"""
from ..extensions import db
from ..extensions import limiter
from ..models.people import Student, Teacher, Enrollment
from ..models.school import SchoolConfig
from ..models.user import ROLE_ADMIN, ROLE_SUPERVISOR
from ..services import messaging
from ..utils.security import role_required
from ..utils.tenant import current_school_id, scoped_query
from . import api_bp
from .common import body, commit, err, intval, log_action

_CHANNELS = ("whatsapp", "sms")
_TARGETS = ("all", "class", "nouveaux", "redoublants", "teachers")


def _school_cfg():
    sid = current_school_id()
    if sid is None:
        return None
    return db.session.query(SchoolConfig).filter(SchoolConfig.school_id == sid).first()


def _channel_enabled(cfg, channel):
    """Le canal est-il active dans les parametres de l'ecole ?"""
    if cfg is None:
        return True  # superadmin / pas de config dediee : on n'empeche pas
    return bool(getattr(cfg, channel, False))


def _student_contact(s):
    """Numero parent prioritaire (pere puis mere) + nom affiche."""
    tel = (s.contact_pere or "").strip() or (s.contact_mere or "").strip()
    return {"name": s.full_name or s.matricule or "Eleve", "tel": tel}


def _enrollment_statut(student_ids, year):
    """{student_id: statut} pour l'annee (si fournie) sinon toutes annees."""
    if not student_ids:
        return {}
    q = scoped_query(Enrollment).filter(Enrollment.student_id.in_(list(student_ids)))
    if year:
        q = q.filter(Enrollment.year == year)
    out = {}
    for e in q.all():
        out[e.student_id] = (e.statut or "")
    return out


def _is_redoublant(statut):
    return "redoubl" in (statut or "").strip().lower()


def _build_recipients(target, class_id, year):
    """Construit la liste [{name, tel}] selon la cible demandee."""
    if target == "teachers":
        rows = scoped_query(Teacher).order_by(Teacher.nom, Teacher.prenom).all()
        return [{"name": t.full_name or "Enseignant", "tel": (t.tel or "").strip()} for t in rows]

    q = scoped_query(Student)
    if target == "class":
        q = q.filter(Student.class_id == class_id)
    students = q.order_by(Student.nom, Student.prenom).all()

    if target in ("nouveaux", "redoublants"):
        statut = _enrollment_statut([s.id for s in students], year)
        if target == "redoublants":
            students = [s for s in students if _is_redoublant(statut.get(s.id))]
        else:  # nouveaux = tout sauf redoublants
            students = [s for s in students if not _is_redoublant(statut.get(s.id))]

    return [_student_contact(s) for s in students]


def _mask(tel):
    """Masque un numero pour l'affichage/historique (garde les 2 derniers)."""
    d = "".join(ch for ch in str(tel or "") if ch.isdigit())
    if len(d) <= 2:
        return d
    return ("*" * (len(d) - 2)) + d[-2:]


@api_bp.get("/notify/status")
@role_required(ROLE_ADMIN, ROLE_SUPERVISOR)
def notify_status():
    """Etat de la passerelle serveur + canaux actives de l'ecole."""
    cfg = _school_cfg()
    gw = messaging.status()
    return {
        "gateway": gw,
        "school": {
            "whatsapp": _channel_enabled(cfg, "whatsapp"),
            "sms": _channel_enabled(cfg, "sms"),
            "sender": getattr(cfg, "sender", "") or "",
        },
        # Vrai si le serveur peut reellement envoyer (sinon le front utilise wa.me).
        "can_send": bool(gw.get("configured")),
    }


@api_bp.post("/notify/send")
@role_required(ROLE_ADMIN, ROLE_SUPERVISOR)
@limiter.limit("10 per minute; 100 per hour")
def notify_send():
    """Envoie un message a une cible via la passerelle serveur.

    Corps JSON :
      channel   : 'whatsapp' | 'sms'            (obligatoire)
      message   : texte a envoyer               (obligatoire)
      target    : all|class|nouveaux|redoublants|teachers  (defaut 'all')
      class_id  : requis si target == 'class'
      year      : annee scolaire (optionnel, pour nouveaux/redoublants)
    """
    data = body()
    channel = (data.get("channel") or "").strip().lower()
    message = (data.get("message") or "").strip()
    target = (data.get("target") or "all").strip().lower()
    class_id = intval(data.get("class_id"))
    year = (data.get("year") or "").strip() or None

    if channel not in _CHANNELS:
        return err("canal_invalide", canaux=list(_CHANNELS))
    if not message:
        return err("message_vide")
    if target not in _TARGETS:
        return err("cible_invalide", cibles=list(_TARGETS))
    if target == "class" and not class_id:
        return err("class_id_requis")

    # 1) Le canal doit etre active dans les parametres de l'ecole.
    cfg = _school_cfg()
    if not _channel_enabled(cfg, channel):
        return err("canal_desactive", code=409, channel=channel)

    # 2) Construire la liste des destinataires.
    recipients = _build_recipients(target, class_id, year)
    with_tel = [r for r in recipients if r["tel"]]
    if not with_tel:
        return err("aucun_destinataire", code=422,
                   total=len(recipients), sans_numero=len(recipients))

    # 3) Envoi (reel si passerelle configuree, sinon simulation).
    summary = messaging.send_bulk(channel, with_tel, message)

    # 4) Journal d'audit (sans exposer les numeros en clair).
    log_action(
        "notify.send",
        target=f"{channel}:{target}",
        detail=("envoyes=%d simules=%d echecs=%d sans_numero=%d" % (
            summary["sent"], summary["simulated"], summary["failed"],
            len(recipients) - len(with_tel))),
    )
    commit()

    # 5) Reponse : statut agrege + detail par destinataire (numero masque).
    details = [{
        "name": r.get("name", ""),
        "tel": _mask(r.get("to")),
        "ok": r["ok"],
        "simulated": r["simulated"],
        "info": r["info"],
    } for r in summary["results"]]

    gw = messaging.status()
    return {
        "status": "ok",
        "channel": channel,
        "target": target,
        "provider": gw.get("provider"),
        "simulation": bool(gw.get("simulation")),
        "total": len(recipients),
        "sans_numero": len(recipients) - len(with_tel),
        "sent": summary["sent"],
        "simulated": summary["simulated"],
        "failed": summary["failed"],
        "recipients": details,
    }
