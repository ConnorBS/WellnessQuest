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
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Body-map regions the user can tap. Fixed vocabulary (front + back combined).
BODY_REGIONS: tuple[str, ...] = (
    # front view
    "head",
    "neck",
    "left_shoulder",
    "right_shoulder",
    "chest",
    "abdomen",
    "left_arm",
    "right_arm",
    "left_hand",
    "right_hand",
    "hip",
    "left_leg",
    "right_leg",
    "left_knee",
    "right_knee",
    "left_foot",
    "right_foot",
    # back view
    "back_head",
    "back_neck",
    "left_shoulder_blade",
    "right_shoulder_blade",
    "upper_back",
    "lower_back",
    "left_arm_back",
    "right_arm_back",
    "left_hand_back",
    "right_hand_back",
    "left_glute",
    "right_glute",
    "left_hamstring",
    "right_hamstring",
    "left_calf",
    "right_calf",
    "left_heel",
    "right_heel",
)


class PainEntry(Base):
    """A pain/symptom check-in: an overall pain level plus optional tapped body
    regions and per-symptom severities (child rows)."""

    __tablename__ = "pain_entries"
    __table_args__ = (
        CheckConstraint("pain_level >= 0 AND pain_level <= 10", name="ck_pain_level_range"),
        Index("ix_pain_entries_user_occurred_at", "user_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    pain_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    locations: Mapped[list[PainLocation]] = relationship(
        "PainLocation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    symptoms: Mapped[list[SymptomLog]] = relationship(
        "SymptomLog",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


# Imported at end to attach relationships without a circular import at module top.
from app.models.pain_location import PainLocation  # noqa: E402
from app.models.symptom_log import SymptomLog  # noqa: E402
