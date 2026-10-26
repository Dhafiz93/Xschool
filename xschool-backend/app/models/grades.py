"""Notes, appel (presence) et discipline."""
from sqlalchemy import ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from .base import PKMixin, TimestampMixin, school_fk


class Grade(PKMixin, TimestampMixin, db.Model):
    """Notes d'un eleve pour (classe, matiere, periode). detail = liste de notes brutes."""

    __tablename__ = "grades"
    __table_args__ = (
        UniqueConstraint(
            "class_id", "subject_id", "period", "student_id", "year",
            name="uq_grade_key",
        ),
    )

    school_id: Mapped[int] = school_fk()
    year: Mapped[str] = mapped_column(String(12), nullable=False)
    period: Mapped[str] = mapped_column(String(40), nullable=False)
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # notes brutes (interro, devoir, compo...) ; la moyenne est calculee cote service
    detail: Mapped[list] = mapped_column(JSONB, default=list)
    moy: Mapped[float] = mapped_column(Numeric(6, 3), nullable=True)


class Attendance(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "attendance"

    school_id: Mapped[int] = school_fk()
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="present")  # present|retard|absent


class Discipline(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "discipline"

    school_id: Mapped[int] = school_fk()
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[str] = mapped_column(String(10), default="")
    motif: Mapped[str] = mapped_column(String(255), default="")
    gravite: Mapped[str] = mapped_column(String(20), default="")
