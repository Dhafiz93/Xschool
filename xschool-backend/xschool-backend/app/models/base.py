"""Mixins communs : cle primaire, horodatage, appartenance a une ecole (multi-tenant)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column


class PKMixin:
    id: Mapped[int] = mapped_column(Integer, primary_key=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantMixin:
    """A ajouter sur toute entite rattachee a une ecole.

    Regle d'or multi-tenant : chaque requete doit filtrer sur school_id.
    Voir app/utils/tenant.py (scoped_query / current_school_id).
    """

    @classmethod
    def __declare_last__(cls):  # pragma: no cover - documentation
        pass


def school_fk(nullable: bool = False) -> Mapped[int]:
    return mapped_column(
        Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=nullable, index=True
    )
