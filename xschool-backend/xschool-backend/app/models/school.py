"""Ecole + configuration (identite, bareme, mentions, format de bulletin)."""
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import PKMixin, TimestampMixin


class School(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "schools"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    config: Mapped["SchoolConfig"] = relationship(
        back_populates="school", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<School {self.slug}>"


class SchoolConfig(PKMixin, TimestampMixin, db.Model):
    """Reprend la config du prototype (schoolCfg) : identite + regles de calcul."""

    __tablename__ = "school_configs"

    school_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("schools.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Identite
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    director: Mapped[str] = mapped_column(String(160), default="")
    logo: Mapped[str] = mapped_column(Text, default="")  # data-url ou URL

    # Bareme / calcul
    grade_max: Mapped[float] = mapped_column(Numeric(5, 2), default=20)
    pass_mark: Mapped[float] = mapped_column(Numeric(5, 2), default=10)
    avg_mode: Mapped[str] = mapped_column(String(16), default="weighted")  # weighted|simple
    avg_decimals: Mapped[int] = mapped_column(Integer, default=2)
    rank_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    rank_ties: Mapped[bool] = mapped_column(Boolean, default=True)
    opt_fac_coef1: Mapped[bool] = mapped_column(Boolean, default=False)

    # Bulletin : modele + format (defaut) + surcharge par cycle
    bulletin_tpl: Mapped[str] = mapped_column(String(16), default="officiel")
    bulletin_fmt: Mapped[str] = mapped_column(String(16), default="vrac")  # vrac|groupe|specialite
    bulletin_fmt_by_cycle: Mapped[dict] = mapped_column(JSONB, default=dict)
    mentions: Mapped[list] = mapped_column(JSONB, default=list)  # [{l,min}]

    # Communication
    sms: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    sender: Mapped[str] = mapped_column(String(11), default="XSCHOOL")

    school: Mapped[School] = relationship(back_populates="config")
