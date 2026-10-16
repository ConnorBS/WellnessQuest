from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Canonical mood vocabulary (from the mood-tracker design). Kept here in the
# model layer so both the DB CHECK constraint and the API schema validate
# against the same list.
MOOD_VALUES: tuple[str, ...] = (
    "happy",
    "calm",
    "excited",
    "motivated",
    "relaxed",
    "grateful",
    "productive",
    "tired",
    "sad",
    "stressed",
    "anxious",
    "overwhelmed",
    "frustrated",
    "low_energy",
    "angry",
)

# Room for an actual reflection on the moment, not just a tag line; same cap
# as a journal entry. Mirrored by the pydantic max_length.
MOOD_NOTE_MAX = 4000

_MOOD_IN = ", ".join(f"'{m}'" for m in MOOD_VALUES)
_MOOD_ARRAY = f"ARRAY[{_MOOD_IN}]::varchar[]"


class MoodEntry(Base):
    """Append-only mood log. Multiple timestamped check-ins per day are expected,
    each with one or more feelings, an energy level (1=low, 2=medium, 3=high) and
    an optional note.

    ``moods`` is ordered: the first element is the strongest feeling and is the
    one the UI colours by (dashboard card, 30-day grid). Feelings rarely come
    alone, so a check-in can carry several rather than forcing one pick.
    """

    __tablename__ = "mood_entries"
    __table_args__ = (
        CheckConstraint(f"moods <@ {_MOOD_ARRAY}", name="ck_mood_values"),
        CheckConstraint("cardinality(moods) >= 1", name="ck_mood_values_nonempty"),
        CheckConstraint("energy >= 1 AND energy <= 3", name="ck_mood_energy_range"),
        Index("ix_mood_entries_user_occurred_at", "user_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    moods: Mapped[list[str]] = mapped_column(ARRAY(String(20)), nullable=False)
    energy: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(MOOD_NOTE_MAX), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
