-- =============================================================================
-- XSchool - Script de creation des tables (PostgreSQL)
-- -----------------------------------------------------------------------------
-- Chemin canonique = migrations Flask-Migrate (flask db upgrade).
-- Ce fichier est fourni en reference / bootstrap rapide d'une base vierge.
-- Compatible PostgreSQL 13+. A executer sur une base vide :
--   psql "$DATABASE_URL" -f docs/schema.sql
-- =============================================================================

BEGIN;

-- Fonction trigger : maintient updated_at a jour (equiv. onupdate SQLAlchemy).
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- schools + school_configs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        varchar(160) NOT NULL,
  slug        varchar(80)  NOT NULL UNIQUE,
  active      boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_configs (
  id                     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id              integer NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  phone                  varchar(40)  NOT NULL DEFAULT '',
  email                  varchar(160) NOT NULL DEFAULT '',
  address                text         NOT NULL DEFAULT '',
  director               varchar(160) NOT NULL DEFAULT '',
  logo                   text         NOT NULL DEFAULT '',
  grade_max              numeric(5,2) NOT NULL DEFAULT 20,
  pass_mark              numeric(5,2) NOT NULL DEFAULT 10,
  avg_mode               varchar(16)  NOT NULL DEFAULT 'weighted',  -- weighted|simple
  avg_decimals           integer      NOT NULL DEFAULT 2,
  rank_visible           boolean      NOT NULL DEFAULT true,
  rank_ties              boolean      NOT NULL DEFAULT true,
  opt_fac_coef1          boolean      NOT NULL DEFAULT false,
  bulletin_tpl           varchar(16)  NOT NULL DEFAULT 'standard',
  bulletin_fmt           varchar(16)  NOT NULL DEFAULT 'vrac',      -- vrac|groupe|specialite
  bulletin_fmt_by_cycle  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  mentions               jsonb        NOT NULL DEFAULT '[]'::jsonb,
  sms                    boolean      NOT NULL DEFAULT false,
  whatsapp               boolean      NOT NULL DEFAULT false,
  sender                 varchar(11)  NOT NULL DEFAULT 'XSCHOOL',
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     integer REFERENCES schools(id) ON DELETE CASCADE,  -- NULL = superadmin
  email         varchar(160) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  full_name     varchar(160) NOT NULL DEFAULT '',
  role          varchar(20)  NOT NULL DEFAULT 'admin',
  active        boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ck_users_role CHECK (role IN
    ('superadmin','admin','teacher','supervisor','student'))
);
CREATE INDEX IF NOT EXISTS ix_users_school_id ON users(school_id);

-- ---------------------------------------------------------------------------
-- cycles / classes / subjects / programs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cycles (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        varchar(80) NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cycle_school_name UNIQUE (school_id, name)
);
CREATE INDEX IF NOT EXISTS ix_cycles_school_id ON cycles(school_id);

