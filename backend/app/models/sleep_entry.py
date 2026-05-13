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
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SleepEntry(Base):
    """One row per sleep session. `ended_at` drives "last night" lookup."""

    __tablename__ = "sleep_entries"
    __table_args__ = (
        CheckConstraint(
            "duration_minutes > 0 AND duration_minutes <= 1440",
            name="ck_sleep_entries_duration_range",
        ),
        CheckConstraint(
            "quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)",
            name="ck_sleep_entries_quality_range",
        ),
        CheckConstraint("ended_at > started_at", name="ck_sleep_entries_time_order"),
        UniqueConstraint("user_id", "client_id", name="uq_sleep_entries_user_client"),
        Index("ix_sleep_entries_user_ended_at", "user_id", "ended_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    client_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
