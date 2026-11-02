"""Modeles de notifications PUSH mobile XSchool.

Chaque fonction renvoie un *payload* normalise, pret a passer a n'importe quel
transport push (Firebase Cloud Messaging, Web Push / VAPID, Expo, APNs...).
La couche d'envoi n'existe pas encore : ce module ne fait QUE construire le
contenu (titre, corps, donnees de routage). Le jour ou un transport est ajoute,
il suffira de mapper ce dict au format du fournisseur (voir `to_fcm`).

Forme du payload renvoye ::

    {
      "title":    str,   # titre court (tronque ~48 car.)
      "body":     str,   # corps court (tronque ~140 car.)
      "channel":  str,   # canal/categorie Android ("exercices", ...)
      "priority": str,   # "high" | "normal"
      "data": {          # charge utile silencieuse (deep-link + routage)
          "type":     str,          # ex: "exercise_reminder"
          "ref_type": str,          # ex: "exercise"
          "ref_id":   str,          # id de la ressource (str pour FCM)
          "url":      str,          # lien web (#exos) si APP_PUBLIC_URL
          "deeplink": str,          # lien appli (xschool://exercise/<id>)
      },
    }

Regles :
  - Titres/corps COURTS : un push n'affiche que quelques lignes sur mobile.
  - Pas de HTML ni d'emoji indispensable au sens (emoji = decoratif, en tete).
  - `data` ne contient que des chaines (contrainte FCM : data = map string).
  - Aucune donnee sensible dans le payload (il transite par un tiers).
"""
import os

APP_NAME = "XSchool"

# Longueurs max conseillees pour un rendu propre sur Android/iOS.
MAX_TITLE = 48
MAX_BODY = 140


def _app_url():
    """URL publique du front (deep-link web). Vide -> pas de lien."""
    return (os.getenv("APP_PUBLIC_URL", "") or "").strip().rstrip("/")


def _scheme():
    """Schema d'URL de l'appli mobile (deep-link natif)."""
    return (os.getenv("APP_MOBILE_SCHEME", "xschool") or "xschool").strip()


def _truncate(text, limit):
    """Tronque proprement sur un mot, ajoute une ellipse si coupe."""
    text = " ".join(str(text or "").split())  # normalise les espaces
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rstrip()
    sp = cut.rfind(" ")
    if sp > limit * 0.6:   # evite de couper trop court
        cut = cut[:sp].rstrip()
    return cut + "\u2026"   # …


def _links(ref_type, ref_id):
    """Construit (url web, deeplink natif) vers la ressource ciblee."""
    url = _app_url()
    web = (url + "/#exos") if (url and ref_type == "exercise") else (url or "")
    deeplink = ""
    if ref_type and ref_id is not None:
        deeplink = "{}://{}/{}".format(_scheme(), ref_type, ref_id)
    return web, deeplink


def build(*, kind, title, body, ref_type="", ref_id=None, priority="normal",
          channel="general"):
    """Constructeur generique : normalise titre/corps + donnees de routage.

    Sert de base aux modeles specifiques et de passerelle pour transformer une
    notification existante (cloche) en push (voir `from_notification`).
    """
    web, deeplink = _links(ref_type, ref_id)
    data = {
        "type": str(kind or ""),
        "ref_type": str(ref_type or ""),
        "ref_id": ("" if ref_id is None else str(ref_id)),
    }
    if web:
        data["url"] = web
    if deeplink:
        data["deeplink"] = deeplink
    return {
        "title": _truncate(title, MAX_TITLE),
        "body": _truncate(body, MAX_BODY),
        "channel": channel,
        "priority": ("high" if priority == "high" else "normal"),
        "data": data,
    }


def _type_label(exercise_type):
    return "quiz" if exercise_type == "quiz" else "devoir"


def exercise_reminder(*, exercise_id=None, exercise_title="", exercise_type="pdf",
                      days=1):
    """Push de rappel J-1 (echeance proche, exercice non rendu)."""
    tlabel = _type_label(exercise_type)
    if days <= 0:
        when = "aujourd'hui"
    elif days == 1:
        when = "demain"
    else:
        when = "dans {} jours".format(days)
    title = "\u23f0 Rappel : {} a rendre".format(tlabel)
    body = "\u00ab {} \u00bb est a rendre {}. Ouvre XSchool pour le terminer.".format(
        exercise_title, when)
    return build(kind="exercise_reminder", title=title, body=body,
                 ref_type="exercise", ref_id=exercise_id,
                 priority="high", channel="exercices")


def exercise_overdue(*, exercise_id=None, exercise_title="", exercise_type="pdf",
                     days_late=0):
    """Push pour un exercice EN RETARD (echeance depassee)."""
    d = max(int(days_late or 0), 0)
    if d <= 0:
        lateness = "depuis aujourd'hui"
    elif d == 1:
        lateness = "depuis 1 jour"
    else:
        lateness = "depuis {} jours".format(d)
    title = "\u26a0\ufe0f En retard : exercice non rendu"
    body = "\u00ab {} \u00bb n'est toujours pas rendu ({}). Rends-le vite.".format(
        exercise_title, lateness)
    return build(kind="exercise_overdue", title=title, body=body,
                 ref_type="exercise", ref_id=exercise_id,
                 priority="high", channel="exercices")


# Correspondance kind de notif -> (canal, priorite) pour le mapper generique.
_KIND_HINTS = {
    "exercise_reminder": ("exercices", "high"),
    "exercise_overdue": ("exercices", "high"),
    "exercise_published": ("exercices", "normal"),
    "grade_posted": ("notes", "normal"),
}


def from_notification(*, kind, title, body, ref_type="", ref_id=None):
    """Transforme une notification cloche existante en payload push.

    Permet, le jour ou un transport push est branche, de pousser EXACTEMENT ce
    qui est deja envoye dans le centre de notifs, sans dupliquer la logique :
    il suffira d'appeler ceci dans `notify_center.notify_users`.
    """
    channel, priority = _KIND_HINTS.get(kind, ("general", "normal"))
    return build(kind=kind, title=title, body=body,
                 ref_type=ref_type, ref_id=ref_id,
                 priority=priority, channel=channel)


def to_fcm(payload, *, token=None, topic=None):
    """Exemple de mapping vers le format Firebase Cloud Messaging.

    Fourni a titre indicatif pour le futur transport (non appele pour l'instant).
    `data` est deja un map de chaines, conforme a FCM.
    """
    msg = {
        "notification": {"title": payload["title"], "body": payload["body"]},
        "data": dict(payload.get("data", {})),
        "android": {
            "priority": "HIGH" if payload.get("priority") == "high" else "NORMAL",
            "notification": {"channel_id": payload.get("channel", "general")},
        },
        "apns": {
            "headers": {
                "apns-priority": "10" if payload.get("priority") == "high"
                else "5"
            }
        },
    }
    if token:
        msg["token"] = token
    elif topic:
        msg["topic"] = topic
    return {"message": msg}
