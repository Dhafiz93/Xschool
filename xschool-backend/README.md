# XSchool Backend

API Flask + SQLAlchemy + Alembic (Flask-Migrate) + PostgreSQL pour l'EMS
multi-ecoles XSchool. Squelette de depart : auth JWT, isolation multi-tenant
par `school_id`, modeles derives du prototype front, commandes de seed.

## Stack

- Flask 3 (factory applicative)
- Flask-SQLAlchemy 3 / SQLAlchemy 2.x
- Flask-Migrate (Alembic) pour les migrations
- Flask-JWT-Extended (auth par token)
- psycopg3 + PostgreSQL
- passlib[bcrypt] pour le hachage des mots de passe

## Arborescence

```
xschool-backend/
  app/
    __init__.py        # factory create_app()
    extensions.py      # db, migrate, jwt, cors + Base declarative
    cli.py             # flask create-superadmin / flask init-demo
    auth/routes.py     # /auth/login, /auth/me, /auth/change-password
    api/               # /api/schools (superadmin), /api/classes (scope ecole)
    models/            # school, user, academics, people, grades, finance, audit
    utils/             # security (roles) + tenant (scoped_query)
  migrations/          # env Alembic (Flask-Migrate) ; versions/ vide au depart
  config.py            # config via variables d'env (.env)
  wsgi.py              # point d'entree (gunicorn wsgi:app)
  requirements.txt
  Procfile             # pour Render/Railway (web + release: flask db upgrade)
  .env.example
```

## Demarrage local

1. Virtualenv + dependances :
   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Base PostgreSQL locale (ou Neon/Supabase). Cree la base `xschool`.
3. Config :
   ```bash
   cp .env.example .env           # puis adapte DATABASE_URL et les cles
   ```
4. Variables Flask :
   ```bash
   export FLASK_APP=wsgi.py        # Windows PowerShell: $env:FLASK_APP="wsgi.py"
   ```
5. Migrations :
   ```bash
   flask db migrate -m "initial schema"
   flask db upgrade
   ```
6. Donnees de depart :
   ```bash
   flask init-demo
   flask create-superadmin --email you@xschool.test --password 'change-me-123'
   ```
   Jeu de donnees de demo COMPLET (eleves, notes, presences, paiements...) :
   ```bash
   flask seed                # peuple l'ecole 'demo' (idempotent, deterministe)
   flask seed --reset        # regenere en vidant d'abord les tables metier
   flask seed --slug lycee1  # cible une autre ecole par son slug
   ```
   Comptes crees par `flask seed` :
   super@xschool.test / super1234 (superadmin) - admin@horizon.test / passer1234
   - surveillant@horizon.test / passer1234
7. Lancer :
   ```bash
   python wsgi.py                 # http://127.0.0.1:5000
   # ou: gunicorn wsgi:app
   ```

## Tester l'API

```bash
curl -s localhost:5000/health

# login (admin de demo)
curl -s -X POST localhost:5000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.test","password":"admin1234"}'

# avec le token recu :
curl -s localhost:5000/api/classes -H "Authorization: Bearer <TOKEN>"
```

## Endpoints API

Tout `/api/*` exige un JWT (`Authorization: Bearer <token>`). Chaque ressource
metier est **scopee par ecole** (`school_id`) via `scoped_query` : un utilisateur
ne voit/ecrit que les donnees de son ecole ; le superadmin (school_id nul) voit
tout. Roles : `admin`, `teacher`, `supervisor`, `student` (+ `superadmin`).

| Methode + chemin | Role requis | Role |
|---|---|---|
| `GET /api/schools` | superadmin | liste des ecoles |
| `GET/POST /api/classes`, `DELETE /api/classes/<id>` | admin | classes |
| `GET /api/students` (`?class_id&q`), `GET /api/students/<id>` | admin/teacher/supervisor | eleves |
| `POST /api/students`, `PUT/DELETE /api/students/<id>` | admin | eleves |
| `POST /api/students/<id>/enrollments` | admin | inscription par annee (upsert) |
| `GET /api/teachers`, `GET /api/teachers/<id>` | admin/teacher/supervisor | enseignants |
| `POST /api/teachers`, `PUT/DELETE /api/teachers/<id>` | admin | enseignants |
| `GET /api/subjects` | admin/teacher/supervisor | matieres |
| `POST /api/subjects`, `PUT/DELETE /api/subjects/<id>` | admin | matieres |
| `GET /api/programs` (`?class_id`) | admin/teacher/supervisor | programme |
| `POST /api/programs` (upsert), `PUT/DELETE /api/programs/<id>` | admin | programme |
| `GET /api/grades` (`?class_id&subject_id&student_id&period&year`) | admin/teacher/supervisor | notes |
| `POST /api/grades` (upsert, ou `{items:[...]}`), `DELETE /api/grades/<id>` | admin/teacher | notes |
| `GET /api/attendance` (`?class_id&student_id&date`) | admin/teacher/supervisor | appel |
| `POST /api/attendance` (upsert, ou `{items:[...]}`), `DELETE /api/attendance/<id>` | admin/teacher/supervisor | appel |
| `GET /api/discipline` (`?student_id`) | admin/teacher/supervisor | discipline |
| `POST /api/discipline`, `DELETE /api/discipline/<id>` | admin/supervisor | discipline |
| `GET /api/payments` (`?student_id&year`) | admin/teacher/supervisor | paiements |
| `POST /api/payments`, `DELETE /api/payments/<id>` | admin | paiements |
| `GET /api/logs` (`?limit`) | admin (son ecole) / superadmin (tout) | journal d'audit |