CREATE TABLE IF NOT EXISTS classes (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  cycle       varchar(80) NOT NULL,
  name        varchar(80) NOT NULL,
  grp         varchar(20) NOT NULL DEFAULT '',
  spec        varchar(120) NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_classes_school_id ON classes(school_id);

CREATE TABLE IF NOT EXISTS subjects (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        varchar(120) NOT NULL,
  dom         varchar(10) NOT NULL DEFAULT 'autre',  -- sci|litt|autre
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_subjects_school_id ON subjects(school_id);

CREATE TABLE IF NOT EXISTS programs (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    integer NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id  integer NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  coef        numeric(5,2) NOT NULL DEFAULT 1,
  oblig       boolean NOT NULL DEFAULT true,   -- false = facultative
  spec        boolean NOT NULL DEFAULT false,  -- true  = specialite
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_program_class_subject UNIQUE (class_id, subject_id)
);
CREATE INDEX IF NOT EXISTS ix_programs_school_id  ON programs(school_id);
CREATE INDEX IF NOT EXISTS ix_programs_class_id   ON programs(class_id);
CREATE INDEX IF NOT EXISTS ix_programs_subject_id ON programs(subject_id);

-- @@PART2@@

-- ---------------------------------------------------------------------------
-- students / enrollments / teachers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  matricule     varchar(40) NOT NULL DEFAULT '',
  nom           varchar(80) NOT NULL,
  prenom        varchar(120) NOT NULL DEFAULT '',
  sexe          varchar(1)  NOT NULL DEFAULT '',
  dob           varchar(10) NOT NULL DEFAULT '',
  lieu          varchar(120) NOT NULL DEFAULT '',
  pere          varchar(120) NOT NULL DEFAULT '',
  contact_pere  varchar(40) NOT NULL DEFAULT '',
  mere          varchar(120) NOT NULL DEFAULT '',
  contact_mere  varchar(40) NOT NULL DEFAULT '',
  photo         varchar(255) NOT NULL DEFAULT '',
  class_id      integer REFERENCES classes(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_school_mat UNIQUE (school_id, matricule)
);
CREATE INDEX IF NOT EXISTS ix_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS ix_students_matricule ON students(matricule);
CREATE INDEX IF NOT EXISTS ix_students_class_id  ON students(class_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id    integer REFERENCES classes(id) ON DELETE SET NULL,
  year        varchar(12) NOT NULL,
  statut      varchar(40) NOT NULL DEFAULT '',
  regime      varchar(40) NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_enrollment_student_year UNIQUE (student_id, year)
);
CREATE INDEX IF NOT EXISTS ix_enrollments_school_id  ON enrollments(school_id);
CREATE INDEX IF NOT EXISTS ix_enrollments_student_id ON enrollments(student_id);

CREATE TABLE IF NOT EXISTS teachers (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  nom         varchar(80) NOT NULL,
  prenom      varchar(120) NOT NULL DEFAULT '',
  dob         varchar(10) NOT NULL DEFAULT '',
  dip         varchar(160) NOT NULL DEFAULT '',
  spec        varchar(160) NOT NULL DEFAULT '',
  tel         varchar(40) NOT NULL DEFAULT '',
  urg_nom     varchar(160) NOT NULL DEFAULT '',
  urg_tel     varchar(40) NOT NULL DEFAULT '',
  photo       varchar(255) NOT NULL DEFAULT '',
  subs        jsonb NOT NULL DEFAULT '[]'::jsonb,
  classes     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_teachers_school_id ON teachers(school_id);

-- ---------------------------------------------------------------------------
-- grades / attendance / discipline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    integer NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id  integer NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year        varchar(12) NOT NULL,
  period      varchar(40) NOT NULL,
  detail      jsonb NOT NULL DEFAULT '[]'::jsonb,
  moy         numeric(6,3),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_grade_key UNIQUE (class_id, subject_id, period, student_id, year)
);
CREATE INDEX IF NOT EXISTS ix_grades_school_id  ON grades(school_id);
CREATE INDEX IF NOT EXISTS ix_grades_class_id   ON grades(class_id);
CREATE INDEX IF NOT EXISTS ix_grades_subject_id ON grades(subject_id);
CREATE INDEX IF NOT EXISTS ix_grades_student_id ON grades(student_id);

CREATE TABLE IF NOT EXISTS attendance (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id    integer NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date        varchar(10) NOT NULL,
  status      varchar(12) NOT NULL DEFAULT 'present',  -- present|retard|absent
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_attendance_school_id  ON attendance(school_id);
CREATE INDEX IF NOT EXISTS ix_attendance_student_id ON attendance(student_id);

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  teacher_id  integer NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date        varchar(10) NOT NULL,
  status      varchar(12) NOT NULL DEFAULT 'present',  -- present|retard|absent
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_attendance_key UNIQUE (teacher_id, date)
);
CREATE INDEX IF NOT EXISTS ix_teacher_attendance_school_id  ON teacher_attendance(school_id);
CREATE INDEX IF NOT EXISTS ix_teacher_attendance_teacher_id ON teacher_attendance(teacher_id);

CREATE TABLE IF NOT EXISTS discipline (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date        varchar(10) NOT NULL DEFAULT '',
  motif       varchar(255) NOT NULL DEFAULT '',
  gravite     varchar(20) NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_discipline_school_id  ON discipline(school_id);
CREATE INDEX IF NOT EXISTS ix_discipline_student_id ON discipline(student_id);

-- ---------------------------------------------------------------------------
-- payments / audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year        varchar(12) NOT NULL DEFAULT '',
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  mode        varchar(30) NOT NULL DEFAULT '',
  ref         varchar(80) NOT NULL DEFAULT '',
  label       varchar(160) NOT NULL DEFAULT '',
  date        varchar(10) NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_payments_school_id  ON payments(school_id);
CREATE INDEX IF NOT EXISTS ix_payments_student_id ON payments(student_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   integer REFERENCES schools(id) ON DELETE SET NULL,
  user_id     integer REFERENCES users(id)   ON DELETE SET NULL,
  action      varchar(80) NOT NULL,
  target      varchar(120) NOT NULL DEFAULT '',
  detail      text NOT NULL DEFAULT '',
  ip          varchar(45) NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_school_id ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id   ON audit_logs(user_id);

-- ---------------------------------------------------------------------------
-- Triggers updated_at sur toutes les tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schools','school_configs','users','cycles','classes','subjects','programs',
    'students','enrollments','teachers','grades','attendance','discipline',
    'payments','audit_logs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END;
$$;

COMMIT;
