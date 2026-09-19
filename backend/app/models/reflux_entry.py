from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Three levels rather than a 0-10 slider: an episode is logged one-handed on a
# phone, usually while it's happening. Same words the pain symptom log uses.
REFLUX_SEVERITIES: tuple[str, ...] = ("mild", "moderate", "severe")

# The usual GERD trigger checklist — food and drink first, then the two eating
# habits every clinic handout lists alongside them. A flat vocabulary stored as
# an array (like period symptoms), so adding one is a code change, not a
# migration. Anything not here goes in the note.
REFLUX_TRIGGERS: tuple[str, ...] = (
    "caffeine",
    "alcohol",
    "chocolate",
    "spicy",
    "fatty_fried",
    "citrus",
    "tomato",
    "carbonated",
    "mint",
    "onion_garlic",
    "dairy",
    "large_meal",
    "late_meal",
)

_SEVERITY_IN = ", ".join(f"'{s}'" for s in REFLUX_SEVERITIES)


class RefluxEntry(Base):
    """One acid-reflux episode: when, how bad, what was eaten beforehand.

    Append-only like mood — several episodes a day are normal for someone
    tracking this. ``occurred_at`` is the episode's own time (the user picks
    it, defaults to now); ``created_at`` is only when the row was written.
    """

    __tablename__ = "reflux_entries"
    __table_args__ = (
        CheckConstraint(f"severity IN ({_SEVERITY_IN})", name="ck_reflux_severity"),
        Index("ix_reflux_entries_user_occurred_at", "user_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    triggers: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default="{}"
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
