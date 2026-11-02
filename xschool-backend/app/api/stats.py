"""Statistiques de resultats scolaires (globales ecole + par classe).

Port fidele de la logique du prototype front (stats.js : statSchoolData /
statClassData, et classBulletinData de views.js) cote serveur, en respectant
l'isolation multi-tenant (scoped_query). Tout le calcul (moyenne generale
ponderee/simple, reussite/echec/abandon, taux) est fait ici ; le client peut
ainsi consommer un resultat deja agrege au lieu de tout recalculer.

Endpoints :
    GET /api/stats/global              -> KPI ecole + une ligne par classe
    GET /api/stats/class/<class_id>    -> detail d'une classe + liste eleves

Parametres de query communs :
    year    annee scolaire (ex: 2025-2026). Defaut : derniere annee presente.
    period  libelle exact de periode (ex: \"Trimestre 1\"). Prioritaire sur idx.
    idx     -1 = Annuel (defaut), 0..n = index dans la liste des periodes.
"""
from flask import abort, jsonify

from ..extensions import db
from ..models.academics import Cycle, Program, SchoolClass, Subject
from ..models.grades import Grade
from ..models.people import Enrollment, Student
from ..models.school import SchoolConfig
from ..utils.security import role_required
from ..utils.tenant import (current_school_id, get_scoped_or_404, scoped_query,
                            teacher_scope_ids)
from . import api_bp
from .common import STAFF, arg, intval


# --------------------------------------------------------------------------
# Helpers config / arrondi (miroir de schoolCfg + avgRound du prototype).
# --------------------------------------------------------------------------
def _cfg():
    """Config de l'ecole courante, avec valeurs par defaut du prototype."""
    sid = current_school_id()
    cfg = None
    if sid is not None:
        cfg = db.session.query(SchoolConfig).filter(SchoolConfig.school_id == sid).first()
    return {
        "pass": float(cfg.pass_mark) if (cfg and cfg.pass_mark is not None) else 10.0,
        "avg_mode": (cfg.avg_mode if cfg else "weighted") or "weighted",
        "decimals": int(cfg.avg_decimals) if (cfg and cfg.avg_decimals is not None) else 2,
        "opt_fac": bool(cfg.opt_fac_coef1) if cfg else False,
        "grade_max": float(cfg.grade_max) if (cfg and cfg.grade_max is not None) else 20.0,
        "rank_ties": bool(cfg.rank_ties) if cfg else True,
        "mentions": [dict(m) for m in (cfg.mentions or [])] if cfg else [],
    }


def _mention_for(moy, cfg):
    """Libelle de mention pour une moyenne (miroir de mentionFor du front)."""
    ms = sorted((m for m in (cfg.get("mentions") or []) if m.get("l")),
                key=lambda m: -float(m.get("min") or 0))
    for m in ms:
        if moy >= float(m.get("min") or 0):
            return m.get("l")
    return None


def _round(n, decimals):
    """Arrondi \"demi vers le haut\" comme Math.round du front (notes positives)."""
    if n is None:
        return None
    f = 10 ** max(0, int(decimals))
    import math
    return math.floor(float(n) * f + 0.5) / f


def _round_int(n):
    import math
    return int(math.floor(float(n) + 0.5))


# --------------------------------------------------------------------------
# Resolution annee / periodes (base sur les donnees reelles, pas de libelles
# codes en dur : robuste aux conventions trimestre/semestre).
# --------------------------------------------------------------------------
def _default_year():
    """Derniere annee presente dans les notes, sinon les inscriptions."""
    row = (scoped_query(Grade).with_entities(Grade.year)
           .order_by(Grade.year.desc()).first())
    if row and row[0]:
        return row[0]
    row = (scoped_query(Enrollment).with_entities(Enrollment.year)
           .order_by(Enrollment.year.desc()).first())
    if row and row[0]:
        return row[0]
    from .classes import _current_school_year
    return _current_school_year()


