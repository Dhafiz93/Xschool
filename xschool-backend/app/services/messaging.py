"""Passerelle de messagerie (WhatsApp / SMS).

Abstraction d'un fournisseur d'envoi pour decoupler les routes API des details
de chaque passerelle. Aucun paquet tiers requis : on utilise uniquement la
librairie standard (urllib), ce qui evite d'ajouter une dependance au projet.

Fournisseurs supportes (variable d'env MESSAGING_PROVIDER) :
  - "none" / "log" : mode simulation (aucun appel reseau) ; utile en dev et
    comme comportement par defaut tant qu'aucune cle n'est configuree.
  - "meta"   : WhatsApp Cloud API (Meta / Facebook Graph API).
  - "twilio" : Twilio (WhatsApp et/ou SMS).
  - "generic": webhook HTTP JSON maison (POST {channel,to,text}).

Configuration via variables d'environnement (voir .env.example). Les cles ne
sont JAMAIS stockees en base ni renvoyees au client.
"""
import base64
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

_TIMEOUT = 12  # secondes


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _env(name, default=""):
    return (os.getenv(name, default) or "").strip()


def provider():
    """Fournisseur actif (minuscule). 'none' si non configure."""
    return (_env("MESSAGING_PROVIDER", "none") or "none").lower()


def normalize_msisdn(raw, default_cc=None):
    """Normalise un numero en format international (chiffres seuls, sans '+').

    default_cc : indicatif pays applique si le numero local a 8 chiffres
    (Togo = 228). Pilote par l'env DEFAULT_COUNTRY_CODE (defaut 228).
    """
    if default_cc is None:
        default_cc = _env("DEFAULT_COUNTRY_CODE", "228")
    d = re.sub(r"[^0-9]", "", str(raw or ""))
    if not d:
        return ""
    if len(d) == 8 and default_cc:
        d = str(default_cc) + d
    return d


def _http_post(url, data, headers, is_json=True):
    """POST simple via urllib. Renvoie (ok, status, body_text)."""
    if is_json:
        payload = json.dumps(data).encode("utf-8")
        headers = {"Content-Type": "application/json", **headers}
    else:
        payload = urllib.parse.urlencode(data).encode("utf-8")
        headers = {"Content-Type": "application/x-www-form-urlencoded", **headers}
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            return True, resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return False, e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001 - on remonte un message lisible
        return False, 0, str(e)


# ---------------------------------------------------------------------------
# Etat de la passerelle (pour l'UI : savoir si l'API est branchee)
# ---------------------------------------------------------------------------
def status():
    """Resume (sans secret) de la configuration de la passerelle."""
    p = provider()
    wa = sms = False
    if p == "meta":
        wa = bool(_env("WHATSAPP_TOKEN") and _env("WHATSAPP_PHONE_ID"))
    elif p == "twilio":
        ok = bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN"))
        wa = ok and bool(_env("TWILIO_WHATSAPP_FROM"))
        sms = ok and bool(_env("TWILIO_SMS_FROM"))
    elif p == "generic":
        wa = sms = bool(_env("GENERIC_WEBHOOK_URL"))
    return {
        "provider": p,
        "configured": (p not in ("none", "log")) and (wa or sms),
        "whatsapp": wa,
        "sms": sms,
        "simulation": p in ("none", "log"),
    }


# ---------------------------------------------------------------------------
# Envois par fournisseur
# ---------------------------------------------------------------------------
def _send_meta(to, text):
    base = _env("WHATSAPP_API_URL", "https://graph.facebook.com/v21.0")
    phone_id = _env("WHATSAPP_PHONE_ID")
    token = _env("WHATSAPP_TOKEN")
    if not (phone_id and token):
        return False, "meta_non_configure"
    url = f"{base.rstrip('/')}/{phone_id}/messages"
    data = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    ok, st, body = _http_post(url, data, {"Authorization": f"Bearer {token}"})
    return ok, (f"http {st}" if ok else f"http {st}: {body[:160]}")


def _send_twilio(channel, to, text):
    sid = _env("TWILIO_ACCOUNT_SID")
    tok = _env("TWILIO_AUTH_TOKEN")
    if not (sid and tok):
        return False, "twilio_non_configure"
    if channel == "whatsapp":
        frm = _env("TWILIO_WHATSAPP_FROM")  # ex: whatsapp:+14155238886
        dest = f"whatsapp:+{to}"
    else:
        frm = _env("TWILIO_SMS_FROM")       # ex: +14155238886
        dest = f"+{to}"
    if not frm:
        return False, "twilio_expediteur_absent"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    auth = base64.b64encode(f"{sid}:{tok}".encode()).decode()
    data = {"From": frm, "To": dest, "Body": text}
    ok, st, body = _http_post(url, data, {"Authorization": f"Basic {auth}"}, is_json=False)
    return ok, (f"http {st}" if ok else f"http {st}: {body[:160]}")


def _send_generic(channel, to, text):
    url = _env("GENERIC_WEBHOOK_URL")
    if not url:
        return False, "generic_non_configure"
    key = _env("GENERIC_API_KEY")
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    ok, st, body = _http_post(url, {"channel": channel, "to": to, "text": text}, headers)
    return ok, (f"http {st}" if ok else f"http {st}: {body[:160]}")


def send_message(channel, to, text):
    """Envoie un message unique. Renvoie un dict resultat normalise.

    channel : 'whatsapp' | 'sms'
    to      : numero (sera normalise au format international)
    """
    msisdn = normalize_msisdn(to)
    res = {"channel": channel, "to": msisdn, "ok": False, "simulated": False, "info": ""}
    if not msisdn:
        res["info"] = "numero_absent"
        return res

    p = provider()
    if p in ("none", "log"):
        res.update(ok=True, simulated=True, info="simulation")
        return res

    if p == "meta" and channel == "whatsapp":
        ok, info = _send_meta(msisdn, text)
    elif p == "twilio":
        ok, info = _send_twilio(channel, msisdn, text)
    elif p == "generic":
        ok, info = _send_generic(channel, msisdn, text)
    else:
        ok, info = False, f"canal_non_supporte_par_{p}"
    res.update(ok=ok, info=info)
    return res


def send_bulk(channel, recipients, text):
    """Envoie `text` a plusieurs destinataires.

    recipients : liste de dict {name, tel} ou de chaines (numeros).
    Renvoie un dict agrege {total, sent, failed, simulated, results[]}.
    """
    results = []
    sent = failed = simulated = 0
    for r in recipients:
        if isinstance(r, dict):
            name, tel = r.get("name", ""), r.get("tel") or r.get("to") or ""
        else:
            name, tel = "", r
        out = send_message(channel, tel, text)
        out["name"] = name
        results.append(out)
        if out["ok"] and out["simulated"]:
            simulated += 1
        elif out["ok"]:
            sent += 1
        else:
            failed += 1
    return {
        "total": len(results),
        "sent": sent,
        "failed": failed,
        "simulated": simulated,
        "results": results,
    }
