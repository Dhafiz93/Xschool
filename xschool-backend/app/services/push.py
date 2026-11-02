"""Transport des notifications push mobiles (best-effort, bibliotheque standard).

Meme philosophie que `email.py` : AUCUNE dependance tierce (urllib standard),
toute la configuration vit dans l'environnement. Tant qu'aucun fournisseur
n'est configure, le service tourne en SIMULATION (aucun appel reseau, ok=True,
simulated=True) : le code reste utilisable en dev sans cle push.

Fournisseur par defaut : Firebase Cloud Messaging via l'API HTTP "legacy"
(un simple POST JSON avec une cle serveur) -> aucune dependance a installer.

Variables d'environnement :
  PUSH_PROVIDER   'fcm' (defaut) | 'none' (desactive explicitement l'envoi).
  FCM_SERVER_KEY  cle serveur FCM (en-tete Authorization: key=...). Vide -> simulation.
  FCM_ENDPOINT    surcharge de l'URL (defaut https://fcm.googleapis.com/fcm/send).
  PUSH_TIMEOUT    delai reseau en secondes (defaut 10).

Jamais d'exception propagee : les erreurs sont captees et renvoyees dans `info`.
`send_push` renvoie aussi `invalid_tokens` (jetons signales invalides par FCM),
que l'appelant peut desactiver en base pour ne plus les solliciter.
"""
import json
import os
import urllib.error
import urllib.request

FCM_DEFAULT_ENDPOINT = "https://fcm.googleapis.com/fcm/send"
# Codes d'erreur FCM signalant un jeton a oublier definitivement.
_DEAD_TOKEN_ERRORS = {"NotRegistered", "InvalidRegistration", "MismatchSenderId"}


def _env(name, default=""):
    return (os.getenv(name, default) or "").strip()


def _provider():
    return (_env("PUSH_PROVIDER", "fcm") or "fcm").lower()


def configured():
    """True si un fournisseur push est pret (sinon : mode simulation)."""
    return _provider() == "fcm" and bool(_env("FCM_SERVER_KEY"))


def status():
    """Resume (sans secret) de la config push, pour l'UI/diagnostic."""
    return {
        "configured": configured(),
        "simulation": not configured(),
        "provider": _provider(),
    }


def send_push(payload, tokens):
    """Envoie un push a une liste de jetons d'appareils. Renvoie un dict resultat.

    payload : dict produit par `push_templates` ({title, body, priority, data}).
    tokens  : liste de jetons d'appareils (chaines).

    En simulation (pas de cle) : aucun appel reseau, ok=True, simulated=True.
    Jamais d'exception propagee.
    """
    tokens = [t for t in dict.fromkeys(tokens or []) if t]  # dedup + non vides
    res = {"ok": False, "simulated": False, "sent": 0,
           "tokens": len(tokens), "invalid_tokens": [], "info": ""}

    if not tokens:
        res["info"] = "aucun_jeton"
        return res

    if not configured():
        res.update(ok=True, simulated=True, sent=len(tokens), info="simulation")
        return res

    data = payload.get("data", {}) if isinstance(payload, dict) else {}
    message = {
        "registration_ids": tokens,
        "notification": {
            "title": (payload or {}).get("title", ""),
            "body": (payload or {}).get("body", ""),
        },
        "data": data,
        "priority": "high" if (payload or {}).get("priority") == "high"
        else "normal",
    }

    endpoint = _env("FCM_ENDPOINT") or FCM_DEFAULT_ENDPOINT
    timeout = int(_env("PUSH_TIMEOUT", "10") or "10")
    raw_body = json.dumps(message).encode("utf-8")
    req = urllib.request.Request(endpoint, data=raw_body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "key=" + _env("FCM_SERVER_KEY"))

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(text)
        except ValueError:
            parsed = {}
        results = parsed.get("results") if isinstance(parsed, dict) else None
        if isinstance(results, list):
            for tok, item in zip(tokens, results):
                if (item or {}).get("error") in _DEAD_TOKEN_ERRORS:
                    res["invalid_tokens"].append(tok)
            res["sent"] = len(tokens) - len(res["invalid_tokens"])
        else:
            res["sent"] = len(tokens)
        res.update(ok=True, info="envoye")
    except urllib.error.HTTPError as e:
        res["info"] = "http_{}".format(e.code)
    except Exception as e:  # noqa: BLE001 - message lisible, jamais propage
        res["info"] = str(e)[:200]
    return res
