"""Journal d'audit (qui a fait quoi, pour quelle ecole)."""
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from .base import PKMixin, TimestampMixin


class AuditLog(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "audit_logs"

    school_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    target: Mapped[str] = mapped_column(String(120), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str] = mapped_column(String(45), default="")
