"""Notes : lignes (classe, matiere, periode, eleve, annee). Upsert cle unique."""
import datetime

from flask import current_app, jsonify
from flask_jwt_extended import get_current_user

from ..extensions import db
from ..models.academics import SchoolClass
from ..models.grades import Grade
from ..models.school import School
from ..models.user import ROLE_ADMIN, ROLE_TEACHER
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg, as_float, body, commit, err, intval, log_action, write_school_id


def _dict(g):
    return {
        "id": g.id, "year": g.year, "period": g.period, "class_id": g.class_id,
        "subject_id": g.subject_id, "student_id": g.student_id,
        "detail": g.detail or [], "moy": as_float(g.moy),
    }


@api_bp.get("/grades")
@role_required(*STAFF)
def list_grades():
    q = scoped_query(Grade)
    for field, col in (("class_id", Grade.class_id), ("subject_id", Grade.subject_id),
                       ("student_id", Grade.student_id)):
        v = intval(arg(field))
        if v is not None:
            q = q.filter(col == v)
    if arg("period"):
        q = q.filter(Grade.period == arg("period"))
    if arg("year"):
        q = q.filter(Grade.year == arg("year"))
    return jsonify(items=[_dict(g) for g in q.all()])


# ---------------------------------------------------------------------------
# Verrou de saisie : l'administration peut desactiver la saisie des notes par
# les enseignants (par cycle) ou fixer une date limite. L'admin/superadmin ne
# sont jamais bloques ; le controle cote serveur empeche un enseignant de
# contourner le verrou via l'API meme si le bouton est masque cote client.
# ---------------------------------------------------------------------------
def _teacher_lock_cfg(sid):
    """Renvoie la SchoolConfig a appliquer pour l'enforcement du verrou.

    - utilisateur courant enseignant -> sa config d'ecole (verrou actif) ;
    - admin / superadmin / autre role -> None (jamais bloques).
    """
    user = get_current_user()
    if user is None or getattr(user, "is_superadmin", False):
        return None
    if getattr(user, "role", None) != ROLE_TEACHER or sid is None:
        return None
    try:
        s = db.session.get(School, sid)
        return s.config if s is not None else None
    except Exception:
        # Schema desaligne (ex. colonnes teacher_grades/deadlines/periods
        # absentes de school_configs apres une evolution du modele) : la
        # lecture de la config leve alors une erreur Postgres (UndefinedColumn)
        # et faisait planter l'enregistrement des notes cote enseignant (500).
        # On nettoie la session et on degrade proprement en "pas de verrou"
        # (comme un admin) pour que la saisie reste possible ; l'alignement se
        # fait ensuite avec `flask fix-schema`.
        db.session.rollback()
        current_app.logger.warning(
            "Verrou de saisie ignore : lecture de la config d'ecole impossible "
            "(schema desaligne ?). Lance `flask fix-schema` pour ajouter les "
            "colonnes manquantes de school_configs.",
            exc_info=True,
        )
        return None


def _saisie_bloquee(cfg, class_id, year, period):
    """Renvoie (code, message) si la saisie est verrouillee, sinon None.

    `cfg` None (admin/superadmin) => jamais bloque. Verifie d'abord le blocage
    du cycle (teacher_grades[cycle] is False), puis la date limite
    (deadlines["annee|cycle|periode"] depassee).
    """
    if cfg is None or class_id is None:
        return None
    cls = db.session.get(SchoolClass, class_id)
    cycle = (getattr(cls, "cycle", "") or "") if cls is not None else ""
    if (cfg.teacher_grades or {}).get(cycle) is False:
        return ("saisie_bloquee",
                f"La saisie des notes est desactivee par l'administration pour le cycle « {cycle} ».")
    dl = (cfg.deadlines or {}).get(f"{year}|{cycle}|{period}")
    if dl and datetime.date.today().isoformat() > dl:
        return ("date_limite_depassee",
                f"La date limite de saisie ({dl}) pour {period} est depassee. Contacte l'administration.")
    return None


