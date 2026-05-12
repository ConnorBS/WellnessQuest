from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HabitCheckin(Base):
    """One row per habit per local-tz day the user completed it.

    `occurred_on` is the user's local date (computed at insert time from the
    user's timezone), not a UTC timestamp — habits live in human days.
    """

    __tablename__ = "habit_checkins"
    __table_args__ = (
        UniqueConstraint("habit_id", "occurred_on", name="uq_habit_checkin_day"),
        Index("ix_habit_checkins_user_occurred_on", "user_id", "occurred_on"),
        Index("ix_habit_checkins_habit_occurred_on", "habit_id", "occurred_on"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    habit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("habits.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
