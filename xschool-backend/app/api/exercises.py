"""Exercices : cote enseignant (creer / publier / suivre) et cote eleve
(recevoir / rendre un PDF / faire un quiz chronometre).

Regles cle :
  - Multi-tenant : tout est filtre par school_id (scoped_query).
  - L'eleve ne voit JAMAIS les bonnes reponses d'un quiz (strip cote serveur)
    ni les notes de ses camarades (seulement QUI a soumis).
  - Le chrono du quiz est AUTORITAIRE cote serveur : `deadline_at` est une date
    absolue posee au demarrage ; fermer la page ne met pas le temps en pause.
    A l'expiration, la copie est corrigee automatiquement (finalize_expired).
  - Notifications : a la publication -> chaque eleve (cloche + email) ;
    a chaque rendu/soumission -> l'enseignant auteur (cloche + email).

Stockage PDF : data-URL base64 en colonne Text (comme les photos), borne a
`MAX_PDF_B64` caracteres pour eviter de saturer la base.
"""
from datetime import datetime, timedelta, timezone

from flask import jsonify
from flask_jwt_extended import get_current_user

from ..extensions import db
from ..models.exercise import (EXERCISE_TYPES, TYPE_PDF, TYPE_QUIZ,
                               Exercise, ExerciseSubmission,
                               ST_ASSIGNED, ST_IN_PROGRESS, ST_SUBMITTED,
                               ST_GRADED, ST_EXPIRED,
                               INCIDENT_TYPES, INC_OTHER)
from ..models.people import Student, Teacher
from ..models.academics import SchoolClass
from ..models.school import School
from ..models.user import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER, User
from ..services import notify_center
from ..services import email_templates
from ..services import alert_templates
from ..utils.security import role_required
from ..utils.tenant import (current_school_id, get_scoped_or_404,
                            scoped_query, teacher_scope_ids)
from . import api_bp
from .common import (arg, as_float, body, boolval, commit, err, intval,
                     log_action, numval, write_school_id)

# Taille max du PDF encode base64 (~ 8 Mo binaire -> ~ 11 Mo base64).
MAX_PDF_B64 = 11_000_000

# Nombre max d'incidents conserves en detail par copie (le compteur total,
# `incident_count`, reste exact meme au-dela). Borne la taille en base.
MAX_INCIDENTS_STORED = 200


def _now():
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------
# Resolution du compte courant -> fiche enseignant / eleve
# --------------------------------------------------------------------------
def _current_teacher_id():
    """Fiche enseignant liee au compte (None si admin/non lie)."""
    u = get_current_user()
    return getattr(u, "teacher_id", None)


def _current_student():
    """Fiche eleve liee au compte courant, ou None."""
    u = get_current_user()
    sid = getattr(u, "student_id", None)
    if not sid:
        return None
    return scoped_query(Student).filter(Student.id == sid).first()


def _teacher_user_ids(teacher_id):
    """Comptes utilisateurs lies a une fiche enseignant (pour notifier)."""
    if not teacher_id:
        return []
    rows = db.session.query(User.id).filter(User.teacher_id == teacher_id).all()
    return [r[0] for r in rows]


def _student_user_ids(student_ids):
    """{student_id: [user_id,...]} pour les eleves donnes."""
    out = {}
    if not student_ids:
        return out
    rows = (db.session.query(User.id, User.student_id)
            .filter(User.student_id.in_(list(student_ids))).all())
    for uid, sid in rows:
        out.setdefault(sid, []).append(uid)
    return out


# --------------------------------------------------------------------------
# Serialisation
# --------------------------------------------------------------------------
def _question_public(q):
    """Question SANS la bonne reponse (vue eleve)."""
    return {
        "id": q.get("id"),
        "text": q.get("text", ""),
        "type": q.get("type", "single"),
        "options": [{"id": o.get("id"), "text": o.get("text", "")}
                    for o in (q.get("options") or [])],
        "points": q.get("points", 0),
    }


