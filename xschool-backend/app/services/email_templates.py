"""Modeles d'emails XSchool (texte brut + HTML).

Chaque fonction renvoie un dict ``{"subject", "text", "html"}`` pret a passer
au service d'envoi (``email.send_email(subject, text, to=..., html=...)``).

Regles :
  - Tout contenu dynamique (titre, classe, etc.) est echappe pour le HTML
    (jamais de balise active, pas de script : c'est un email de courtoisie).
  - Le corps texte reste lisible seul (clients sans HTML, lecteurs d'ecran).
  - L'identite visuelle est volontairement sobre (styles inline, aucune image
    externe) pour un rendu fiable chez la majorite des clients mail.
"""
import html as _html
import os

APP_NAME = "XSchool"
BRAND = "#4f46e5"        # indigo de la marque (accent principal)
BRAND_DARK = "#4338ca"
TEXT = "#1e293b"
MUTED = "#64748b"
BORDER = "#e2e8f0"
BG = "#f1f5f9"
DANGER = "#dc2626"      # rouge (echeance depassee)
DANGER_DARK = "#b91c1c"


def _app_url():
    """URL publique du front (bouton d'action). Vide -> pas de lien clquable."""
    return (os.getenv("APP_PUBLIC_URL", "") or "").strip().rstrip("/")


def _e(value):
    """Echappe une valeur pour une insertion sure dans du HTML."""
    return _html.escape(str(value or ""), quote=True)


def _type_label(exercise_type):
    return "quiz" if exercise_type == "quiz" else "devoir (PDF)"


def _button(url, label, color=None):
    """Bouton d'action (table pour compat Outlook). Vide si pas d'URL."""
    if not url:
        return ""
    bg = color or BRAND
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="margin:24px 0;"><tr><td align="center" '
        'style="border-radius:10px;background:' + bg + ';">'
        '<a href="' + _e(url) + '" target="_blank" '
        'style="display:inline-block;padding:12px 26px;font-weight:700;'
        'font-size:15px;color:#ffffff;text-decoration:none;border-radius:10px;">'
        + _e(label) + '</a></td></tr></table>'
    )


def _shell(title, inner_html):
    """Gabarit commun : en-tete marque + carte blanche + pied discret."""
    year_hint = ""
    return (
        '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>' + _e(title) + '</title></head>'
        '<body style="margin:0;padding:0;background:' + BG + ';'
        'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
        'color:' + TEXT + ';">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:' + BG + ';padding:24px 12px;"><tr><td align="center">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:560px;background:#ffffff;border:1px solid ' + BORDER + ';'
        'border-radius:16px;overflow:hidden;">'
        # Bandeau marque
        '<tr><td style="background:' + BRAND + ';padding:18px 28px;">'
        '<span style="font-size:18px;font-weight:800;color:#ffffff;'
        'letter-spacing:.3px;">' + APP_NAME + '</span></td></tr>'
        # Contenu
        '<tr><td style="padding:28px;">' + inner_html + '</td></tr>'
        # Pied
        '<tr><td style="padding:18px 28px;border-top:1px solid ' + BORDER + ';'
        'background:#fafafa;">'
        '<p style="margin:0;font-size:12px;line-height:1.6;color:' + MUTED + ';">'
        'Message automatique envoye par ' + APP_NAME + '. '
        'Merci de ne pas repondre a cet email.' + year_hint + '</p>'
        '</td></tr></table></td></tr></table></body></html>'
    )


