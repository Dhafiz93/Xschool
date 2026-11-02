"""Catalogue central des alertes XSchool (cloche + email + push).

Un SEUL endroit decrit le TEXTE (titre/corps) et l'ALLURE (severite/icone) de
CHAQUE type d'alerte (`kind`). Les routes API n'ecrivent plus les libelles a la
main : elles appellent `build(kind, **ctx)` puis passent `title`/`body` a
`notify_center.notify_users`. Le front possede un petit miroir presentatif
(`severity`/`icon` par kind) pour colorer les toasts et la cloche.

Champs renvoyes par `build` ::

    {
      "kind":     str,   # le kind demande (echo)
      "title":    str,   # titre court de la cloche / du push
      "body":     str,   # corps de la cloche / du push
      "severity": str,   # "info" | "success" | "warning" | "danger"
      "icon":     str,   # emoji decoratif (le sens ne doit pas en dependre)
      "channel":  str,   # canal Android pour le push ("exercices"...)
      "priority": str,   # "high" | "normal" (push)
    }

Regles :
  - Les textes reproduisent a l'identique les libelles historiques des routes,
    pour ne RIEN changer au comportement visible cote utilisateur.
  - Tout est best-effort : un kind inconnu retombe sur le gabarit "info".
  - Aucune dependance a la base : ce module ne fait que formater des chaines.
"""

# --- Allure (severite / icone / canal push) par kind -------------------------
# severity : pilote la couleur du toast et de la cloche cote front.
# channel/priority : repris tel quel par la couche push (cf. push_templates).
_META = {
    "exercise_pdf":        {"severity": "info",    "icon": "\U0001F4C4", "channel": "exercices", "priority": "normal"},
    "exercise_quiz":       {"severity": "info",    "icon": "\U0001F4DD", "channel": "exercices", "priority": "normal"},
    "exercise_published":  {"severity": "info",    "icon": "\U0001F4E2", "channel": "exercices", "priority": "normal"},
    "exercise_reminder":   {"severity": "warning", "icon": "\u23F0",     "channel": "exercices", "priority": "high"},
    "exercise_overdue":    {"severity": "danger",  "icon": "\u26A0\uFE0F", "channel": "exercices", "priority": "high"},
    "exercise_submission": {"severity": "success", "icon": "\U0001F4E5", "channel": "exercices", "priority": "normal"},
    "grade_posted":        {"severity": "success", "icon": "\U0001F393", "channel": "notes",     "priority": "normal"},
    "info":                {"severity": "info",    "icon": "\U0001F514", "channel": "general",   "priority": "normal"},
}

_DEFAULT_META = _META["info"]


def _g(ctx, key, default=""):
    v = ctx.get(key, default)
    return default if v is None else v


# --- Renderers : (ctx) -> (title, body) --------------------------------------
# Chacun reproduit exactement le libelle historique de la route correspondante.

def _r_exercise_new(ctx):
    """Nouvel exercice depose (PDF ou quiz) -> eleves de la classe."""
    title = "Nouvel exercice : {}".format(_g(ctx, "exercise_title"))
    body = ("Un nouvel exercice vient d'etre depose dans ton espace. "
            "Rends-toi dans l'onglet Exercices pour le consulter.")
    return title, body


def _r_exercise_published(ctx):
    """Publication d'un exercice (kind catalogue, non emis a ce jour)."""
    title = "Exercice publie : {}".format(_g(ctx, "exercise_title"))
    body = ("Un exercice vient d'etre publie. Ouvre l'onglet Exercices "
            "pour le consulter.")
    return title, body


def _r_exercise_reminder(ctx):
    """Rappel J-N : exercice non rendu, echeance proche."""
    title = "Rappel : {}".format(_g(ctx, "exercise_title"))
    tail = " avant la fin du delai." if _g(ctx, "has_echeance", False) else "."
    body = ("Tu n'as pas encore rendu cet exercice. "
            "Rends-toi dans l'onglet Exercices pour le terminer" + tail)
    return title, body


def _r_exercise_overdue(ctx):
    """Exercice en retard : echeance depassee, toujours pas rendu."""
    title = "En retard : {}".format(_g(ctx, "exercise_title"))
    body = ("L'echeance est passee et tu n'as pas encore rendu cet "
            "exercice. Rends-le au plus vite dans l'onglet Exercices.")
    return title, body


def _r_exercise_submission(ctx):
    """Un eleve a rendu / soumis -> prof auteur. `label` = 'Rendu' | 'Soumis'."""
    label = _g(ctx, "label") or "Depot"
    student = _g(ctx, "student_name")
    title_exo = _g(ctx, "exercise_title")
    title = "{} : {}".format(label, title_exo)
    body = "{} a {} pour l'exercice \"{}\".".format(
        student, label.lower(), title_exo)
    return title, body


def _r_grade_posted(ctx):
    """Nouvelle note publiee (kind catalogue, non emis a ce jour)."""
    subject = _g(ctx, "subject_name")
    title = "Nouvelle note{}".format(" : " + subject if subject else "")
    body = ("Une nouvelle note vient d'etre publiee. Consulte ton bulletin "
            "dans ton espace XSchool.")
    return title, body


def _r_generic(ctx):
    """Gabarit de secours : respecte un title/body explicite s'il est fourni."""
    title = _g(ctx, "title") or "Notification"
    body = _g(ctx, "body")
    return title, body


_RENDERERS = {
    "exercise_pdf": _r_exercise_new,
    "exercise_quiz": _r_exercise_new,
    "exercise_published": _r_exercise_published,
    "exercise_reminder": _r_exercise_reminder,
    "exercise_overdue": _r_exercise_overdue,
    "exercise_submission": _r_exercise_submission,
    "grade_posted": _r_grade_posted,
    "info": _r_generic,
}


def kinds():
    """Liste de tous les kinds connus du catalogue (diagnostic/tests)."""
    return sorted(_META.keys())


def meta(kind):
    """Allure (severity/icon/channel/priority) d'un kind, avec repli 'info'."""
    return dict(_META.get(kind, _DEFAULT_META))


def build(kind, **ctx):
    """Construit l'alerte complete d'un `kind` a partir du contexte `ctx`.

    Un `title`/`body` passe explicitement dans `ctx` est respecte pour le
    gabarit generique ; les gabarits specifiques fabriquent le texte eux-memes.
    Ne leve jamais : un kind inconnu retombe sur "info".
    """
    m = _META.get(kind, _DEFAULT_META)
    renderer = _RENDERERS.get(kind, _r_generic)
    try:
        title, body = renderer(ctx)
    except Exception:  # noqa: BLE001 - une alerte ne doit jamais casser l'action
        title, body = _r_generic(ctx)
    return {
        "kind": kind,
        "title": title or "",
        "body": body or "",
        "severity": m["severity"],
        "icon": m["icon"],
        "channel": m["channel"],
        "priority": m["priority"],
    }