def _ex_dict(ex, *, role="teacher", with_pdf=False):
    """Exercice serialise. Pour un eleve, les questions sont expurgees."""
    d = {
        "id": ex.id, "type": ex.type, "title": ex.title,
        "consignes": ex.consignes, "class_id": ex.class_id,
        "subject_id": ex.subject_id, "teacher_id": ex.teacher_id,
        "duree_min": ex.duree_min, "echeance": ex.echeance,
        "statut": ex.statut, "points_total": as_float(ex.points_total),
        "pdf_name": ex.pdf_name, "has_pdf": bool(ex.pdf_data),
        "created_at": ex.created_at.isoformat() if ex.created_at else None,
    }
    if ex.type == TYPE_QUIZ:
        if role == "student":
            d["questions"] = [_question_public(q) for q in (ex.questions or [])]
        else:
            d["questions"] = ex.questions or []
    if with_pdf:
        d["pdf_data"] = ex.pdf_data
    return d


def _sub_dict(sub, *, with_answers=False, with_note=True, with_incidents=False):
    d = {
        "id": sub.id, "exercise_id": sub.exercise_id,
        "student_id": sub.student_id, "statut": sub.statut,
        "reponse_name": sub.reponse_name, "has_reponse": bool(sub.reponse_data),
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
        "deadline_at": sub.deadline_at.isoformat() if sub.deadline_at else None,
        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        "auto_soumis": bool(sub.auto_soumis),
        # Compteur d'incidents anti-triche : expose partout (l'eleve voit le
        # sien, c'est aussi dissuasif), le detail reste reserve a l'enseignant.
        "incident_count": int(sub.incident_count or 0),
    }
    if with_note:
        d["note"] = as_float(sub.note)
        d["note_max"] = as_float(sub.note_max)
    if with_answers:
        d["answers"] = sub.answers or {}
    if with_incidents:
        d["incidents"] = sub.incidents or []
    return d


# --------------------------------------------------------------------------
# Validation / normalisation des questions de quiz
# --------------------------------------------------------------------------
def _normalize_questions(raw):
    """Nettoie la liste de questions fournie par l'enseignant.

    Chaque question : {id, text, type:'single'|'multi'|'text', options, correct,
    points}. Renvoie (questions, points_total) ou leve ValueError si invalide.
    """
    if not isinstance(raw, list) or not raw:
        raise ValueError("quiz_sans_question")
    out, total = [], 0.0
    for i, q in enumerate(raw):
        if not isinstance(q, dict):
            raise ValueError("question_invalide")
        qid = str(q.get("id") or "q{}".format(i + 1))
        qtype = q.get("type", "single")
        if qtype not in ("single", "multi", "text"):
            raise ValueError("type_question_invalide")
        text = (q.get("text") or "").strip()
        if not text:
            raise ValueError("question_sans_enonce")
        pts = numval(q.get("points"), 1) or 0
        total += float(pts)
        item = {"id": qid, "text": text, "type": qtype, "points": float(pts)}
        if qtype in ("single", "multi"):
            opts = []
            for j, o in enumerate(q.get("options") or []):
                oid = str(o.get("id") or "o{}".format(j + 1))
                opts.append({"id": oid, "text": (o.get("text") or "").strip()})
            if len(opts) < 2:
                raise ValueError("options_insuffisantes")
            correct = [str(c) for c in (q.get("correct") or [])]
            if not correct:
                raise ValueError("reponse_correcte_requise")
            valid_ids = {o["id"] for o in opts}
            if any(c not in valid_ids for c in correct):
                raise ValueError("reponse_correcte_inconnue")
            if qtype == "single" and len(correct) != 1:
                raise ValueError("single_une_seule_reponse")
            item["options"] = opts
            item["correct"] = correct
        else:  # text
            item["options"] = []
            item["correct"] = (q.get("correct") or "").strip()
        out.append(item)
    return out, round(total, 2)


def _grade(ex, answers):
    """Corrige une copie de quiz cote serveur -> (note, note_max)."""
    answers = answers or {}
    earned, total = 0.0, 0.0
    for q in (ex.questions or []):
        pts = float(q.get("points", 0) or 0)
        total += pts
        ans = answers.get(str(q.get("id")))
        qtype = q.get("type", "single")
        if qtype in ("single", "multi"):
            given = set(str(a) for a in (ans or []))
            correct = set(str(c) for c in (q.get("correct") or []))
            if given and given == correct:
                earned += pts
        else:  # text : comparaison insensible casse/espaces
            want = (q.get("correct") or "").strip().lower()
            got = (str(ans) if ans is not None else "").strip().lower()
            if want and got == want:
                earned += pts
    return round(earned, 2), round(total, 2)