def _periods_for(class_ids, year):
    """Liste ordonnee des periodes presentes dans les notes (scope + annee)."""
    q = (scoped_query(Grade).with_entities(Grade.period)
         .filter(Grade.year == year))
    if class_ids is not None:
        q = q.filter(Grade.class_id.in_(class_ids))
    seen, out = set(), []
    for (p,) in q.all():
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    out.sort()
    return out


# --------------------------------------------------------------------------
# Moyenne generale par eleve (miroir de classBulletinData + statMoyMap).
# --------------------------------------------------------------------------
def _program(class_id):
    """Lignes de programme d'une classe : [(subject_id, coef, oblig)]."""
    rows = (scoped_query(Program)
            .join(Subject, Subject.id == Program.subject_id)
            .filter(Program.class_id == class_id).all())
    return [(p.subject_id, float(p.coef or 0), bool(p.oblig)) for p in rows]


def _grade_map(class_id, period, year):
    """{(subject_id, student_id): moy} pour une classe/periode/annee."""
    rows = (scoped_query(Grade)
            .filter(Grade.class_id == class_id, Grade.period == period,
                    Grade.year == year).all())
    return {(g.subject_id, g.student_id): (None if g.moy is None else float(g.moy))
            for g in rows}


def _moygen_period(prog, gmap, student_id, cfg):
    """Moyenne generale d'un eleve pour une periode donnee (ou None)."""
    tot_pts = tot_coef = sum_moy = n_moy = 0.0
    fac_sum = 0.0
    fac_n = 0
    for subject_id, coef, oblig in prog:
        m = gmap.get((subject_id, student_id))
        fac = not oblig
        if cfg["opt_fac"] and fac:
            if m is not None:
                fac_sum += m
                fac_n += 1
            continue
        if m is not None:
            tot_pts += m * coef
            tot_coef += coef
            sum_moy += m
            n_moy += 1
    if cfg["opt_fac"] and fac_n:
        fac_moy = _round(fac_sum / fac_n, cfg["decimals"])
        tot_pts += fac_moy
        tot_coef += 1
        sum_moy += fac_moy
        n_moy += 1
    if cfg["avg_mode"] == "simple":
        moy = (sum_moy / n_moy) if n_moy else None
    else:
        moy = (tot_pts / tot_coef) if tot_coef else None
    return _round(moy, cfg["decimals"]) if moy is not None else None


def _moy_map(class_id, periods, idx, cfg, year):
    """{student_id: moyGen} : idx=-1 annuel (moyenne des periodes), sinon periode."""
    prog = _program(class_id)
    if idx == -1:
        acc, cnt = {}, {}
        for per in periods:
            gmap = _grade_map(class_id, per, year)
            ids = {sid for (_sub, sid) in gmap.keys()}
            for sid in ids:
                mg = _moygen_period(prog, gmap, sid, cfg)
                if mg is not None:
                    acc[sid] = acc.get(sid, 0.0) + mg
                    cnt[sid] = cnt.get(sid, 0) + 1
        return {sid: _round(acc[sid] / cnt[sid], cfg["decimals"]) for sid in acc}
    if 0 <= idx < len(periods):
        gmap = _grade_map(class_id, periods[idx], year)
        ids = {sid for (_sub, sid) in gmap.keys()}
        return {sid: _moygen_period(prog, gmap, sid, cfg) for sid in ids
                if _moygen_period(prog, gmap, sid, cfg) is not None}
    return {}