def _upsert_one(data, sid):
    year = (data.get("year") or "").strip()
    period = (data.get("period") or "").strip()
    cid = intval(data.get("class_id"))
    subid = intval(data.get("subject_id"))
    stid = intval(data.get("student_id"))
    if not year or not period or None in (cid, subid, stid):
        return None, "champs_requis: year, period, class_id, subject_id, student_id"
    g = scoped_query(Grade).filter(
        Grade.year == year, Grade.period == period, Grade.class_id == cid,
        Grade.subject_id == subid, Grade.student_id == stid).first()
    if g is None:
        g = Grade(school_id=sid, year=year, period=period,
                  class_id=cid, subject_id=subid, student_id=stid)
        db.session.add(g)
    if "detail" in data:
        g.detail = data.get("detail") if isinstance(data.get("detail"), list) else []
    if "moy" in data:
        g.moy = as_float(data.get("moy"))
    return g, None


@api_bp.post("/grades")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def save_grades():
    data = body()
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    # Verrou de saisie : actif seulement pour les enseignants (None sinon).
    lock_cfg = _teacher_lock_cfg(sid)
    # mode lot : {"items": [ ... ]}
    if isinstance(data.get("items"), list):
        out = []
        for item in data["items"]:
            payload = dict(item)
            payload.setdefault("school_id", sid)
            blk = _saisie_bloquee(lock_cfg, intval(payload.get("class_id")),
                                  (payload.get("year") or "").strip(),
                                  (payload.get("period") or "").strip())
            if blk:
                return jsonify(error=blk[0], message=blk[1]), 403
            g, e = _upsert_one(payload, sid)
            if e:
                return err(e)
            out.append(g)
        log_action("save_grades", "grades", f"{len(out)} note(s) enregistree(s)")
        commit()
        return jsonify(items=[_dict(g) for g in out]), 201
    blk = _saisie_bloquee(lock_cfg, intval(data.get("class_id")),
                          (data.get("year") or "").strip(),
                          (data.get("period") or "").strip())
    if blk:
        return jsonify(error=blk[0], message=blk[1]), 403
    g, e = _upsert_one(data, sid)
    if e:
        return err(e)
    log_action("save_grades", "grades",
               f"classe {g.class_id} / matiere {g.subject_id} / {g.period}")
    commit()
    return jsonify(grade=_dict(g)), 201


@api_bp.delete("/grades/<int:grade_id>")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def delete_grade(grade_id):
    g = get_scoped_or_404(Grade, grade_id)
    blk = _saisie_bloquee(_teacher_lock_cfg(g.school_id), g.class_id, g.year, g.period)
    if blk:
        return jsonify(error=blk[0], message=blk[1]), 403
    log_action("delete_grade", "grades",
               f"classe {g.class_id} / matiere {g.subject_id} / {g.period}")
    db.session.delete(g)
    commit()
    return jsonify(status="ok")


# ===========================================================================
# IMPORT / EXPORT EXCEL DES NOTES
# ---------------------------------------------------------------------------
# L'enseignant telecharge un modele .xlsx pre-rempli avec la liste des eleves
# d'une classe (pour une matiere/periode/annee), saisit les notes hors-ligne,
# puis re-televerse le fichier. Le serveur relit le classeur et fait l'upsert
# des notes (memes regles que la saisie en ligne : verrou de saisie + perimetre
# enseignant). La colonne « ID » (masquee) garantit un rattachement fiable a
# chaque eleve ; a defaut on retombe sur le matricule.
# ===========================================================================
import base64 as _b64
import io as _io

from ..models.academics import Subject
from ..models.people import Enrollment, Student
from ..utils.tenant import teacher_scope_ids

# Colonnes du modele (1-based) : A=ID masque, B=Matricule, C=Eleve, D/E/F=notes.
_TPL_COL_ID = 1
_TPL_COL_MAT = 2
_TPL_COL_NAME = 3
_TPL_COL_I = 4
_TPL_COL_D = 5
_TPL_COL_C = 6
_TPL_HEADER_ROW = 4  # les donnees eleves commencent a la ligne suivante


def _grade_num(v):
    """Convertit une cellule en nombre borne [0, 20]/gradeMax, ou '' si vide."""
    if v is None:
        return ""
    s = str(v).strip().replace(",", ".")
    if s == "":
        return ""
    try:
        return str(float(s))
    except (TypeError, ValueError):
        return ""


def _moy_from_cell(i, d, c):
    """Replique le calcul front : moyClasse=(i+d)/2 ; moyenne=(compo+moyCl)/2."""
    def num(x):
        if x in ("", None):
            return None
        try:
            return float(x)
        except (TypeError, ValueError):
            return None
    vi, vd, vc = num(i), num(d), num(c)
    parts = [x for x in (vi, vd) if x is not None]
    mc = sum(parts) / len(parts) if parts else None
    parts2 = [x for x in (mc, vc) if x is not None]
    return (sum(parts2) / len(parts2)) if parts2 else None


