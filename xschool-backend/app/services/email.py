"""Envoi d'emails (notifications de securite / alertes).

Meme philosophie que `messaging.py` : aucune dependance tierce, uniquement la
librairie standard (`smtplib` + `email`). Toute la configuration vit dans
l'environnement (voir .env.example) ; AUCUN secret n'est stocke en base ni
renvoye au client.

Variables d'environnement :
  SMTP_HOST            hote du serveur SMTP (ex. smtp.gmail.com). Vide -> simulation.
  SMTP_PORT            port (defaut 587 en STARTTLS, 465 en SSL).
  SMTP_USER            identifiant SMTP (souvent l'adresse d'envoi).
  SMTP_PASSWORD        mot de passe / cle d'application SMTP.
  SMTP_FROM            adresse expediteur (defaut = SMTP_USER).
  SMTP_SECURITY        starttls (defaut) | ssl | none.
  SMTP_TIMEOUT         delai reseau en secondes (defaut 12).
  SECURITY_ALERT_EMAILS  destinataires des alertes de securite, separes par
                         des virgules (ex. "admin@ecole.tg, rssi@ecole.tg").

Tant que SMTP_HOST n'est pas defini, le service tourne en mode SIMULATION :
aucun appel reseau, l'appel est considere comme reussi (`simulated=True`).
Cela permet d'utiliser le code en dev sans serveur mail.
"""
import os
import smtplib
import ssl
from email.message import EmailMessage


def _env(name, default=""):
    return (os.getenv(name, default) or "").strip()


def _security():
    """Mode de chiffrement du transport : 'starttls' | 'ssl' | 'none'."""
    s = (_env("SMTP_SECURITY", "starttls") or "starttls").lower()
    return s if s in ("starttls", "ssl", "none") else "starttls"


def _port():
    raw = _env("SMTP_PORT")
    if raw.isdigit():
        return int(raw)
    return 465 if _security() == "ssl" else 587


def _from_addr():
    return _env("SMTP_FROM") or _env("SMTP_USER")


def _parse_recipients(raw):
    """Decoupe une liste d'adresses separees par des virgules / points-virgules."""
    if not raw:
        return []
    parts = str(raw).replace(";", ",").split(",")
    seen, out = set(), []
    for p in parts:
        a = p.strip()
        if a and "@" in a and a.lower() not in seen:
            seen.add(a.lower())
            out.append(a)
    return out


def alert_recipients():
    """Destinataires des alertes de securite (depuis SECURITY_ALERT_EMAILS)."""
    return _parse_recipients(_env("SECURITY_ALERT_EMAILS"))


def configured():
    """True si un serveur SMTP est defini (sinon : mode simulation)."""
    return bool(_env("SMTP_HOST"))


def status():
    """Resume (sans secret) de la configuration email, pour l'UI/diagnostic."""
    return {
        "configured": configured(),
        "simulation": not configured(),
        "host": _env("SMTP_HOST"),
        "port": _port() if configured() else None,
        "security": _security(),
        "from": _from_addr(),
        "alert_recipients": alert_recipients(),
    }


def send_email(subject, body, to=None, html=None):
    """Envoie un email texte (et HTML optionnel). Renvoie un dict resultat.

    subject : objet du message.
    body    : corps en texte brut.
    to      : destinataire(s) ; chaine, liste, ou None -> alert_recipients().
    html    : corps HTML optionnel (alternative multipart).

    En mode simulation (SMTP_HOST absent) : aucun appel reseau, ok=True,
    simulated=True. Jamais d'exception propagee : les erreurs sont captees et
    renvoyees dans `info`.
    """
    if to is None:
        recipients = alert_recipients()
    elif isinstance(to, (list, tuple, set)):
        recipients = _parse_recipients(",".join(str(x) for x in to))
    else:
        recipients = _parse_recipients(str(to))

    res = {"ok": False, "simulated": False,
           "recipients": recipients, "info": ""}

    if not recipients:
        res["info"] = "aucun_destinataire"
        return res

    if not configured():
        res.update(ok=True, simulated=True, info="simulation")
        return res

    sender = _from_addr()
    if not sender:
        res["info"] = "expediteur_absent"
        return res

    msg = EmailMessage()
    msg["Subject"] = subject or "(sans objet)"
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.set_content(body or "")
    if html:
        msg.add_alternative(html, subtype="html")

    host, port, sec = _env("SMTP_HOST"), _port(), _security()
    user, pwd = _env("SMTP_USER"), _env("SMTP_PASSWORD")
    timeout = int(_env("SMTP_TIMEOUT", "12") or "12")
    try:
        if sec == "ssl":
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, timeout=timeout, context=ctx) as s:
                if user:
                    s.login(user, pwd)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=timeout) as s:
                s.ehlo()
                if sec == "starttls":
                    s.starttls(context=ssl.create_default_context())
                    s.ehlo()
                if user:
                    s.login(user, pwd)
                s.send_message(msg)
        res.update(ok=True, info="envoye")
    except Exception as e:  # noqa: BLE001 - message lisible, jamais propage
        res["info"] = str(e)[:200]
    return res