# --------------------------------------------------------------------------
# Stats par classe (miroir de statClassData).
# --------------------------------------------------------------------------
def _class_data(cls, idx, periods, cfg, year, enroll_statut, studs):
    graded = (idx == -1) or (0 <= idx < len(periods))
    moy_map = _moy_map(cls.id, periods, idx, cfg, year) if graded else {}
    f = m = ab = re = ec = 0
    lst = []
    for e in studs:
        statut = (enroll_statut.get(e.id) or "").strip().lower()
        abandon = (statut == "abandon")
        moy = moy_map.get(e.id)
        if (e.sexe or "") == "F":
            f += 1
        else:
            m += 1
        if abandon:
            ab += 1
            result = "abandon"
        elif not graded:
            result = "na"
        elif moy is not None and moy >= cfg["pass"]:
            re += 1
            result = "reussi"
        else:
            ec += 1
            result = "echoue"
        lst.append({
            "student_id": e.id, "name": e.full_name, "sexe": e.sexe or "",
            "moy": moy, "abandon": abandon, "result": result,
        })
    # tri : non-abandon d'abord, puis moyenne decroissante
    lst.sort(key=lambda r: (1 if r["abandon"] else 0,
                            -(r["moy"] if r["moy"] is not None else -1)))
    scope = "Annuel" if idx == -1 else (periods[idx] if 0 <= idx < len(periods)
                                        else "Periode %d" % (idx + 1))
    # Indicateurs academiques de la classe (moyenne de classe, min/max).
    acad = [it["moy"] for it in lst if not it["abandon"] and it["moy"] is not None]
    noted = len(acad)
    avg = _round(sum(acad) / noted, cfg["decimals"]) if noted else None
    return {
        "class_id": cls.id, "name": cls.name, "cycle": cls.cycle,
        "grp": cls.grp or "", "spec": cls.spec or "",
        "graded": graded, "total": len(studs), "f": f, "m": m,
        "abandon": ab, "reussi": re, "echoue": ec,
        "noted": noted, "avg": avg,
        "min": (min(acad) if noted else None), "max": (max(acad) if noted else None),
        "pass": cfg["pass"], "scope": scope, "list": lst,
    }


# --------------------------------------------------------------------------
# Synthese academique par classe (miroir de statClassSynthesis du front).
# --------------------------------------------------------------------------
def _class_synth(cls, idx, periods, cfg, year, statut, studs):
    graded = (idx == -1) or (0 <= idx < len(periods))
    moy_map = _moy_map(cls.id, periods, idx, cfg, year) if graded else {}
    total = len(studs)
    abandon = 0
    moys = []
    top = None
    mentions = {m["l"]: 0 for m in (cfg.get("mentions") or []) if m.get("l")}
    for e in studs:
        st = (statut.get(e.id) or "").strip().lower()
        if st == "abandon":
            abandon += 1
            continue
        moy = moy_map.get(e.id)
        if moy is None:
            continue
        moys.append(moy)
        lb = _mention_for(moy, cfg)
        if lb:
            mentions[lb] = mentions.get(lb, 0) + 1
        if top is None or moy > top["moy"]:
            top = {"name": e.full_name, "moy": moy}
    noted = len(moys)
    s = sum(moys)
    avg = _round(s / noted, cfg["decimals"]) if noted else None
    reussi = sum(1 for x in moys if x >= cfg["pass"])
    taux = _round_int(reussi / noted * 100) if noted else None
    scope = "Annuel" if idx == -1 else (periods[idx] if 0 <= idx < len(periods)
                                        else "Periode %d" % (idx + 1))
    return {
        "class_id": cls.id, "name": cls.name, "cycle": cls.cycle,
        "grp": cls.grp or "", "graded": graded, "total": total,
        "abandon": abandon, "noted": noted, "sum": s, "avg": avg,
        "min": (min(moys) if noted else None), "max": (max(moys) if noted else None),
        "reussi": reussi, "taux": taux, "mentions": mentions, "top": top,
        "rank": None, "scope": scope,
    }


def _active_class_ids():
    """Classes des cycles actifs (ou toutes si aucun cycle n'est declare).

    Un ENSEIGNANT est confine aux classes de son perimetre (teacher_scope_ids) ;
    admin / surveillant / superadmin gardent la vue complete de l'ecole.
    """
    sid = current_school_id()
    active = None
    if sid is not None:
        names = [c.name for c in db.session.query(Cycle)
                 .filter(Cycle.school_id == sid, Cycle.active.is_(True)).all()]
        if names:
            active = set(names)
    q = scoped_query(SchoolClass).order_by(SchoolClass.cycle, SchoolClass.name)
    rows = [c for c in q.all() if active is None or c.cycle in active]
    class_ids, _subject_ids = teacher_scope_ids()
    if class_ids is not None:
        rows = [c for c in rows if c.id in class_ids]
    return rows