def _finalize_expired(sub, ex):
    """Si le delai d'un quiz en cours est ecoule, corrige et fige la copie.

    Appele paresseusement a chaque lecture/action : garantit qu'une copie dont
    la page a ete fermee finit bien par etre notee (timer serveur autoritaire).
    Renvoie True si l'etat a change (a committer par l'appelant).
    """
    if ex.type != TYPE_QUIZ or sub.statut not in (ST_ASSIGNED, ST_IN_PROGRESS):
        return False
    if not sub.deadline_at or _now() < sub.deadline_at:
        return False
    note, note_max = _grade(ex, sub.answers)
    sub.note, sub.note_max = note, note_max
    sub.auto_soumis = True
    sub.submitted_at = sub.deadline_at
    sub.statut = ST_GRADED
    return True


# ==========================================================================
# COTE ENSEIGNANT
# ==========================================================================
_TEACHER_ROLES = (ROLE_TEACHER, ROLE_ADMIN)


@api_bp.get("/exercises")
@role_required(*_TEACHER_ROLES)
def list_exercises():
    """Liste les exercices (de l'ecole). Un enseignant lie ne voit que les siens
    sauf si c'est un admin ; filtrage facultatif par classe."""
    q = scoped_query(Exercise)
    u = get_current_user()
    tid = _current_teacher_id()
    if u.role == ROLE_TEACHER and tid:
        q = q.filter(Exercise.teacher_id == tid)
    cid = intval(arg("class_id"))
    if cid is not None:
        q = q.filter(Exercise.class_id == cid)
    rows = q.order_by(Exercise.created_at.desc()).all()
    return jsonify(items=[_ex_dict(e) for e in rows])


@api_bp.get("/exercises/<int:ex_id>")
@role_required(*_TEACHER_ROLES)
def get_exercise(ex_id):
    ex = get_scoped_or_404(Exercise, ex_id)
    return jsonify(exercise=_ex_dict(ex, with_pdf=True))


def _apply_exercise_payload(ex, data):
    """Applique le payload (creation/maj). Leve ValueError si invalide."""
    if "title" in data:
        ex.title = (data.get("title") or "").strip()
    if "consignes" in data:
        ex.consignes = (data.get("consignes") or "").strip()
    if "class_id" in data:
        ex.class_id = intval(data.get("class_id"))
    if "subject_id" in data:
        ex.subject_id = intval(data.get("subject_id"))
    if "echeance" in data:
        ex.echeance = (data.get("echeance") or "").strip()[:10]
    if ex.type == TYPE_PDF:
        if "pdf_data" in data:
            pdf = data.get("pdf_data") or ""
            if len(pdf) > MAX_PDF_B64:
                raise ValueError("pdf_trop_volumineux")
            ex.pdf_data = pdf
            ex.pdf_name = (data.get("pdf_name") or ex.pdf_name or "exercice.pdf")[:200]
    else:  # quiz
        if "questions" in data:
            questions, total = _normalize_questions(data.get("questions"))
            ex.questions = questions
            ex.points_total = total
        if "duree_min" in data:
            ex.duree_min = max(0, intval(data.get("duree_min"), 0))


@api_bp.post("/exercises")
@role_required(*_TEACHER_ROLES)
def create_exercise():
    data = body()
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    etype = data.get("type", TYPE_PDF)
    if etype not in EXERCISE_TYPES:
        return err("type_invalide")
    if not (data.get("title") or "").strip():
        return err("titre_requis")
    if intval(data.get("class_id")) is None:
        return err("classe_requise")
    # Garde-fou : un enseignant ne cree que pour SES classes / matieres.
    class_ids, subject_ids = teacher_scope_ids()
    if class_ids is not None:
        if intval(data.get("class_id")) not in class_ids:
            return err("classe_hors_perimetre", 403)
        subid = intval(data.get("subject_id"))
        if subid is not None and subid not in subject_ids:
            return err("matiere_hors_perimetre", 403)
    ex = Exercise(school_id=sid, type=etype,
                  teacher_id=_current_teacher_id(),
                  created_by_user_id=getattr(get_current_user(), "id", None),
                  statut="draft")
    try:
        _apply_exercise_payload(ex, data)
    except ValueError as e:
        return err(str(e))
    db.session.add(ex)
    db.session.flush()
    publish = boolval(data.get("publish"), False)
    log_action("create_exercise", "exercises", ex.title)
    if publish:
        _publish(ex)
    commit()
    return jsonify(exercise=_ex_dict(ex)), 201


