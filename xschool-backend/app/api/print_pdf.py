"""Rendu PDF 100% serveur via WeasyPrint.

Le client (fenetre d'apercu avant impression) envoie le HTML complet du
document a imprimer (meme HTML/CSS que la previsualisation navigateur).
WeasyPrint effectue la mise en page cote serveur et renvoie le PDF en
telechargement : aucune dependance au moteur d'impression du navigateur ni a
une librairie chargee depuis un CDN.

Endpoint :
    POST /api/print/pdf
        body : { "html": "<!doctype html>...", "filename": "Bulletins ....pdf" }
        -> application/pdf (Content-Disposition: attachment)

Dependances serveur : paquet Python `weasyprint` + ses bibliotheques systeme
(Pango, Cairo, GDK-PixBuf, libffi). Si WeasyPrint n'est pas installe, l'endpoint
renvoie 501 et le client retombe sur l'impression navigateur.

Note securite : le HTML fourni est rendu tel quel par WeasyPrint. WeasyPrint
n'execute PAS de JavaScript (les <script> sont ignores), ce qui ecarte le
risque XSS cote rendu. On borne tout de meme la taille du HTML accepte.
"""
import re

from flask import Response, jsonify, request

from ..extensions import limiter
from ..utils.security import role_required
from . import api_bp
from .common import STAFF, body, commit, log_action

_MAX_HTML = 4 * 1024 * 1024  # 4 Mo de HTML au maximum


def _safe_filename(name):
    """Nom de fichier sur, termine par .pdf, borne a 120 caracteres."""
    name = (name or "").strip()
    name = re.sub(r"\.pdf$", "", name, flags=re.IGNORECASE)
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        name = "document"
    return name[:120] + ".pdf"


@api_bp.post("/print/pdf")
@role_required(*STAFF)
@limiter.limit("20 per minute")
def print_pdf():
    data = body()
    html = data.get("html") or ""
    if not isinstance(html, str) or not html.strip():
        return jsonify(error="html_manquant"), 400
    if len(html) > _MAX_HTML:
        return jsonify(error="html_trop_volumineux"), 413

    try:
        from weasyprint import HTML  # import paresseux : absence => 501 propre
    except Exception as exc:  # noqa: BLE001
        return (
            jsonify(
                error="weasyprint_indisponible",
                detail=("WeasyPrint n'est pas installe sur le serveur "
                        "(paquet python `weasyprint` + librairies systeme Pango/Cairo). "
                        + str(exc)[:160]),
            ),
            501,
        )

    try:
        pdf = HTML(string=html, base_url=request.host_url).write_pdf()
    except Exception as exc:  # noqa: BLE001
        return jsonify(error="rendu_pdf_echec", detail=str(exc)[:300]), 500

    filename = _safe_filename(data.get("filename"))
    try:
        log_action("print_pdf", target=filename)
        commit()
    except Exception:  # noqa: BLE001
        pass

    return Response(
        pdf,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="%s"' % filename,
            "Content-Length": str(len(pdf)),
            "Cache-Control": "no-store",
        },
    )
