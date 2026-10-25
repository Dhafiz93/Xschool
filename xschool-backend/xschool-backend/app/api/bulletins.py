"""Agregation annuelle des bulletins (par classe) pour l'edition officielle.

Approche mixte demandee :
  - cycles SEMESTRIELS -> bulletin de fin d'annee (2e semestre) qui porte, par
    matiere, la moyenne de chaque semestre, la moyenne annuelle et les rangs
    (modele 2).
  - cycles TRIMESTRIELS -> bulletin de fin d'annee (3e trimestre) qui porte la
    synthese des 3 trimestres (moyenne generale + rang de chaque periode) et la
    moyenne annuelle + rang (modele 3).

Ce module reutilise la logique de calcul deja validee dans stats.py (moyenne
ponderee/simple, option facultatives, arrondi) pour garantir que le serveur et
le client produisent exactement les memes valeurs. Il ajoute le classement
(par periode et annuel, au niveau eleve ET au niveau matiere) et les mini-stats
de classe (moyenne / plus forte / plus faible).

Endpoint :
    GET /api/bulletins/class/<class_id>?year=YYYY-YYYY
        -> periodes, matieres, et pour chaque eleve : moyennes/rangs par
           periode + annuel (niveau eleve et niveau matiere), + stats classe.
"""
from flask import jsonify

from ..extensions import db
from ..models.academics import Subject
from ..models.grades import Grade
from ..models.people import Student
from ..models.school import SchoolConfig
from ..utils.security import role_required
from ..utils.tenant import current_school_id, get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg
from .stats import (
    _cfg,
    _default_year,
    _grade_map,
    _moygen_period,
    _periods_for,
    _program,
    _round,
)
from ..models.academics import SchoolClass


def _rank_ties():
    """Option "ex-aequo au meme rang" (defaut : actif, comme le prototype)."""
    sid = current_school_id()
    if sid is None:
        return True
    cfg = db.session.query(SchoolConfig).filter(SchoolConfig.school_id == sid).first()
    return True if cfg is None or cfg.rank_ties is None else bool(cfg.rank_ties)


def _ranks(moy_map, ties=True):
    """{sid: rang} a partir d'un {sid: moyenne} (classement competition).

    Reproduit fidelement la boucle de classBulletinData (views.js) : moyennes
    decroissantes ; en cas d'egalite (si ties), meme rang que le precedent.
    Les eleves sans moyenne (None) sont ignores.
    """
    items = sorted(
        ((sid, m) for sid, m in moy_map.items() if m is not None),
        key=lambda kv: -kv[1],
    )
    ranks = {}
    last_moy = None
    last_rank = 0
    for i, (sid, moy) in enumerate(items):
        if ties and last_moy is not None and moy == last_moy:
            ranks[sid] = last_rank
        else:
            ranks[sid] = i + 1
            last_rank = i + 1
        last_moy = moy
    return ranks


def _subject_rows(class_id):
    """[(subject_id, name, dom, coef, oblig)] pour la classe, ordre programme."""
    from ..models.academics import Program
    rows = (scoped_query(Program)
            .join(Subject, Subject.id == Program.subject_id)
            .filter(Program.class_id == class_id)
            .order_by(Program.id).all())
    out = []
    for p in rows:
        sub = db.session.get(Subject, p.subject_id)
        out.append((p.subject_id,
                    sub.name if sub else "",
                    (sub.dom if sub else "autre") or "autre",
                    float(p.coef or 0),
                    bool(p.oblig)))
    return out


def _stats(moy_map, decimals):
    """(moyenne, mini, maxi) sur les moyennes non nulles, arrondies."""
    vals = [m for m in moy_map.values() if m is not None]
    if not vals:
        return {"avg": None, "min": None, "max": None}
    return {
        "avg": _round(sum(vals) / len(vals), decimals),
        "min": _round(min(vals), decimals),
        "max": _round(max(vals), decimals),
    }