def exercise_reminder(*, exercise_title, exercise_type="pdf", echeance="",
                      class_name="", school_name="", days=1):
    """Email de rappel automatique aux eleves qui n'ont pas encore rendu.

    Parametres :
      exercise_title : titre de l'exercice.
      exercise_type  : 'quiz' ou 'pdf'.
      echeance       : date limite (texte AAAA-MM-JJ) ou ''.
      class_name     : nom de la classe destinataire (optionnel).
      school_name    : nom de l'etablissement (optionnel).
      days           : nombre de jours restants (1 = J-1).

    Renvoie ``{"subject", "text", "html"}``.
    """
    tlabel = _type_label(exercise_type)
    if days <= 0:
        delay = "aujourd'hui"
    elif days == 1:
        delay = "demain"
    else:
        delay = "dans {} jours".format(days)

    subject = "[{}] Rappel : \"{}\" a rendre {}".format(
        APP_NAME, exercise_title, delay)

    url = _app_url()
    link = (url + "/#exos") if url else ""

    # ---- Corps TEXTE (lisible seul) ----
    lines = [
        "Bonjour,",
        "",
        "Petit rappel : tu n'as pas encore rendu ce {} et l'echeance approche."
        .format(tlabel),
        "",
        "  Exercice  : {}".format(exercise_title),
        "  Type      : {}".format(tlabel),
    ]
    if class_name:
        lines.append("  Classe    : {}".format(class_name))
    if echeance:
        lines.append("  A rendre  : {} (soit {})".format(echeance, delay))
    else:
        lines.append("  A rendre  : {}".format(delay))
    lines += [
        "",
        "Connecte-toi a ton espace {}, onglet Exercices, pour le terminer"
        .format(APP_NAME) + (" :" if link else "."),
    ]
    if link:
        lines.append("  {}".format(link))
    lines += [
        "",
        "Si c'est deja fait, ignore ce message.",
        "",
        "-- ",
        (school_name + " · " if school_name else "") + APP_NAME
        + " (message automatique, ne pas repondre)",
    ]
    text = "\n".join(lines)

    # ---- Corps HTML ----
    rows = [("Exercice", exercise_title), ("Type", tlabel)]
    if class_name:
        rows.append(("Classe", class_name))
    rows.append(("A rendre", (echeance + " · " if echeance else "") + delay))

    detail_rows = "".join(
        '<tr>'
        '<td style="padding:6px 0;font-size:13px;color:' + MUTED + ';'
        'width:92px;vertical-align:top;">' + _e(k) + '</td>'
        '<td style="padding:6px 0;font-size:14px;font-weight:600;color:'
        + TEXT + ';">' + _e(v) + '</td></tr>'
        for k, v in rows
    )

    badge = (
        '<span style="display:inline-block;padding:4px 12px;border-radius:999px;'
        'background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">'
        '⏰ A rendre ' + _e(delay) + '</span>'
    )

    inner = (
        badge
        + '<h1 style="margin:14px 0 6px;font-size:20px;font-weight:800;color:'
        + TEXT + ';">Un petit rappel</h1>'
        + '<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:'
        + TEXT + ';">Bonjour,</p>'
        + '<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:'
        + TEXT + ';">Tu n\'as pas encore rendu ce ' + _e(tlabel)
        + ' et l\'echeance approche.</p>'
        + '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="margin:18px 0;width:100%;border:1px solid ' + BORDER + ';'
        'border-radius:12px;padding:6px 16px;background:#f8fafc;">'
        + detail_rows + '</table>'
        + _button(link, "Ouvrir mes exercices")
        + ('<p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:'
           + MUTED + ';">Connecte-toi a ton espace ' + APP_NAME
           + ', onglet Exercices, pour le terminer.</p>' if not link else '')
        + '<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:'
        + MUTED + ';">Si c\'est deja fait, tu peux ignorer ce message.</p>'
    )

    return {"subject": subject, "text": text, "html": _shell(subject, inner)}


