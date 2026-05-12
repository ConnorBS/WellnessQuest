from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Habit(Base):
    __tablename__ = "habits"
    __table_args__ = (
        CheckConstraint(
            "cadence_kind IN ('daily','weekly','monthly','interval')",
            name="ck_habits_cadence_kind",
        ),
        CheckConstraint(
            "icon_kind IN ('builtin','upload','none')",
            name="ck_habits_icon_kind",
        ),
        CheckConstraint(
            "(cadence_kind <> 'weekly') OR (weekly_target BETWEEN 1 AND 7)",
            name="ck_habits_weekly_target_range",
        ),
        CheckConstraint(
            "(cadence_kind <> 'monthly') OR (monthly_target BETWEEN 1 AND 31)",
            name="ck_habits_monthly_target_range",
        ),
        CheckConstraint(
            "(cadence_kind <> 'interval') OR (interval_days BETWEEN 2 AND 365)",
            name="ck_habits_interval_days_range",
        ),
        Index("ix_habits_user_sort", "user_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    icon_kind: Mapped[str] = mapped_column(String(10), nullable=False, default="none")
    icon_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cadence_kind: Mapped[str] = mapped_column(String(10), nullable=False)
    weekly_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