def _enroll_statut(student_ids, year):
    """{student_id: statut} pour l'annee (inscription prioritaire)."""
    if not student_ids:
        return {}
    rows = (scoped_query(Enrollment)
            .filter(Enrollment.year == year,
                    Enrollment.student_id.in_(student_ids)).all())
    return {r.student_id: (r.statut or "") for r in rows}


def _roster_map(year, class_ids=None):
    """{class_id: [Student, ...]} pour l'annee demandee.

    Miroir fidele de studentsInClass/clsOfYear du prototype front : la classe
    d'un eleve pour une annee donnee est celle de son inscription (Enrollment)
    de cette annee ; a defaut d'inscription cette annee-la, on retombe sur sa
    classe de base (Student.class_id). C'est ce qui rend les stats reellement
    dependantes de l'annee selectionnee (l'effectif et la liste changent quand
    on change d'annee, pas seulement les moyennes).
    """
    enr = {r.student_id: r.class_id
           for r in scoped_query(Enrollment)
           .filter(Enrollment.year == year).all()}
    studs = (scoped_query(Student)
             .order_by(Student.nom, Student.prenom).all())
    want = set(class_ids) if class_ids is not None else None
    out = {}
    for s in studs:
        cid = enr[s.id] if s.id in enr else s.class_id
        if cid is None:
            continue
        if want is not None and cid not in want:
            continue
        out.setdefault(cid, []).append(s)
    return out


def _resolve_idx(periods):
    """Determine (idx, period_label) a partir des query params period/idx."""
    per = arg("period")
    if per:
        try:
            return periods.index(per), per
        except ValueError:
            return -2, per  # periode inconnue -> non notee
    idx = intval(arg("idx"), -1)
    return idx, None


# --------------------------------------------------------------------------
# Endpoints.
# --------------------------------------------------------------------------
@api_bp.get("/stats/global")
@role_required(*STAFF)
def stats_global():
    cfg = _cfg()
    year = arg("year") or _default_year()
    classes = _active_class_ids()
    class_ids = [c.id for c in classes]
    periods = _periods_for(class_ids or None, year)
    idx, _ = _resolve_idx(periods)

    roster = _roster_map(year, class_ids)
    stu_ids = [s.id for studs in roster.values() for s in studs]
    statut = _enroll_statut(stu_ids, year)

    total = f = m = ab = re = ec = graded_total = 0
    rows = []
    for c in classes:
        d = _class_data(c, idx, periods, cfg, year, statut, roster.get(c.id, []))
        total += d["total"]
        f += d["f"]
        m += d["m"]
        ab += d["abandon"]
        if d["graded"]:
            re += d["reussi"]
            ec += d["echoue"]
            graded_total += (d["total"] - d["abandon"])
        non_ab = d["total"] - d["abandon"]
        rows.append({
            "class_id": d["class_id"], "name": d["name"], "cycle": d["cycle"],
            "total": d["total"], "f": d["f"], "m": d["m"],
            "reussi": d["reussi"] if d["graded"] else None,
            "echoue": d["echoue"] if d["graded"] else None,
            "abandon": d["abandon"], "graded": d["graded"],
            "noted": d["noted"], "avg": d["avg"], "min": d["min"], "max": d["max"],
            "taux": (_round_int(d["reussi"] / non_ab * 100) if non_ab else 0)
            if d["graded"] else None,
            "scope": d["scope"],
        })
    rows.sort(key=lambda r: -r["total"])
    scope = "Annuel" if idx == -1 else (periods[idx] if 0 <= idx < len(periods)
                                        else "Periode %d" % (idx + 1))
    return jsonify(
        year=year, scope=scope, periods=periods,
        total=total, f=f, m=m, abandon=ab, reussi=re, echoue=ec,
        gradedTotal=graded_total, rows=rows,
    )


