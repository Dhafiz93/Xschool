"""Paiements / frais de scolarite."""
from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from .base import PKMixin, TimestampMixin, school_fk


class Payment(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "payments"

    school_id: Mapped[int] = school_fk()
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    year: Mapped[str] = mapped_column(String(12), default="")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    mode: Mapped[str] = mapped_column(String(30), default="")   # especes|banque|mobile...
    ref: Mapped[str] = mapped_column(String(80), default="")    # n de bordereau si banque
    label: Mapped[str] = mapped_column(String(160), default="")
    date: Mapped[str] = mapped_column(String(10), default="")
