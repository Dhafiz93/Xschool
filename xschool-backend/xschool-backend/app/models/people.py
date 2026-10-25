"""Eleves (+ inscriptions par annee) et enseignants."""
from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import PKMixin, TimestampMixin, school_fk


class Student(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("school_id", "matricule", name="uq_student_school_mat"),
    )

    school_id: Mapped[int] = school_fk()
    matricule: Mapped[str] = mapped_column(String(40), index=True)
    nom: Mapped[str] = mapped_column(String(80), nullable=False)
    prenom: Mapped[str] = mapped_column(String(120), default="")
    sexe: Mapped[str] = mapped_column(String(1), default="")
    dob: Mapped[str] = mapped_column(String(10), default="")   # AAAA-MM-JJ
    lieu: Mapped[str] = mapped_column(String(120), default="")
    pere: Mapped[str] = mapped_column(String(120), default="")
    contact_pere: Mapped[str] = mapped_column(String(40), default="")
    mere: Mapped[str] = mapped_column(String(120), default="")
    contact_mere: Mapped[str] = mapped_column(String(40), default="")
    photo: Mapped[str] = mapped_column(String(255), default="")

    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    enrollments = relationship(
        "Enrollment", back_populates="student", cascade="all, delete-orphan"
    )

    @property
    def full_name(self):
        return f"{self.nom} {self.prenom}".strip()


class Enrollment(PKMixin, TimestampMixin, db.Model):
    """Inscription d'un eleve pour une annee scolaire donnee."""

    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "year", name="uq_enrollment_student_year"),
    )

    school_id: Mapped[int] = school_fk()
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    year: Mapped[str] = mapped_column(String(12), nullable=False)      # ex: 2025-2026
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id", ondelete="SET NULL"), nullable=True
    )
    statut: Mapped[str] = mapped_column(String(40), default="")
    regime: Mapped[str] = mapped_column(String(40), default="")

    student = relationship("Student", back_populates="enrollments")


class Teacher(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "teachers"

    school_id: Mapped[int] = school_fk()
    nom: Mapped[str] = mapped_column(String(80), nullable=False)
    prenom: Mapped[str] = mapped_column(String(120), default="")
    dob: Mapped[str] = mapped_column(String(10), default="")
    dip: Mapped[str] = mapped_column(String(160), default="")
    spec: Mapped[str] = mapped_column(String(160), default="")
    tel: Mapped[str] = mapped_column(String(40), default="")
    urg_nom: Mapped[str] = mapped_column(String(160), default="")
    urg_tel: Mapped[str] = mapped_column(String(40), default="")
    photo: Mapped[str] = mapped_column(String(255), default="")
    # listes d'ids (matieres / classes) ; a normaliser en tables de liaison plus tard
    subs: Mapped[list] = mapped_column(JSONB, default=list)
    classes: Mapped[list] = mapped_column(JSONB, default=list)

    @property
    def full_name(self):
        return f"{self.nom} {self.prenom}".strip()