@api_bp.put("/exercises/<int:ex_id>")
@role_required(*_TEACHER_ROLES)
def update_exercise(ex_id):
    ex = get_scoped_or_404(Exercise, ex_id)
    if ex.statut == "published":
        return err("exercice_publie_non_modifiable", 409)
    data = body()
    # Garde-fou : un enseignant ne reaffecte pas vers une classe / matiere
    # hors de son perimetre.
    class_ids, subject_ids = teacher_scope_ids()
    if class_ids is not None:
        if "class_id" in data and intval(data.get("class_id")) not in class_ids:
            return err("classe_hors_perimetre", 403)
        if "subject_id" in data:
            subid = intval(data.get("subject_id"))
            if subid is not None and subid not in subject_ids:
                return err("matiere_hors_perimetre", 403)
    try:
        _apply_exercise_payload(ex, data)
    except ValueError as e:
        return err(str(e))
    log_action("update_exercise", "exercises", ex.title)
    commit()
    return jsonify(exercise=_ex_dict(ex))


@api_bp.delete("/exercises/<int:ex_id>")
@role_required(*_TEACHER_ROLES)
def delete_exercise(ex_id):
    ex = get_scoped_or_404(Exercise, ex_id)
    db.session.delete(ex)
    log_action("delete_exercise", "exercises", ex.title)
    commit()
    return jsonify(ok=True)


def _publish(ex):
    """Publie l'exercice : cree une soumission par eleve de la classe + notifie.

    Idempotent : ne recree pas les soumissions deja presentes. A appeler dans
    une transaction ouverte (le commit est fait par l'appelant).
    """
    ex.statut = "published"
    students = scoped_query(Student).filter(Student.class_id == ex.class_id).all()
    existing = {s.student_id for s in
                db.session.query(ExerciseSubmission.student_id)
                .filter(ExerciseSubmission.exercise_id == ex.id).all()}
    new_student_ids = []
    for s in students:
        if s.id in existing:
            continue
        db.session.add(ExerciseSubmission(
            school_id=ex.school_id, exercise_id=ex.id, student_id=s.id,
            statut=ST_ASSIGNED))
        new_student_ids.append(s.id)
    db.session.flush()
    # Notifier les eleves concernes (cloche + email best-effort).
    user_map = _student_user_ids(new_student_ids)
    recipients = [uid for ids in user_map.values() for uid in ids]
    kind = "exercise_quiz" if ex.type == TYPE_QUIZ else "exercise_pdf"
    alert = alert_templates.build(kind, exercise_title=ex.title,
                                  exercise_type=ex.type)
    notify_center.notify_users(
        recipients, school_id=ex.school_id, kind=kind,
        title=alert["title"], body=alert["body"],
        ref_type="exercise", ref_id=ex.id,
        email_subject="[XSchool] Nouvel exercice : {}".format(ex.title),
        email_body="Bonjour,\n\nUn nouvel exercice ({}) vient d'etre depose : "
                   "\"{}\".\nConnecte-toi a ton espace XSchool, onglet "
                   "Exercices, pour le consulter.\n".format(
                       "quiz" if ex.type == TYPE_QUIZ else "PDF", ex.title))
    return len(new_student_ids)


@api_bp.post("/exercises/<int:ex_id>/publish")
@role_required(*_TEACHER_ROLES)
def publish_exercise(ex_id):
    ex = get_scoped_or_404(Exercise, ex_id)
    if ex.type == TYPE_QUIZ and not (ex.questions or []):
        return err("quiz_sans_question")
    if ex.type == TYPE_PDF and not ex.pdf_data:
        return err("pdf_manquant")
    n = _publish(ex)
    log_action("publish_exercise", "exercises", "{} (+{} eleves)".format(ex.title, n))
    commit()
    return jsonify(exercise=_ex_dict(ex), notifies=n)