def exercise_overdue(*, exercise_title, exercise_type="pdf", echeance="",
                     class_name="", school_name="", days_late=0):
    """Email pour un exercice EN RETARD (echeance deja depassee).

    Ton courtois mais plus ferme que le rappel J-1 : l'echeance est passee et
    le travail n'a toujours pas ete rendu. On invite a rendre au plus vite.

    Parametres :
      exercise_title : titre de l'exercice.
      exercise_type  : 'quiz' ou 'pdf'.
      echeance       : date limite (texte AAAA-MM-JJ) ou ''.
      class_name     : nom de la classe destinataire (optionnel).
      school_name    : nom de l'etablissement (optionnel).
      days_late      : nombre de jours de retard (>=0).

    Renvoie ``{"subject", "text", "html"}``.
    """
    tlabel = _type_label(exercise_type)
    d = max(int(days_late or 0), 0)
    if d <= 0:
        delay = "depuis aujourd'hui"
    elif d == 1:
        delay = "depuis 1 jour"
    else:
        delay = "depuis {} jours".format(d)

    subject = "[{}] En retard : \"{}\" n'est toujours pas rendu".format(
        APP_NAME, exercise_title)

    url = _app_url()
    link = (url + "/#exos") if url else ""

    # ---- Corps TEXTE (lisible seul) ----
    lines = [
        "Bonjour,",
        "",
        "L'echeance de ce {} est passee et ton travail n'a pas ete rendu."
        .format(tlabel),
        "",
        "  Exercice  : {}".format(exercise_title),
        "  Type      : {}".format(tlabel),
    ]
    if class_name:
        lines.append("  Classe    : {}".format(class_name))
    if echeance:
        lines.append("  Echeance  : {} (en retard {})".format(echeance, delay))
    else:
        lines.append("  Echeance  : depassee ({})".format(delay))
    lines += [
        "",
        "Rends-le au plus vite : connecte-toi a ton espace {}, onglet "
        "Exercices".format(APP_NAME) + (" :" if link else "."),
    ]
    if link:
        lines.append("  {}".format(link))
    lines += [
        "",
        "Si tu rencontres une difficulte, previens ton enseignant.",
        "Si c'est deja fait, ignore ce message.",
        "",
        "-- ",
        (school_name + " \u00b7 " if school_name else "") + APP_NAME
        + " (message automatique, ne pas repondre)",
    ]
    text = "\n".join(lines)

    # ---- Corps HTML ----
    rows = [("Exercice", exercise_title), ("Type", tlabel)]
    if class_name:
        rows.append(("Classe", class_name))
    rows.append(("Echeance", (echeance + " \u00b7 " if echeance else "")
                 + "en retard " + delay))

    detail_rows = "".join(
        '<tr>'
        '<td style="padding:6px 0;font-size:13px;color:' + MUTED + ';'
        'width:92px;vertical-align:top;">' + _e(k) + '</td>'
        '<td style="padding:6px 0;font-size:14px;font-weight:600;color:'
        + TEXT + ';">' + _e(v) + '</td></tr>'
        for k, v in rows
    )

    badge = (
        '<span style="display:inline-block;padding:4px 12px;border-radius:999px;'
        'background:#fee2e2;color:' + DANGER_DARK + ';font-size:12px;'
        'font-weight:700;">\u26a0\ufe0f En retard \u00b7 ' + _e(delay)
        + '</span>'
    )

    inner = (
        badge
        + '<h1 style="margin:14px 0 6px;font-size:20px;font-weight:800;color:'
        + TEXT + ';">Exercice non rendu</h1>'
        + '<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:'
        + TEXT + ';">Bonjour,</p>'
        + '<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:'
        + TEXT + ';">L\'echeance de ce ' + _e(tlabel)
        + ' est passee et ton travail n\'a pas ete rendu.</p>'
        + '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="margin:18px 0;width:100%;border:1px solid #fecaca;'
        'border-radius:12px;padding:6px 16px;background:#fef2f2;">'
        + detail_rows + '</table>'
        + _button(link, "Rendre maintenant", color=DANGER)
        + ('<p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:'
           + MUTED + ';">Connecte-toi a ton espace ' + APP_NAME
           + ', onglet Exercices, pour le rendre au plus vite.</p>'
           if not link else '')
        + '<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:'
        + MUTED + ';">Une difficulte ? Previens ton enseignant. '
        + 'Si c\'est deja fait, ignore ce message.</p>'
    )

    return {"subject": subject, "text": text, "html": _shell(subject, inner)}
