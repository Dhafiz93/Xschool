"""Structure academique : cycles, classes, matieres, programme."""
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import PKMixin, TimestampMixin, school_fk

# Domaines de matiere (reprend DOM du prototype)
DOMAINS = {"sci": "Scientifique", "litt": "Litteraire", "autre": "General"}


class Cycle(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "cycles"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_cycle_school_name"),)

    school_id: Mapped[int] = school_fk()
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class SchoolClass(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "classes"

    school_id: Mapped[int] = school_fk()
    cycle: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    grp: Mapped[str] = mapped_column(String(20), default="")
    spec: Mapped[str] = mapped_column(String(120), default="")
    # Enseignant titulaire (professeur principal) de la classe. Nullable : une
    # classe peut ne pas avoir de titulaire. ON DELETE SET NULL -> si la fiche
    # enseignant est supprimee, la classe perd simplement son titulaire.
    titulaire_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Historique des titulaires par annee scolaire : { "2024-2025": teacher_id, ... }.
    # Le titulaire d'une classe peut changer d'une annee a l'autre ; cette map
    # garde donc une valeur par annee. `titulaire_id` ci-dessus reste le titulaire
    # "par defaut" (retro-compat) utilise en repli quand une annee n'a pas d'entree.
    titulaires_by_year: Mapped[dict] = mapped_column(JSONB, default=dict)

    program = relationship("Program", back_populates="klass", cascade="all, delete-orphan")
    titulaire = relationship("Teacher", foreign_keys=[titulaire_id])


class Subject(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "subjects"

    school_id: Mapped[int] = school_fk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    dom: Mapped[str] = mapped_column(String(10), default="autre")  # sci|litt|autre


class Program(PKMixin, TimestampMixin, db.Model):
    """Une ligne de programme = une matiere affectee a une classe (coef, oblig, spec)."""

    __tablename__ = "programs"
    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_program_class_subject"),
    )

    school_id: Mapped[int] = school_fk()
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    coef: Mapped[float] = mapped_column(Numeric(5, 2), default=1)
    oblig: Mapped[bool] = mapped_column(Boolean, default=True)   # False = facultative
    spec: Mapped[bool] = mapped_column(Boolean, default=False)   # True = matiere de specialite

    klass = relationship("SchoolClass", back_populates="program")
    subject = relationship("Subject")
