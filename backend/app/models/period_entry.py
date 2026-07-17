from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Flow intensity for a logged period day.
FLOW_VALUES: tuple[str, ...] = ("spotting", "light", "medium", "heavy")

# Fixed period-symptom checklist (v1). Kept in the model layer so the API
# schema validates against the same vocabulary.
PERIOD_SYMPTOMS: tuple[str, ...] = (
    "cramps",
    "headache",
    "mood_swings",
    "bloating",
    "fatigue",
    "backache",
    "nausea",
    "tender_breasts",
    "acne",
    "cravings",
)

_FLOW_IN = ", ".join(f"'{f}'" for f in FLOW_VALUES)


class PeriodEntry(Base):
    """One logged period day per calendar date (upsert by date). Cycle-length and
    next-period/fertile-window predictions are computed client-side from the raw
    day history, mirroring how BP categories are frontend-computed."""

    __tablename__ = "period_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "entry_date", name="uq_period_user_date"),
        CheckConstraint(f"flow IN ({_FLOW_IN})", name="ck_period_flow"),
        Index("ix_period_entries_user_date", "user_id", "entry_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    flow: Mapped[str] = mapped_column(String(10), nullable=False)
    symptoms: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default="{}"
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