@api_bp.get("/stats/synthesis")
@role_required(*STAFF)
def stats_synthesis():
    """Synthese comparative des classes (miroir de statSchoolSynthesis)."""
    cfg = _cfg()
    year = arg("year") or _default_year()
    classes = _active_class_ids()
    class_ids = [c.id for c in classes]
    periods = _periods_for(class_ids or None, year)
    idx, _ = _resolve_idx(periods)

    roster = _roster_map(year, class_ids)
    stu_ids = [s.id for studs in roster.values() for s in studs]
    statut = _enroll_statut(stu_ids, year)

    rows = [_class_synth(c, idx, periods, cfg, year, statut, roster.get(c.id, []))
            for c in classes]
    # Classement des classes par moyenne de classe (gestion des ex aequo).
    ranked = sorted((r for r in rows if r["graded"] and r["noted"]),
                    key=lambda r: -r["avg"])
    last_avg = None
    last_rank = 0
    for i, r in enumerate(ranked):
        if cfg["rank_ties"] and last_avg is not None and r["avg"] == last_avg:
            r["rank"] = last_rank
        else:
            r["rank"] = i + 1
            last_rank = r["rank"]
        last_avg = r["avg"]

    noted_total = sum(r["noted"] for r in rows if r["graded"])
    reussi_total = sum(r["reussi"] for r in rows if r["graded"])
    sum_w = sum(r["sum"] for r in rows if r["graded"] and r["noted"])
    total_eff = sum(r["total"] for r in rows)
    abandon_total = sum(r["abandon"] for r in rows)
    school_avg = _round(sum_w / noted_total, cfg["decimals"]) if noted_total else None
    taux = _round_int(reussi_total / noted_total * 100) if noted_total else None
    best = ranked[0] if ranked else None
    weak = sorted(ranked, key=lambda r: r["avg"])[0] if ranked else None
    display = sorted(rows, key=lambda r: (
        0 if (r["graded"] and r["noted"]) else 1,
        -(r["avg"] if (r["graded"] and r["noted"]) else -1)))
    scope = "Annuel" if idx == -1 else (periods[idx] if 0 <= idx < len(periods)
                                        else "Periode %d" % (idx + 1))
    return jsonify(
        year=year, scope=scope, periods=periods, classes=len(rows),
        totalEff=total_eff, abandonTotal=abandon_total, notedTotal=noted_total,
        reussiTotal=reussi_total, schoolAvg=school_avg, taux=taux,
        best=({"class_id": best["class_id"], "name": best["name"], "avg": best["avg"]}
              if best else None),
        weak=({"class_id": weak["class_id"], "name": weak["name"], "avg": weak["avg"]}
              if weak else None),
        rows=[{k: v for k, v in r.items() if k != "sum"} for r in display],
    )


@api_bp.get("/stats/class/<int:class_id>")
@role_required(*STAFF)
def stats_class(class_id):
    cls = get_scoped_or_404(SchoolClass, class_id)
    # Enseignant : une classe hors perimetre est refusee en 404 (pas d'oracle
    # d'existence) ; admin / surveillant / superadmin ne sont pas restreints.
    class_ids, _subject_ids = teacher_scope_ids()
    if class_ids is not None and cls.id not in class_ids:
        abort(404)
    cfg = _cfg()
    year = arg("year") or _default_year()
    periods = _periods_for([cls.id], year)
    idx, _ = _resolve_idx(periods)
    studs = _roster_map(year, [cls.id]).get(cls.id, [])
    stu_ids = [s.id for s in studs]
    statut = _enroll_statut(stu_ids, year)
    d = _class_data(cls, idx, periods, cfg, year, statut, studs)
    d["year"] = year
    d["periods"] = periods
    return jsonify(**d)
