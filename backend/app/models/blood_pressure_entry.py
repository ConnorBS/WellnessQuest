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
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BloodPressureEntry(Base):
    """Append-only blood pressure log. Multiple readings per day are expected."""

    __tablename__ = "blood_pressure_entries"
    __table_args__ = (
        CheckConstraint("systolic > 0 AND systolic < 300", name="ck_bp_systolic_range"),
        CheckConstraint("diastolic > 0 AND diastolic < 200", name="ck_bp_diastolic_range"),
        CheckConstraint(
            "pulse IS NULL OR (pulse > 0 AND pulse < 300)", name="ck_bp_pulse_range"
        ),
        CheckConstraint("systolic > diastolic", name="ck_bp_systolic_gt_diastolic"),
        Index(
            "ix_blood_pressure_entries_user_occurred_at",
            "user_id",
            "occurred_at",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    systolic: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    diastolic: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    pulse: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
