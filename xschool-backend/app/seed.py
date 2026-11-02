"""Script de peuplement (seed) complet pour XSchool.

Cree un jeu de donnees realiste et coherent pour TOUTES les tables de base :
ecole + config, utilisateurs (superadmin/admin/enseignant/surveillant), cycles,
matieres, classes, programme, enseignants, eleves, inscriptions, notes,
presences, discipline, paiements et un log d'audit.

Usage :
    flask seed                 # peuple l'ecole 'demo' (idempotent)
    flask seed --reset         # vide d'abord les tables metier de l'ecole demo
    flask seed --slug lycee1   # cible une autre ecole (slug)

Deterministe (random fixe) : rejouable a l'identique.
"""
import random
from datetime import date, timedelta

import click
from flask.cli import with_appcontext

from .extensions import db
from .models.academics import Cycle, Program, SchoolClass, Subject
from .models.audit import AuditLog
from .models.finance import Payment
from .models.grades import Attendance, Discipline, Grade
from .models.people import Enrollment, Student, Teacher
from .models.school import School, SchoolConfig
from .models.user import ROLE_ADMIN, ROLE_SUPERADMIN, ROLE_SUPERVISOR, ROLE_TEACHER, User

YEAR = "2025-2026"
PERIODS = ["Trimestre 1", "Trimestre 2", "Trimestre 3"]

_MENTIONS = [
    {"l": "Excellent", "min": 18}, {"l": "Tres Bien", "min": 16},
    {"l": "Bien", "min": 14}, {"l": "Assez Bien", "min": 12},
    {"l": "Passable", "min": 10},
]

# Matiere -> domaine
_SUBJECTS = {
    "Mathematiques": "sci", "Physique-Chimie": "sci", "SVT": "sci",
    "Francais": "litt", "Anglais": "litt", "Histoire-Geo": "litt",
    "Philosophie": "litt", "EPS": "autre",
}

# Classe -> (cycle, liste de (matiere, coef, oblig, spec))
_CLASSES = {
    "3eme A": ("College", [
        ("Mathematiques", 4, True, False), ("Francais", 4, True, False),
        ("Anglais", 2, True, False), ("Physique-Chimie", 3, True, False),
        ("SVT", 3, True, False), ("Histoire-Geo", 2, True, False),
        ("EPS", 1, False, False),
    ]),
    "Tle D": ("Lycee Moderne", [
        ("Mathematiques", 5, True, True), ("Physique-Chimie", 5, True, True),
        ("SVT", 4, True, True), ("Francais", 2, True, False),
        ("Anglais", 2, True, False), ("Philosophie", 2, True, False),
        ("EPS", 1, False, False),
    ]),
    "Tle A": ("Lycee Moderne", [
        ("Philosophie", 5, True, True), ("Francais", 4, True, True),
        ("Histoire-Geo", 4, True, True), ("Anglais", 3, True, False),
        ("Mathematiques", 2, True, False), ("EPS", 1, False, False),
    ]),
}

_NOMS = ["Kodjo", "Mensah", "Adjo", "Ouattara", "Traore", "Diallo", "Nkrumah",
         "Boateng", "Agbeko", "Lawson", "Dossou", "Amegan", "Kouassi", "Johnson"]
_PRENOMS_M = ["Kossi", "Yao", "Komi", "Edem", "Elom", "Mawuli", "Sena", "Kofi"]
_PRENOMS_F = ["Afi", "Ama", "Akosua", "Adjoa", "Esinam", "Dela", "Sitsofe", "Yawa"]
_VILLES = ["Lome", "Kpalime", "Sokode", "Atakpame", "Kara", "Aneho"]


def register_seed_cli(app):
    app.cli.add_command(seed)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _rand_phone(rng):
    return "+228 9" + "".join(rng.choice("0123456789") for _ in range(7))


def _rand_dob(rng, y0, y1):
    d = date(rng.randint(y0, y1), rng.randint(1, 12), rng.randint(1, 28))
    return d.isoformat()


def _grade_detail(rng, n=3):
    """Genere n notes brutes /20 (interro, devoir, compo) + calcule la moyenne."""
    kinds = ["interro", "devoir", "composition"]
    detail = []
    for i in range(n):
        note = round(rng.uniform(6.0, 19.0), 2)
        detail.append({"type": kinds[i % len(kinds)], "note": note, "bareme": 20})
    moy = round(sum(d["note"] for d in detail) / len(detail), 3)
    return detail, moy


def _clear_business(school_id):
    """Vide les tables metier d'une ecole (ordre FK) sans toucher structure/config."""
    for model in (AuditLog, Payment, Discipline, Attendance, Grade,
                  Enrollment, Student, Teacher, Program, SchoolClass,
                  Subject, Cycle):
        q = db.session.query(model)
        if hasattr(model, "school_id"):
            q = q.filter(model.school_id == school_id)
        q.delete(synchronize_session=False)
    # utilisateurs non-superadmin de l'ecole
    db.session.query(User).filter(
        User.school_id == school_id, User.role != ROLE_SUPERADMIN
    ).delete(synchronize_session=False)
    db.session.commit()


