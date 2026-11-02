"""Jetons d'appareils pour les notifications push (FCM / WebPush / Expo).

Un utilisateur peut avoir plusieurs appareils (telephone, navigateur...). Le
`token` est fourni par le service push du device et est unique. `active=False`
marque un jeton revoque (desinscription, ou signale invalide par le fournisseur).
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from .base import PKMixin, TimestampMixin, school_fk


class DeviceToken(PKMixin, TimestampMixin, db.Model):
    """Jeton d'un appareil pour le push d'un utilisateur donne."""

    __tablename__ = "device_tokens"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    school_id: Mapped[int] = school_fk(nullable=True)
    token: Mapped[str] = mapped_column(
        String(512), unique=True, index=True, nullable=False)
    # Plateforme d'origine : 'web' | 'android' | 'ios'.
    platform: Mapped[str] = mapped_column(String(20), default="web")
    active: Mapped[bool] = mapped_column(
        Boolean, default=True, index=True, nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return "<DeviceToken u{} {} {}>".format(
            self.user_id, self.platform, "on" if self.active else "off")
