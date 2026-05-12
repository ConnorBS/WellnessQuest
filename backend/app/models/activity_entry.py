from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ActivityEntry(Base):
    """Append-only activity log. Today's total is SUM(minutes) grouped by user + day-in-tz."""

    __tablename__ = "activity_entries"
    __table_args__ = (
        CheckConstraint("minutes > 0 AND minutes <= 1440", name="minutes_range"),
        UniqueConstraint("user_id", "client_id", name="activity_user_client"),
        Index("ix_activity_entries_user_occurred_at", "user_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # 'pwa' | 'ha' | 'manual'
    exercise_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    client_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