# --------------------------------------------------------------------------
# Commande : flask seed
# --------------------------------------------------------------------------
@click.command("seed")
@click.option("--slug", default="demo", help="Slug de l'ecole a peupler.")
@click.option("--reset", is_flag=True, help="Vide d'abord les tables metier de l'ecole.")
@click.option("--superadmin-email", default="super@xschool.test")
@click.option("--superadmin-password", default="super1234")
@with_appcontext
def seed(slug, reset, superadmin_email, superadmin_password):
    """Peuple la base avec un jeu de donnees de demonstration complet."""
    rng = random.Random(42)

    # 1) superadmin global (school_id NULL) ----------------------------------
    sa = db.session.query(User).filter(User.email == superadmin_email.lower()).first()
    if sa is None:
        sa = User(email=superadmin_email.lower(), role=ROLE_SUPERADMIN,
                  full_name="Super Admin", school_id=None)
        sa.set_password(superadmin_password)
        db.session.add(sa)
        db.session.flush()

    # 2) ecole + config ------------------------------------------------------
    school = db.session.query(School).filter(School.slug == slug).first()
    if school is None:
        school = School(name="College & Lycee Horizon", slug=slug)
        school.config = SchoolConfig(
            mentions=_MENTIONS, bulletin_fmt_by_cycle={}, periods={},
            grade_max=20, pass_mark=10, avg_mode="weighted", avg_decimals=2,
            phone="+228 22 00 00 00", email="contact@horizon.test",
            address="Boulevard du 13 janvier, Lome", director="M. Komlan A.",
        )
        db.session.add(school)
        db.session.flush()
        click.echo(f"Ecole creee : {school.name} (slug={slug})")
    else:
        click.echo(f"Ecole existante : {school.name} (slug={slug})")
        if reset:
            _clear_business(school.id)
            click.echo("  Tables metier videes (--reset).")
        elif db.session.query(Student).filter(Student.school_id == school.id).count():
            click.echo("  Deja peuplee. Utilise --reset pour regenerer. Abandon.")
            db.session.commit()
            return
    sid = school.id

    # 3) admin + surveillant -------------------------------------------------
    def _ensure_user(email, role, name, login=None):
        u = db.session.query(User).filter(User.email == email).first()
        if u is None:
            u = User(email=email, role=role, full_name=name, school_id=sid, login=login)
            u.set_password("passer1234")
            db.session.add(u)
        return u

    admin = _ensure_user("admin@horizon.test", ROLE_ADMIN, "Admin Horizon", login="admin.horizon")
    _ensure_user("surveillant@horizon.test", ROLE_SUPERVISOR, "Surveillant General",
                 login="surveillant.horizon")
    db.session.flush()

    # 4) cycles --------------------------------------------------------------
    for name in sorted({c for c, _ in _CLASSES.values()}):
        if not db.session.query(Cycle).filter_by(school_id=sid, name=name).first():
            db.session.add(Cycle(school_id=sid, name=name))

    # 5) matieres ------------------------------------------------------------
    subj_objs = {}
    for name, dom in _SUBJECTS.items():
        s = Subject(school_id=sid, name=name, dom=dom)
        db.session.add(s)
        subj_objs[name] = s
    db.session.flush()

    # 6) classes + programme -------------------------------------------------
    class_objs = {}
    for cname, (cycle, prog) in _CLASSES.items():
        cls = SchoolClass(school_id=sid, cycle=cycle, name=cname)
        db.session.add(cls)
        db.session.flush()
        class_objs[cname] = cls
        for subj_name, coef, oblig, spec in prog:
            db.session.add(Program(
                school_id=sid, class_id=cls.id,
                subject_id=subj_objs[subj_name].id,
                coef=coef, oblig=oblig, spec=spec,
            ))

    # 7) enseignants ---------------------------------------------------------
    teacher_specs = [
        ("Mathematiques", ["Mathematiques"]),
        ("Sciences", ["Physique-Chimie", "SVT"]),
        ("Lettres", ["Francais", "Philosophie"]),
        ("Langues", ["Anglais"]),
        ("Sciences humaines", ["Histoire-Geo"]),
        ("Sport", ["EPS"]),
    ]
    for spec, subs in teacher_specs:
        sexe_pren = rng.choice(_PRENOMS_M + _PRENOMS_F)
        db.session.add(Teacher(
            school_id=sid, nom=rng.choice(_NOMS), prenom=sexe_pren,
            dob=_rand_dob(rng, 1975, 1992), dip="Maitrise / CAPES", spec=spec,
            tel=_rand_phone(rng),
            urg_nom=rng.choice(_NOMS), urg_tel=_rand_phone(rng),
            subs=[subj_objs[n].id for n in subs if n in subj_objs],
            classes=[c.id for c in class_objs.values()],
        ))

    # 8) eleves + inscriptions ----------------------------------------------
    students_by_class = {}
    seq = 1
    for cname, cls in class_objs.items():
        n_students = rng.randint(6, 9)
        lst = []
        for _ in range(n_students):
            sexe = rng.choice(["M", "F"])
            prenom = rng.choice(_PRENOMS_M if sexe == "M" else _PRENOMS_F)
            st = Student(
                school_id=sid,
                matricule=f"{YEAR[:4]}-{seq:04d}",
                nom=rng.choice(_NOMS), prenom=prenom, sexe=sexe,
                dob=_rand_dob(rng, 2007, 2011),
                lieu=rng.choice(_VILLES),
                pere=f"M. {rng.choice(_NOMS)}", contact_pere=_rand_phone(rng),
                mere=f"Mme {rng.choice(_NOMS)}", contact_mere=_rand_phone(rng),
                class_id=cls.id,
            )
            db.session.add(st)
            db.session.flush()
            db.session.add(Enrollment(
                school_id=sid, student_id=st.id, class_id=cls.id,
                year=YEAR, statut="inscrit",
                regime=rng.choice(["interne", "externe", "demi-pensionnaire"]),
            ))
            lst.append(st)
            seq += 1
        students_by_class[cname] = lst

    # 9) notes (une ligne par eleve x matiere obligatoire x periode) ---------
    for cname, (cycle, prog) in _CLASSES.items():
        cls = class_objs[cname]
        subjects = [subj_objs[s] for s, _, oblig, _ in prog if oblig]
        for st in students_by_class[cname]:
            for period in PERIODS:
                for subj in subjects:
                    detail, moy = _grade_detail(rng)
                    db.session.add(Grade(
                        school_id=sid, class_id=cls.id, subject_id=subj.id,
                        student_id=st.id, year=YEAR, period=period,
                        detail=detail, moy=moy,
                    ))

    # 10) presences (quelques jours) + discipline ---------------------------
    base_day = date(2025, 10, 6)  # une semaine de cours
    for cname, cls in class_objs.items():
        for st in students_by_class[cname]:
            for d in range(5):
                day = (base_day + timedelta(days=d)).isoformat()
                status = rng.choices(
                    ["present", "retard", "absent"], weights=[85, 8, 7]
                )[0]
                db.session.add(Attendance(
                    school_id=sid, student_id=st.id, class_id=cls.id,
                    date=day, status=status,
                ))
            if rng.random() < 0.2:
                db.session.add(Discipline(
                    school_id=sid, student_id=st.id,
                    date=(base_day + timedelta(days=rng.randint(0, 4))).isoformat(),
                    motif=rng.choice(["Bavardage", "Retard repete", "Devoir non rendu"]),
                    gravite=rng.choice(["legere", "moyenne"]),
                ))

    # 11) paiements ----------------------------------------------------------
    for cname, lst in students_by_class.items():
        for st in lst:
            n_pay = rng.randint(1, 3)
            for i in range(n_pay):
                mode = rng.choice(["especes", "mobile", "banque"])
                db.session.add(Payment(
                    school_id=sid, student_id=st.id, year=YEAR,
                    amount=rng.choice([25000, 50000, 75000]),
                    mode=mode,
                    ref=(f"BRD-{rng.randint(1000, 9999)}" if mode == "banque" else ""),
                    label=f"Tranche {i + 1}",
                    date=(base_day + timedelta(days=rng.randint(0, 30))).isoformat(),
                ))

    # 12) log d'audit --------------------------------------------------------
    db.session.add(AuditLog(
        school_id=sid, user_id=admin.id, action="seed",
        target="database", detail=f"Peuplement demo pour {school.name}",
        ip="127.0.0.1",
    ))

    db.session.commit()

    # Recap ------------------------------------------------------------------
    n_students = db.session.query(Student).filter_by(school_id=sid).count()
    n_grades = db.session.query(Grade).filter_by(school_id=sid).count()
    click.echo("Peuplement termine :")
    click.echo(f"  Ecole      : {school.name} (slug={slug})")
    click.echo(f"  Classes    : {len(class_objs)}  | Matieres : {len(subj_objs)}")
    click.echo(f"  Eleves     : {n_students} | Notes : {n_grades}")
    click.echo("  Comptes    :")
    click.echo(f"    superadmin -> {superadmin_email} / {superadmin_password}")
    click.echo("    admin      -> admin@horizon.test (ou login: admin.horizon) / passer1234")
    click.echo("    surveillant-> surveillant@horizon.test / passer1234")


