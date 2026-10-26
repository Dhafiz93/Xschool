"""Commandes Flask CLI : creation du superadmin, jeu de donnees de demo."""
import click
from flask.cli import with_appcontext

from .extensions import db
from .models.academics import Cycle, Program, SchoolClass, Subject
from .models.school import School, SchoolConfig
from .models.user import ROLE_ADMIN, ROLE_SUPERADMIN, User

_DEFAULT_MENTIONS = [
    {"l": "Excellent", "min": 18}, {"l": "Tres Bien", "min": 16},
    {"l": "Bien", "min": 14}, {"l": "Assez Bien", "min": 12},
    {"l": "Passable", "min": 10},
]


def register_cli(app):
    app.cli.add_command(create_superadmin)
    app.cli.add_command(init_demo)
    app.cli.add_command(create_tables)


@click.command("create-tables")
@with_appcontext
def create_tables():
    """Cree toutes les tables directement (db.create_all), SANS Alembic.

    Pratique pour un demarrage rapide en local / Docker quand aucune migration
    n'a encore ete generee. En PRODUCTION, prefere les migrations
    (flask db migrate / flask db upgrade) pour garder un historique de schema.
    """
    from . import models  # noqa: F401  (enregistre tous les modeles sur db.metadata)

    db.create_all()
    click.echo("Tables creees (db.create_all).")


@click.command("create-superadmin")
@click.option("--email", required=True)
@click.option("--password", required=True)
@with_appcontext
def create_superadmin(email, password):
    """Cree (ou met a jour) un compte superadmin global."""
    email = email.strip().lower()
    user = db.session.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, role=ROLE_SUPERADMIN, full_name="Super Admin")
        db.session.add(user)
    user.role = ROLE_SUPERADMIN
    user.school_id = None
    user.set_password(password)
    db.session.commit()
    click.echo(f"Superadmin pret : {email}")


@click.command("init-demo")
@with_appcontext
def init_demo():
    """Cree une ecole de demo avec admin, cycles, classes et programme."""
    if db.session.query(School).filter(School.slug == "demo").first():
        click.echo("L'ecole demo existe deja. Rien a faire.")
        return

    school = School(name="College & Lycee Demo", slug="demo")
    school.config = SchoolConfig(mentions=_DEFAULT_MENTIONS, bulletin_fmt_by_cycle={})
    db.session.add(school)
    db.session.flush()

    admin = User(
        email="admin@demo.test", role=ROLE_ADMIN,
        full_name="Admin Demo", school_id=school.id,
    )
    admin.set_password("admin1234")
    db.session.add(admin)

    for name in ("College", "Lycee Moderne", "Cycle Industriel"):
        db.session.add(Cycle(school_id=school.id, name=name))

    subs = {
        "Mathematiques": "sci", "Francais": "litt", "Physique-Chimie": "sci",
        "Histoire-Geo": "litt", "Anglais": "litt", "EPS": "autre",
    }
    sub_objs = {}
    for n, dom in subs.items():
        s = Subject(school_id=school.id, name=n, dom=dom)
        db.session.add(s)
        sub_objs[n] = s

    cls = SchoolClass(school_id=school.id, cycle="Lycee Moderne", name="Tle D")
    db.session.add(cls)
    db.session.flush()

    prog = [
        ("Mathematiques", 5, True, True),
        ("Physique-Chimie", 4, True, True),
        ("Francais", 3, True, False),
        ("Anglais", 2, True, False),
        ("EPS", 1, False, False),  # facultative
    ]
    for name, coef, oblig, spec in prog:
        db.session.add(Program(
            school_id=school.id, class_id=cls.id, subject_id=sub_objs[name].id,
            coef=coef, oblig=oblig, spec=spec,
        ))

    db.session.commit()
    click.echo("Ecole demo creee.")
    click.echo("  Admin : admin@demo.test / admin1234")
    click.echo("  (Cree un superadmin avec: flask create-superadmin ...)")
