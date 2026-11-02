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
    app.cli.add_command(reset_db)
    app.cli.add_command(fix_schema)
    app.cli.add_command(remind_due)
    app.cli.add_command(purge_dead_tokens)


@click.command("remind-due")
@click.option("--days", default=1, show_default=True,
              help="Nombre de jours avant l'echeance (J-N). Defaut : J-1.")
@click.option("--dry-run", is_flag=True,
              help="Simuler : afficher qui serait relance, sans rien envoyer.")
@with_appcontext
def remind_due(days, dry_run):
    """Relance automatiquement les eleves non-rendus a J-N de l'echeance.

    A planifier UNE FOIS PAR JOUR (cron / Render Cron Job / Planificateur de
    taches Windows). Cible les exercices PUBLIES dont l'echeance tombe dans
    `days` jours (J-1 par defaut) et qui n'ont pas encore ete relances
    automatiquement. Idempotent : chaque exercice est marque (`j1_reminded`)
    une fois relance, donc relancer la commande le meme jour ne renvoie rien.

    Exemples :
      flask remind-due                # rappels a J-1
      flask remind-due --days 2       # rappels a J-2
      flask remind-due --dry-run      # apercu sans envoi
    """
    from datetime import date, timedelta

    from .api.exercises import _remind_core
    from .models.exercise import (Exercise, ExerciseSubmission,
                                  ST_ASSIGNED, ST_IN_PROGRESS)

    target = (date.today() + timedelta(days=max(0, days))).isoformat()
    exos = (db.session.query(Exercise)
            .filter(Exercise.statut == "published",
                    Exercise.echeance == target,
                    Exercise.j1_reminded.is_(False))
            .all())
    if not exos:
        click.echo(f"Aucun exercice publie a echeance {target} a relancer.")
        return

    total_exos, total_students = 0, 0
    for ex in exos:
        if dry_run:
            pend = (db.session.query(ExerciseSubmission)
                    .filter(ExerciseSubmission.exercise_id == ex.id,
                            ExerciseSubmission.statut.in_(
                                (ST_ASSIGNED, ST_IN_PROGRESS)))
                    .count())
            click.echo(f"[dry-run] \"{ex.title}\" (echeance {target}) "
                       f"-> {pend} eleve(s) a relancer")
            total_students += pend
            if pend:
                total_exos += 1
            continue
        n = _remind_core(ex)
        ex.j1_reminded = True
        if n:
            total_exos += 1
            total_students += n
        click.echo(f"\"{ex.title}\" (echeance {target}) -> {n} eleve(s) relance(s)")

    if not dry_run:
        db.session.commit()
    tag = "[dry-run] " if dry_run else ""
    click.echo(f"{tag}Termine : {total_students} eleve(s) relance(s) "
               f"sur {total_exos} exercice(s) a echeance {target}.")


@click.command("purge-dead-tokens")
@click.option("--days", default=0, show_default=True,
              help="Supprime aussi les jetons ACTIFS inutilises depuis N jours "
                   "(0 = desactive).")
@click.option("--dry-run", is_flag=True,
              help="Simuler : compter sans rien supprimer.")
@with_appcontext
def purge_dead_tokens(days, dry_run):
    """Purge les jetons push morts de la table device_tokens.

    - TOUJOURS : supprime les jetons desinscrits ou invalides (active = False),
      y compris ceux que FCM a signales invalides (desactives automatiquement
      par le centre de notifications lors d'un envoi).
    - OPTION --days N (> 0) : supprime EN PLUS les jetons encore actifs mais
      inutilises depuis plus de N jours (`last_used_at` anterieur a la limite).
      Les jetons actifs sans `last_used_at` ne sont jamais touches par --days.

    Idempotente et best-effort. A planifier de temps en temps (cron hebdo).

    Exemples :
      flask purge-dead-tokens                 # retire seulement les inactifs
      flask purge-dead-tokens --days 90       # + actifs inutilises depuis 90 j
      flask purge-dead-tokens --dry-run       # apercu sans suppression
    """
    from datetime import datetime, timedelta, timezone

    from .models.device import DeviceToken

    inactive_q = (db.session.query(DeviceToken)
                  .filter(DeviceToken.active.is_(False)))
    n_inactive = inactive_q.count()

    stale_q = None
    n_stale = 0
    if days and days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        stale_q = (db.session.query(DeviceToken)
                   .filter(DeviceToken.active.is_(True),
                           DeviceToken.last_used_at.isnot(None),
                           DeviceToken.last_used_at < cutoff))
        n_stale = stale_q.count()

    if dry_run:
        click.echo(f"[dry-run] {n_inactive} jeton(s) inactif(s) a supprimer.")
        if days and days > 0:
            click.echo(f"[dry-run] {n_stale} jeton(s) actif(s) inutilise(s) "
                       f"depuis plus de {days} j a supprimer.")
        click.echo(f"[dry-run] Total : {n_inactive + n_stale} jeton(s).")
        return

    deleted = inactive_q.delete(synchronize_session=False)
    if stale_q is not None:
        deleted += stale_q.delete(synchronize_session=False)
    db.session.commit()
    suffix = f", {n_stale} perime(s)" if days and days > 0 else ""
    click.echo(f"Termine : {deleted} jeton(s) push supprime(s) "
               f"({n_inactive} inactif(s){suffix}).")