def _days_until(echeance):
    """Jours restants avant une echeance 'AAAA-MM-JJ' (None si illisible)."""
    if not echeance:
        return None
    try:
        due = datetime.strptime(echeance, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    return (due - _now().date()).days


def _remind_core(ex):
    """Notifie les eleves non-rendus d'un exercice publie (cloche + email).

    Finalise d'abord les echeances expirees, cible les soumissions encore
    'assigned' / 'in_progress', envoie la relance via le centre de notifs.
    N'ECRIT PAS de journal d'audit et NE COMMITTE PAS : c'est a l'appelant de
    le faire (la route web journalise ; la commande CLI committe en lot). Ainsi
    la meme logique sert au bouton manuel ET a l'automatisation J-1.
    Renvoie le nombre d'eleves relances.
    """
    subs = (db.session.query(ExerciseSubmission)
            .filter(ExerciseSubmission.exercise_id == ex.id).all())
    for sub in subs:
        _finalize_expired(sub, ex)
    pending = [s.student_id for s in subs
               if s.statut in (ST_ASSIGNED, ST_IN_PROGRESS)]
    if not pending:
        return 0
    user_map = _student_user_ids(pending)
    recipients = [uid for ids in user_map.values() for uid in ids]

    # Contexte pour personnaliser le mail (classe + etablissement).
    cls = db.session.get(SchoolClass, ex.class_id) if ex.class_id else None
    school = db.session.get(School, ex.school_id) if ex.school_id else None
    days = _days_until(ex.echeance)

    # Echeance deja depassee -> mail "en retard" (ton plus ferme),
    # sinon rappel classique J-1. On adapte aussi le type de notif.
    if days is not None and days < 0:
        kind = "exercise_overdue"
        alert = alert_templates.build(kind, exercise_title=ex.title)
        mail = email_templates.exercise_overdue(
            exercise_title=ex.title, exercise_type=ex.type,
            echeance=ex.echeance or "",
            class_name=(cls.name if cls else ""),
            school_name=(school.name if school else ""),
            days_late=(-days))
    else:
        kind = "exercise_reminder"
        alert = alert_templates.build(kind, exercise_title=ex.title,
                                      has_echeance=bool(ex.echeance))
        mail = email_templates.exercise_reminder(
            exercise_title=ex.title, exercise_type=ex.type,
            echeance=ex.echeance or "",
            class_name=(cls.name if cls else ""),
            school_name=(school.name if school else ""),
            days=(days if days is not None else 1))

    notify_center.notify_users(
        recipients, school_id=ex.school_id, kind=kind,
        title=alert["title"],
        body=alert["body"],
        ref_type="exercise", ref_id=ex.id,
        email_subject=mail["subject"], email_body=mail["text"],
        email_html=mail["html"])
    return len(pending)


@api_bp.post("/exercises/<int:ex_id>/remind")
@role_required(*_TEACHER_ROLES)
def remind_exercise(ex_id):
    """Relance les eleves qui n'ont pas encore rendu (cloche + email).

    Cible les soumissions encore 'assigned' ou 'in_progress' (ni rendues ni
    corrigees). Les echeances expirees sont d'abord finalisees pour ne pas
    relancer inutilement. Best-effort : n'echoue pas si l'email tombe.
    """
    ex = get_scoped_or_404(Exercise, ex_id)
    if ex.statut != "published":
        return err("exercice_non_publie")
    n = _remind_core(ex)
    if n:
        log_action("remind_exercise", "exercises",
                   "{} ({} eleve(s) relance(s))".format(ex.title, n))
    commit()
    return jsonify(exercise=_ex_dict(ex), notifies=n, pending=n)


@api_bp.get("/exercises/<int:ex_id>/submissions")
@role_required(*_TEACHER_ROLES)
def exercise_submissions(ex_id):
    """Suivi enseignant : etat + note de chaque eleve (avec corrections lazy)."""
    ex = get_scoped_or_404(Exercise, ex_id)
    subs = (db.session.query(ExerciseSubmission)
            .filter(ExerciseSubmission.exercise_id == ex.id).all())
    changed = False
    for sub in subs:
        if _finalize_expired(sub, ex):
            changed = True
    if changed:
        commit()
    # Joindre nom de l'eleve pour l'affichage.
    smap = {s.id: s for s in scoped_query(Student).filter(
        Student.class_id == ex.class_id).all()}
    items = []
    for sub in subs:
        d = _sub_dict(sub, with_answers=(ex.type == TYPE_QUIZ),
                      with_incidents=(ex.type == TYPE_QUIZ))
        st = smap.get(sub.student_id)
        d["student_name"] = st.full_name if st else ""
        d["matricule"] = st.matricule if st else ""
        items.append(d)
    items.sort(key=lambda x: x["student_name"])
    return jsonify(exercise=_ex_dict(ex), items=items)


# ==========================================================================
# COTE ELEVE
# ==========================================================================
def _student_or_403():
    """(student, None) si le compte est bien lie a une fiche eleve,
    sinon (None, reponse 403)."""
    st = _current_student()
    if st is None:
        return None, err("compte_non_lie_eleve", 403)
    return st, None


def _get_submission(ex_id, student_id):
    return (db.session.query(ExerciseSubmission)
            .filter(ExerciseSubmission.exercise_id == ex_id,
                    ExerciseSubmission.student_id == student_id).first())


@api_bp.get("/me/exercises")
@role_required(ROLE_STUDENT)
def my_exercises():
    """Exercices recus par l'eleve connecte (avec l'etat de sa soumission)."""
    st, resp = _student_or_403()
    if resp:
        return resp
    subs = (db.session.query(ExerciseSubmission)
            .filter(ExerciseSubmission.student_id == st.id).all())
    ex_ids = [s.exercise_id for s in subs]
    ex_map = {}
    if ex_ids:
        ex_map = {e.id: e for e in scoped_query(Exercise).filter(
            Exercise.id.in_(ex_ids), Exercise.statut == "published").all()}
    changed = False
    items = []
    for sub in subs:
        ex = ex_map.get(sub.exercise_id)
        if ex is None:
            continue
        if _finalize_expired(sub, ex):
            changed = True
        d = _ex_dict(ex, role="student")
        d["submission"] = _sub_dict(sub, with_note=(ex.type == TYPE_QUIZ))
        items.append(d)
    if changed:
        commit()
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return jsonify(items=items)


def _load_my(ex_id):
    """(exercise, submission, student) pour l'eleve courant, ou (None, resp)."""
    st = _current_student()
    if st is None:
        return None, None, None, err("compte_non_lie_eleve", 403)
    ex = scoped_query(Exercise).filter(
        Exercise.id == ex_id, Exercise.statut == "published").first()
    if ex is None:
        return None, None, None, err("exercice_introuvable", 404)
    sub = _get_submission(ex_id, st.id)
    if sub is None:
        return None, None, None, err("exercice_non_assigne", 403)
    return ex, sub, st, None


@api_bp.get("/me/exercises/<int:ex_id>")
@role_required(ROLE_STUDENT)
def my_exercise_detail(ex_id):
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    if _finalize_expired(sub, ex):
        commit()
    d = _ex_dict(ex, role="student")
    # Reinjecter les reponses deja saisies (autosave) SANS les corrections.
    d["submission"] = _sub_dict(sub, with_answers=True,
                                with_note=(ex.type == TYPE_QUIZ))
    return jsonify(exercise=d)


@api_bp.get("/me/exercises/<int:ex_id>/pdf")
@role_required(ROLE_STUDENT)
def my_exercise_pdf(ex_id):
    """Renvoie le PDF de l'enonce (data-URL base64) pour telechargement cote front."""
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    if ex.type != TYPE_PDF or not ex.pdf_data:
        return err("pas_de_pdf", 404)
    return jsonify(pdf_name=ex.pdf_name, pdf_data=ex.pdf_data)


def _notify_teacher_submission(ex, st, label):
    """Previent l'enseignant auteur qu'un eleve a rendu/soumis."""
    recipients = _teacher_user_ids(ex.teacher_id)
    if not recipients:
        return
    alert = alert_templates.build(
        "exercise_submission", exercise_title=ex.title, label=label,
        student_name=(st.full_name or st.matricule))
    notify_center.notify_users(
        recipients, school_id=ex.school_id, kind="exercise_submission",
        title=alert["title"],
        body=alert["body"],
        ref_type="exercise", ref_id=ex.id,
        email_subject="[XSchool] {} - {}".format(label, ex.title),
        email_body="Bonjour,\n\n{} a {} pour l'exercice \"{}\".\n"
                   "Connecte-toi a ton espace XSchool pour le suivi.\n".format(
                       st.full_name or st.matricule, label.lower(), ex.title))


@api_bp.post("/me/exercises/<int:ex_id>/upload")
@role_required(ROLE_STUDENT)
def my_exercise_upload(ex_id):
    """Depot de la reponse PDF de l'eleve (exercice type PDF)."""
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    if ex.type != TYPE_PDF:
        return err("pas_un_exercice_pdf")
    data = body()
    pdf = data.get("pdf_data") or ""
    if not pdf:
        return err("fichier_requis")
    if len(pdf) > MAX_PDF_B64:
        return err("pdf_trop_volumineux")
    sub.reponse_data = pdf
    sub.reponse_name = (data.get("pdf_name") or "reponse.pdf")[:200]
    sub.statut = ST_SUBMITTED
    sub.submitted_at = _now()
    _notify_teacher_submission(ex, st, "Nouvelle remise")
    log_action("submit_exercise_pdf", "exercise_submissions", ex.title)
    commit()
    return jsonify(submission=_sub_dict(sub))


@api_bp.post("/me/exercises/<int:ex_id>/quiz/start")
@role_required(ROLE_STUDENT)
def my_quiz_start(ex_id):
    """Demarre le quiz : pose un chrono AUTORITAIRE cote serveur.

    Une fois demarre, `deadline_at` est fige : fermer la page ne met rien en
    pause. Re-appeler renvoie le chrono en cours (pas de reset).
    """
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    if ex.type != TYPE_QUIZ:
        return err("pas_un_quiz")
    if _finalize_expired(sub, ex):
        commit()
        return err("quiz_termine", 409)
    if sub.statut in (ST_SUBMITTED, ST_GRADED):
        return err("quiz_deja_soumis", 409)
    if not sub.started_at:
        sub.started_at = _now()
        if ex.duree_min and ex.duree_min > 0:
            sub.deadline_at = sub.started_at + timedelta(minutes=ex.duree_min)
        sub.statut = ST_IN_PROGRESS
        log_action("start_quiz", "exercise_submissions", ex.title)
        commit()
    remaining = None
    if sub.deadline_at:
        remaining = max(0, int((sub.deadline_at - _now()).total_seconds()))
    return jsonify(
        exercise=_ex_dict(ex, role="student"),
        submission=_sub_dict(sub, with_answers=True),
        remaining_seconds=remaining)


@api_bp.post("/me/exercises/<int:ex_id>/quiz/answer")
@role_required(ROLE_STUDENT)
def my_quiz_answer(ex_id):
    """Sauvegarde au fil de l'eau une reponse (autosave). {question_id, value}."""
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    if ex.type != TYPE_QUIZ:
        return err("pas_un_quiz")
    if _finalize_expired(sub, ex):
        commit()
        return err("quiz_termine", 409)
    if sub.statut in (ST_SUBMITTED, ST_GRADED):
        return err("quiz_deja_soumis", 409)
    data = body()
    qid = str(data.get("question_id") or "")
    if not qid:
        return err("question_id_requis")
    answers = dict(sub.answers or {})
    answers[qid] = data.get("value")
    sub.answers = answers
    if sub.statut == ST_ASSIGNED:
        sub.statut = ST_IN_PROGRESS
    commit()
    return jsonify(ok=True)


@api_bp.post("/me/exercises/<int:ex_id>/quiz/incident")
@role_required(ROLE_STUDENT)
def my_quiz_incident(ex_id):
    """Journalise un incident anti-triche signale par le front du quiz.

    Corps : {type, detail?}. Le serveur horodate lui-meme (jamais de confiance
    dans l'heure client) et incremente le compteur. N'enregistre que pendant
    que le quiz est en cours : une fois soumis/corrige/expire, on renvoie
    simplement recorded=False (le front ne casse pas).
    """
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    if ex.type != TYPE_QUIZ:
        return err("pas_un_quiz")
    if _finalize_expired(sub, ex):
        commit()
        return jsonify(ok=True, recorded=False, incident_count=int(sub.incident_count or 0))
    if sub.statut not in (ST_ASSIGNED, ST_IN_PROGRESS):
        return jsonify(ok=True, recorded=False, incident_count=int(sub.incident_count or 0))
    data = body()
    raw_type = str(data.get("type") or "").strip().lower()[:40]
    inc_type = raw_type if raw_type in INCIDENT_TYPES else INC_OTHER
    detail = str(data.get("detail") or "")[:200]
    entry = {"type": inc_type, "at": _now().isoformat()}
    if detail:
        entry["detail"] = detail
    # Le compteur total reste exact ; la liste detaillee est bornee.
    incidents = list(sub.incidents or [])
    incidents.append(entry)
    if len(incidents) > MAX_INCIDENTS_STORED:
        incidents = incidents[-MAX_INCIDENTS_STORED:]
    sub.incidents = incidents
    sub.incident_count = int(sub.incident_count or 0) + 1
    if sub.statut == ST_ASSIGNED:
        sub.statut = ST_IN_PROGRESS
    log_action("quiz_incident", "exercise_submissions",
               "{} ({})".format(ex.title, inc_type))
    commit()
    return jsonify(ok=True, recorded=True, incident_count=sub.incident_count)


@api_bp.post("/me/exercises/<int:ex_id>/quiz/submit")
@role_required(ROLE_STUDENT)
def my_quiz_submit(ex_id):
    """Soumet le quiz : correction cote serveur, note envoyee automatiquement.

    Accepte un `answers` complet optionnel (fusionne avec l'autosave).
    """
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    if ex.type != TYPE_QUIZ:
        return err("pas_un_quiz")
    if _finalize_expired(sub, ex):
        commit()
        return jsonify(submission=_sub_dict(sub), auto=True)
    if sub.statut in (ST_SUBMITTED, ST_GRADED):
        return err("quiz_deja_soumis", 409)
    data = body()
    if isinstance(data.get("answers"), dict):
        merged = dict(sub.answers or {})
        merged.update(data["answers"])
        sub.answers = merged
    note, note_max = _grade(ex, sub.answers)
    sub.note, sub.note_max = note, note_max
    sub.statut = ST_GRADED
    sub.submitted_at = _now()
    sub.auto_soumis = False
    _notify_teacher_submission(ex, st, "Quiz soumis")
    log_action("submit_quiz", "exercise_submissions",
               "{} ({}/{})".format(ex.title, note, note_max))
    commit()
    return jsonify(submission=_sub_dict(sub), auto=False)


@api_bp.get("/me/exercises/<int:ex_id>/classmates")
@role_required(ROLE_STUDENT)
def my_exercise_classmates(ex_id):
    """Qui a soumis dans la classe. JAMAIS les notes des autres eleves."""
    ex, sub, st, resp = _load_my(ex_id)
    if resp:
        return resp
    subs = (db.session.query(ExerciseSubmission)
            .filter(ExerciseSubmission.exercise_id == ex.id).all())
    smap = {s.id: s for s in scoped_query(Student).filter(
        Student.class_id == ex.class_id).all()}
    done = (ST_SUBMITTED, ST_GRADED)
    items = []
    for s in subs:
        person = smap.get(s.student_id)
        if person is None:
            continue
        items.append({
            "student_id": s.student_id,
            "student_name": person.full_name,
            "soumis": s.statut in done,
            "is_me": s.student_id == st.id,
        })
    items.sort(key=lambda x: x["student_name"])
    total = len(items)
    nb = sum(1 for x in items if x["soumis"])
    return jsonify(items=items, total=total, soumis=nb)


@api_bp.get("/exercises/<int:ex_id>/submissions/<int:sub_id>/pdf")
@role_required(*_TEACHER_ROLES)
def submission_pdf(ex_id, sub_id):
    """Recupere la reponse PDF (data-URL base64) rendue par un eleve.

    Reserve a l'enseignant / admin (routes _TEACHER_ROLES), scope ecole.
    """
    ex = get_scoped_or_404(Exercise, ex_id)
    sub = (db.session.query(ExerciseSubmission)
           .filter(ExerciseSubmission.id == sub_id,
                   ExerciseSubmission.exercise_id == ex.id,
                   ExerciseSubmission.school_id == ex.school_id).first())
    if sub is None:
        return err("soumission_introuvable", 404)
    if not sub.reponse_data:
        return err("pas_de_reponse", 404)
    return jsonify(pdf_name=sub.reponse_name or "reponse.pdf",
                   pdf_data=sub.reponse_data)