Notes :
- Les POST `grades`/`attendance`/`programs` et `students/<id>/enrollments` font
  de l'**upsert** sur la cle metier (pas de doublon).
- Les ids renvoyes sont des **entiers**. Le front prefixe ses ids (ex. `c12`) ;
  le pont `data.js` gere la correspondance.
- Certaines mutations (creation/suppression d'eleve, enseignant, paiement,
  discipline) ecrivent une ligne dans `/api/logs`.
- Le superadmin qui cree une ressource doit fournir `school_id` dans le corps
  (il n'est rattache a aucune ecole) ; un admin n'a rien a preciser.

## Demarrage rapide SANS migrations (local/Docker)

Les migrations Alembic sont la voie canonique, mais pour tester vite tu peux
creer tout le schema d'un coup (sans Alembic) :

```bash
flask create-tables     # db.create_all() : cree les tables manquantes
flask seed              # jeu de donnees de demo complet (idempotent)
```

En production, prefere les migrations (`flask db migrate` / `flask db upgrade`).

## Docker (pile locale complete)

`Dockerfile` + `docker-compose.yml` lancent PostgreSQL + l'API en une commande.
L'entrypoint attend la base, applique les migrations si elles existent sinon
`flask create-tables`, et peut semer la demo (`SEED_DEMO=1`).

```bash
# API seule + base Postgres (http://localhost:8000)
docker compose up --build

# + donnees de demo au 1er demarrage
SEED_DEMO=1 docker compose up --build

# + front statique servi par nginx (http://localhost:8080)
docker compose --profile front up --build
```

Le front suppose `../xschool-frontend` a cote de ce dossier (monorepo).

## Multi-tenant (a respecter absolument)

Toute entite rattachee a une ecole porte `school_id`. Les routes metier
requetent via `scoped_query(Model)` (voir `app/utils/tenant.py`) qui filtre
automatiquement sur l'ecole de l'utilisateur. Le superadmin (`school_id` nul)
n'est pas filtre. Ne jamais requeter une entite d'ecole sans ce filtre.

Roles : `superadmin`, `admin`, `teacher`, `supervisor`, `student`
(`app/utils/security.py` : `@role_required(...)`, `@superadmin_required`).

## Deploiement gratuit (Render — render.yaml)

Un `render.yaml` (Blueprint) a la racine du repo deploie **3 ressources** d'un
coup : base PostgreSQL, API Flask, front statique.

1. Pousse le repo sur GitHub (le `.env` est ignore par `.gitignore`).
2. Render -> New -> Blueprint -> choisis ton repo. Render lit `render.yaml`.
3. `SECRET_KEY` / `JWT_SECRET_KEY` sont generes automatiquement ; `DATABASE_URL`
   est injecte depuis la base managee. Le schema est cree par `preDeployCommand`
   (migrations si presentes, sinon `flask create-tables`).
4. Apres le 1er deploy, (optionnel) ouvre un Shell Render et lance
   `flask seed` pour peupler la demo, puis `flask create-superadmin ...`.
5. Mets `CORS_ORIGINS` (service API) a l'URL exacte du front statique.

`config.py` normalise l'URL de base : `postgres://` / `postgresql://` fournis par
l'hebergeur sont reecrits en `postgresql+psycopg://` (driver psycopg3).

Rappels plan gratuit : l'API s'endort apres inactivite (reveil ~30s) ; la base
gratuite a une duree de vie limitee ; n'utilise que des donnees factices.

## Prochaines etapes suggerees

- Porter la logique de calcul des bulletins du prototype (moyennes, mentions,
  rang, `opt_fac_coef1`, formats `vrac`/`groupe`/`specialite`,
  `bulletin_fmt_by_cycle`) dans un service `app/services/bulletin.py`.
- Ajouter les ressources CRUD : subjects, program, students, enrollments,
  grades, payments, attendance, discipline.
- Schemas marshmallow pour la validation des entrees.
- Tables de liaison teacher<->subject / teacher<->class (remplacer les JSONB).
- Tests (pytest) + CI GitHub Actions.