def _students_of_class(cid, year):
    """Eleves rattaches a la classe `cid` pour l'annee `year`.

    Union : inscriptions (Enrollment.year == year, class_id == cid) + eleves
    dont la classe courante est `cid` (retro-compat, sans inscription posee).
    """
    seen, out = set(), []
    if year:
        enr = (scoped_query(Enrollment)
               .filter(Enrollment.year == year, Enrollment.class_id == cid).all())
        sids = [e.student_id for e in enr]
        if sids:
            rows = scoped_query(Student).filter(Student.id.in_(sids)).all()
            for s in rows:
                if s.id not in seen:
                    seen.add(s.id)
                    out.append(s)
    for s in scoped_query(Student).filter(Student.class_id == cid).all():
        if s.id not in seen:
            seen.add(s.id)
            out.append(s)
    out.sort(key=lambda s: ((s.nom or ""), (s.prenom or "")))
    return out


def _scope_ok(cid, subid):
    """True si l'enseignant courant peut agir sur (classe, matiere).

    Admin/surveillant/superadmin : toujours autorises (scope None).
    """
    class_ids, subject_ids = teacher_scope_ids()
    if class_ids is None:
        return True
    return (cid in class_ids) and (subid in subject_ids)


@api_bp.get("/grades/template")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def grades_template():
    """Genere un classeur .xlsx (liste eleves + notes existantes) a remplir."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
    except Exception:  # openpyxl absent de l'environnement
        return err("openpyxl_absent: installe openpyxl (voir requirements.txt)", 500)

    cid = intval(arg("class_id"))
    subid = intval(arg("subject_id"))
    year = (arg("year") or "").strip()
    period = (arg("period") or "").strip()
    if None in (cid, subid) or not year or not period:
        return err("champs_requis: class_id, subject_id, year, period")
    if not _scope_ok(cid, subid):
        return err("classe_ou_matiere_hors_perimetre", 403)

    cls = get_scoped_or_404(SchoolClass, cid)
    sub = get_scoped_or_404(Subject, subid)
    students = _students_of_class(cid, year)

    # Notes deja saisies (pour pre-remplir le modele).
    existing = {}
    for g in (scoped_query(Grade).filter(
            Grade.year == year, Grade.period == period,
            Grade.class_id == cid, Grade.subject_id == subid).all()):
        cell = (g.detail or [{}])[0] if isinstance(g.detail, list) else {}
        existing[g.student_id] = cell or {}

    wb = Workbook()
    ws = wb.active
    ws.title = "Notes"
    bold = Font(bold=True)
    head_fill = PatternFill("solid", fgColor="1F2937")
    head_font = Font(bold=True, color="FFFFFF")
    center = Alignment(horizontal="center")

    ws.cell(row=1, column=1, value="XSchool — Saisie des notes").font = Font(bold=True, size=13)
    ws.cell(row=2, column=1,
            value=f"Classe : {cls.name or ''}   |   Matiere : {sub.name or ''}   "
                  f"|   Annee : {year}   |   Periode : {period}")
    ws.cell(row=3, column=1,
            value="Ne modifie PAS la colonne ID. Saisis les notes dans Interro / Devoir / Compo.")

    headers = ["ID", "Matricule", "Eleve", "Interro", "Devoir", "Compo"]
    for col, label in enumerate(headers, start=1):
        c = ws.cell(row=_TPL_HEADER_ROW, column=col, value=label)
        c.fill = head_fill
        c.font = head_font
        c.alignment = center

    r = _TPL_HEADER_ROW + 1
    for s in students:
        cell = existing.get(s.id, {})
        ws.cell(row=r, column=_TPL_COL_ID, value=s.id)
        ws.cell(row=r, column=_TPL_COL_MAT, value=s.matricule or "")
        ws.cell(row=r, column=_TPL_COL_NAME,
                value=((s.nom or "") + " " + (s.prenom or "")).strip())
        ws.cell(row=r, column=_TPL_COL_I, value=cell.get("i", "")).alignment = center
        ws.cell(row=r, column=_TPL_COL_D, value=cell.get("d", "")).alignment = center
        ws.cell(row=r, column=_TPL_COL_C, value=cell.get("c", "")).alignment = center
        r += 1

    # Largeurs + masquage de la colonne ID (A).
    ws.column_dimensions["A"].hidden = True
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 30
    for col in ("D", "E", "F"):
        ws.column_dimensions[col].width = 11
    ws.freeze_panes = "A" + str(_TPL_HEADER_ROW + 1)

    buf = _io.BytesIO()
    wb.save(buf)
    data_b64 = _b64.b64encode(buf.getvalue()).decode("ascii")
    safe = (cls.name or "classe").replace(" ", "_")
    fname = f"notes_{safe}_{period.replace(' ', '_')}.xlsx"
    log_action("grades_template", "grades",
               f"modele notes {cls.name} / {sub.name} / {period} ({len(students)} eleve(s))")
    return jsonify(
        filename=fname,
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data_b64=data_b64,
        count=len(students),
    )


@api_bp.post("/grades/import")
@role_required(ROLE_ADMIN, ROLE_TEACHER)
def grades_import():
    """Relit un modele .xlsx rempli et fait l'upsert des notes de la classe."""
    try:
        from openpyxl import load_workbook
    except Exception:
        return err("openpyxl_absent: installe openpyxl (voir requirements.txt)", 500)

    data = body()
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    cid = intval(data.get("class_id"))
    subid = intval(data.get("subject_id"))
    year = (data.get("year") or "").strip()
    period = (data.get("period") or "").strip()
    if None in (cid, subid) or not year or not period:
        return err("champs_requis: class_id, subject_id, year, period")
    if not _scope_ok(cid, subid):
        return err("classe_ou_matiere_hors_perimetre", 403)

    # Verrou de saisie enseignant (identique a la saisie en ligne).
    blk = _saisie_bloquee(_teacher_lock_cfg(sid), cid, year, period)
    if blk:
        return jsonify(error=blk[0], message=blk[1]), 403

    raw = data.get("data_b64") or data.get("file_b64") or ""
    if "," in raw and raw.strip().lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        blob = _b64.b64decode(raw)
    except Exception:
        return err("fichier_illisible: base64 invalide")
    if not blob:
        return err("fichier_vide")
    try:
        wb = load_workbook(_io.BytesIO(blob), read_only=True, data_only=True)
        ws = wb.active
    except Exception:
        return err("fichier_illisible: xlsx invalide")

    # Eleves autorises pour cette classe/annee (empeche d'injecter autrui).
    valid_ids = {s.id for s in _students_of_class(cid, year)}
    mat_to_id = {(s.matricule or "").strip(): s.id
                 for s in _students_of_class(cid, year) if (s.matricule or "").strip()}

    out, skipped = [], 0
    for row in ws.iter_rows(min_row=_TPL_HEADER_ROW + 1, values_only=True):
        if not row:
            continue
        stid = None
        idv = row[_TPL_COL_ID - 1] if len(row) >= _TPL_COL_ID else None
        if isinstance(idv, (int, float)):
            stid = int(idv)
        elif idv not in (None, ""):
            try:
                stid = int(str(idv).strip())
            except (TypeError, ValueError):
                stid = None
        if stid is None:  # fallback : matricule
            matv = row[_TPL_COL_MAT - 1] if len(row) >= _TPL_COL_MAT else None
            if matv not in (None, ""):
                stid = mat_to_id.get(str(matv).strip())
        if stid is None or stid not in valid_ids:
            skipped += 1
            continue
        gi = _grade_num(row[_TPL_COL_I - 1] if len(row) >= _TPL_COL_I else None)
        gd = _grade_num(row[_TPL_COL_D - 1] if len(row) >= _TPL_COL_D else None)
        gc = _grade_num(row[_TPL_COL_C - 1] if len(row) >= _TPL_COL_C else None)
        moy = _moy_from_cell(gi, gd, gc)
        g, e = _upsert_one({
            "year": year, "period": period, "class_id": cid, "subject_id": subid,
            "student_id": stid, "detail": [{"i": gi, "d": gd, "c": gc}], "moy": moy,
        }, sid)
        if e:
            return err(e)
        out.append(g)

    log_action("grades_import", "grades",
               f"import notes classe {cid} / matiere {subid} / {period} : "
               f"{len(out)} enregistree(s), {skipped} ignoree(s)")
    commit()
    return jsonify(items=[_dict(g) for g in out], saved=len(out), skipped=skipped), 201
