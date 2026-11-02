-- ---------------------------------------------------------------------------
-- Pointage de presence des ENSEIGNANTS (present|retard|absent)
-- ---------------------------------------------------------------------------
-- A appliquer SANS reset de base : idempotent (CREATE TABLE IF NOT EXISTS).
-- Equivalent a `flask create-tables` qui ne cree que les tables manquantes.
-- Les heures prevues/realisees sont calculees cote front depuis l'emploi du
-- temps ; cette table ne persiste QUE le statut par (enseignant, date).

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
