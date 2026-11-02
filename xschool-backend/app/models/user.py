"""Utilisateurs + roles. Auth par email, mot de passe HASHE (jamais en clair)."""
from werkzeug.security import check_password_hash, generate_password_hash
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
    # Identifiant de connexion optionnel (ex: "admin.horizon"). Unique s'il est
    # renseigne. Permet de se connecter avec le login OU l'email.
    login: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), default="")
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=ROLE_ADMIN)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Nul pour le superadmin, obligatoire pour les autres roles.
    school_id: Mapped[int] = mapped_column(
        Integer, db.ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Lien EXPLICITE compte -> fiche. Permet de retrouver de maniere fiable la
    # fiche enseignant (ou eleve) d'un compte connecte, sans dependre d'une
    # correspondance fragile par nom. Nul pour admin/superadmin/comptable.
    teacher_id: Mapped[int] = mapped_column(
        Integer, db.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    student_id: Mapped[int] = mapped_column(
        Integer, db.ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ---- mot de passe ----
    # Hachage via Werkzeug (livre avec Flask) : aucune dependance externe
    # (plus de passlib/bcrypt), pbkdf2:sha256 par defaut, portable partout.
    def set_password(self, raw: str) -> None:
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, raw)

    @property
    def is_superadmin(self) -> bool:
        return self.role == ROLE_SUPERADMIN

    @classmethod
    def find_by_identifier(cls, ident: str):
        """Retrouve un utilisateur par son email OU son login (insensible a la casse)."""
        ident = (ident or "").strip().lower()
        if not ident:
            return None
        return (
            db.session.query(cls)
            .filter(db.or_(cls.email == ident, cls.login == ident))
            .first()
        )

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "login": self.login,
            "full_name": self.full_name,
            "role": self.role,
            "school_id": self.school_id,
            "active": self.active,
            "teacher_id": self.teacher_id,
            "student_id": self.student_id,
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