@api_bp.get("/bulletins/class/<int:class_id>")
@role_required(*STAFF)
def bulletin_year(class_id):
    cls = get_scoped_or_404(SchoolClass, class_id)
    cfg = _cfg()
    dec = cfg["decimals"]
    ties = _rank_ties()
    year = arg("year") or _default_year()
    periods = _periods_for([cls.id], year)
    prog = _program(cls.id)
    subject_rows = _subject_rows(cls.id)

    studs = (scoped_query(Student)
             .filter(Student.class_id == cls.id)
             .order_by(Student.nom, Student.prenom).all())
    sids = [e.id for e in studs]

    # ---- Niveau ELEVE : moyenne generale par periode + rang ----
    period_moy = []   # [ {sid: moyGen} ] par periode
    period_rank = []  # [ {sid: rang} ]   par periode
    period_stats = []
    annual_acc, annual_cnt = {}, {}
    for per in periods:
        gmap = _grade_map(cls.id, per, year)
        mm = {}
        for sid in sids:
            mg = _moygen_period(prog, gmap, sid, cfg)
            if mg is not None:
                mm[sid] = mg
                annual_acc[sid] = annual_acc.get(sid, 0.0) + mg
                annual_cnt[sid] = annual_cnt.get(sid, 0) + 1
        period_moy.append(mm)
        period_rank.append(_ranks(mm, ties))
        period_stats.append(_stats(mm, dec))
    annual_moy = {sid: _round(annual_acc[sid] / annual_cnt[sid], dec) for sid in annual_acc}
    annual_rank = _ranks(annual_moy, ties)
    annual_stats = _stats(annual_moy, dec)

    # ---- Niveau MATIERE : moyenne par periode/annuel + rang (modele 2) ----
    subj_period_moy = {}   # subject_id -> [ {sid: moy} ] par periode
    subj_period_rank = {}  # subject_id -> [ {sid: rang} ]
    subj_annual_moy = {}   # subject_id -> {sid: moy}
    subj_annual_rank = {}
    for subject_id, _n, _d, _c, _o in subject_rows:
        pm, pr = [], []
        acc, cnt = {}, {}
        for per in periods:
            gmap = _grade_map(cls.id, per, year)
            mm = {}
            for sid in sids:
                v = gmap.get((subject_id, sid))
                if v is not None:
                    v = _round(v, dec)
                    mm[sid] = v
                    acc[sid] = acc.get(sid, 0.0) + v
                    cnt[sid] = cnt.get(sid, 0) + 1
            pm.append(mm)
            pr.append(_ranks(mm, ties))
        am = {sid: _round(acc[sid] / cnt[sid], dec) for sid in acc}
        subj_period_moy[subject_id] = pm
        subj_period_rank[subject_id] = pr
        subj_annual_moy[subject_id] = am
        subj_annual_rank[subject_id] = _ranks(am, ties)

    # ---- Serialisation par eleve ----
    out_students = []
    for e in studs:
        per_list = [{
            "moy": period_moy[i].get(e.id),
            "rank": period_rank[i].get(e.id),
        } for i in range(len(periods))]
        subj_list = []
        for subject_id, name, dom, coef, oblig in subject_rows:
            subj_list.append({
                "subject_id": subject_id, "name": name, "dom": dom,
                "coef": coef, "oblig": oblig,
                "per": [{
                    "moy": subj_period_moy[subject_id][i].get(e.id),
                    "rank": subj_period_rank[subject_id][i].get(e.id),
                } for i in range(len(periods))],
                "annual": subj_annual_moy[subject_id].get(e.id),
                "annualRank": subj_annual_rank[subject_id].get(e.id),
            })
        out_students.append({
            "student_id": e.id, "name": e.full_name, "sexe": e.sexe or "",
            "per": per_list,
            "annual": {"moy": annual_moy.get(e.id), "rank": annual_rank.get(e.id)},
            "subjects": subj_list,
        })

    return jsonify(
        year=year,
        class_id=cls.id, name=cls.name, cycle=cls.cycle,
        grp=cls.grp or "", spec=cls.spec or "",
        periods=periods,
        pass_mark=cfg["pass"],
        subjects=[{"subject_id": s[0], "name": s[1], "dom": s[2],
                   "coef": s[3], "oblig": s[4]} for s in subject_rows],
        students=out_students,
        periodStats=period_stats,
        annualStats=annual_stats,
    )