@click.command("fix-schema")
@with_appcontext
def fix_schema():
    """Aligne le schema existant sur les modeles SANS perdre de donnees.

    `db.create_all()` ne fait que CREER les tables manquantes : il n'ALTERE
    jamais une colonne deja existante. Or les colonnes `photo` des eleves et
    des enseignants etaient en VARCHAR(255), trop courtes pour une photo
    encodee en base64 (data-URL) -> Postgres leve "value too long for type
    character varying(255)" et l'API renvoie une erreur 500 a l'enregistrement.

    Cette commande elargit ces colonnes en TEXT. Elle est idempotente :
    on peut la relancer sans risque.
    """
    stmts = [
        "ALTER TABLE students ALTER COLUMN photo TYPE TEXT",
        "ALTER TABLE teachers ALTER COLUMN photo TYPE TEXT",
        # Lien explicite compte -> fiche (ajoute si absent, idempotent).
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_id INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id INTEGER",
        # Enseignant titulaire (professeur principal) d'une classe, idempotent.
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS titulaire_id INTEGER",
        # Titulaires par annee scolaire (le titulaire peut changer chaque annee).
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS titulaires_by_year JSONB DEFAULT '{}'::jsonb",
        # Type de periode par cycle (trimestre/semestre), partage directeur<->profs.
        "ALTER TABLE school_configs ADD COLUMN IF NOT EXISTS periods JSONB DEFAULT '{}'::jsonb",
        # Verrou de saisie des notes par les enseignants (par cycle) + dates limites.
        "ALTER TABLE school_configs ADD COLUMN IF NOT EXISTS teacher_grades JSONB DEFAULT '{}'::jsonb",
        "ALTER TABLE school_configs ADD COLUMN IF NOT EXISTS deadlines JSONB DEFAULT '{}'::jsonb",
        # Format de bulletin surcharge par cycle (idempotent).
        "ALTER TABLE school_configs ADD COLUMN IF NOT EXISTS bulletin_fmt_by_cycle JSONB DEFAULT '{}'::jsonb",
        # Journal d'incidents anti-triche des quiz (idempotent).
        "ALTER TABLE exercise_submissions ADD COLUMN IF NOT EXISTS incidents JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE exercise_submissions ADD COLUMN IF NOT EXISTS incident_count INTEGER DEFAULT 0",
        # Marqueur de rappel automatique J-1 deja envoye (idempotent).
        "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS j1_reminded BOOLEAN DEFAULT FALSE",
        # Jetons d'appareils pour les notifications push (table + index, idempotent).
        "CREATE TABLE IF NOT EXISTS device_tokens ("
        "  id SERIAL PRIMARY KEY,"
        "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
        "  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,"
        "  token VARCHAR(512) NOT NULL UNIQUE,"
        "  platform VARCHAR(20) DEFAULT 'web',"
        "  active BOOLEAN NOT NULL DEFAULT TRUE,"
        "  last_used_at TIMESTAMPTZ,"
        "  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
        "  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        ")",
        "CREATE INDEX IF NOT EXISTS ix_device_tokens_user_id ON device_tokens (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_device_tokens_active ON device_tokens (active)",
    ]
    for sql in stmts:
        try:
            db.session.execute(db.text(sql))
            click.echo(f"OK : {sql}")
        except Exception as exc:  # table absente, etc. : on continue
            db.session.rollback()
            click.echo(f"Ignore ({exc.__class__.__name__}) : {sql}")
    db.session.commit()
    click.echo("Schema aligne : colonnes photo elargies en TEXT, liens compte->fiche prets.")


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


@click.command("reset-db")
@click.option("--yes", is_flag=True, help="Ne pas demander de confirmation.")
@with_appcontext
def reset_db(yes):
    """Supprime TOUTES les tables puis les recree depuis les modeles actuels.

    A utiliser quand le schema en base est perime (ex: colonne manquante apres
    une evolution des modeles). DESTRUCTIF : efface toutes les donnees.
    Reserve au local / a la demo, jamais en production.
    """
    from . import models  # noqa: F401  (enregistre tous les modeles sur db.metadata)

    if not yes:
        click.confirm(
            "Cela va EFFACER toutes les tables et donnees de la base. Continuer ?",
            abort=True,
        )
    # drop_all ne suffit pas si des tables orphelines (ancien schema) trainent :
    # on repart du schema 'public' au complet.
    db.session.execute(db.text("DROP SCHEMA public CASCADE"))
    db.session.execute(db.text("CREATE SCHEMA public"))
    db.session.commit()
    db.create_all()
    click.echo("Base reinitialisee : schema 'public' recree + tables a jour.")


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
    school.config = SchoolConfig(mentions=_DEFAULT_MENTIONS, bulletin_fmt_by_cycle={}, periods={},
                                 teacher_grades={}, deadlines={})
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
