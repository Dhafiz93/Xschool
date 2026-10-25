"""Utilisateurs + roles. Auth par email, mot de passe HASHE (jamais en clair)."""
from passlib.hash import bcrypt
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from .base import PKMixin, TimestampMixin, school_fk

# Roles possibles (le superadmin n'est rattache a aucune ecole : school_id nul)
ROLE_SUPERADMIN = "superadmin"
ROLE_ADMIN = "admin"
ROLE_TEACHER = "teacher"
ROLE_SUPERVISOR = "supervisor"
ROLE_STUDENT = "student"
ROLES = {ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEACHER, ROLE_SUPERVISOR, ROLE_STUDENT}


class User(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), default="")
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=ROLE_ADMIN)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Nul pour le superadmin, obligatoire pour les autres roles.
    school_id: Mapped[int] = mapped_column(
        Integer, db.ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # ---- mot de passe ----
    def set_password(self, raw: str) -> None:
        self.password_hash = bcrypt.hash(raw)

    def check_password(self, raw: str) -> bool:
        try:
            return bcrypt.verify(raw, self.password_hash)
        except ValueError:
            return False

    @property
    def is_superadmin(self) -> bool:
        return self.role == ROLE_SUPERADMIN

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "school_id": self.school_id,
            "active": self.active,
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
