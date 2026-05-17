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
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BloodPressureTarget(Base):
    """Append-only blood pressure target history.

    Each row records target systolic/diastolic as of `effective_at`. The user's
    "current" target is whichever row has the latest effective_at. Both columns
    NULL represents an explicit "no target" state (cleared as of effective_at),
    distinct from "no row at all" (never set).
    """

    __tablename__ = "blood_pressure_targets"
    __table_args__ = (
        CheckConstraint(
            "(target_systolic IS NULL AND target_diastolic IS NULL) OR ("
            "target_systolic IS NOT NULL AND target_diastolic IS NOT NULL "
            "AND target_systolic > 0 AND target_systolic < 300 "
            "AND target_diastolic > 0 AND target_diastolic < 200 "
            "AND target_systolic > target_diastolic)",
            name="ck_bp_target_pair",
        ),
        Index(
            "ix_blood_pressure_targets_user_effective_at",
            "user_id",
            "effective_at",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_systolic: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    target_diastolic: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    effective_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
