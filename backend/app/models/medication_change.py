from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# `started` / `stopped` / `resumed` are written by the service alongside the
# parent medication's own state; the rest a user appends by hand.
MEDICATION_CHANGE_KINDS: tuple[str, ...] = (
    "started",
    "dose_change",
    "schedule_change",
    "paused",
    "resumed",
    "stopped",
    "note",
)

# Kinds the user may POST directly. `started` is written on create, `stopped`
# by /stop and `resumed` by /resume, so accepting them here would let the log
# disagree with the medication's own active/past state.
USER_CHANGE_KINDS: tuple[str, ...] = (
    "dose_change",
    "schedule_change",
    "paused",
    "note",
)

# Units offered by the dose picker.
DOSE_UNITS: tuple[str, ...] = (
    "mg",
    "mcg",
    "g",
    "ml",
    "IU",
    "unit",
    "tablet",
    "capsule",
    "puff",
    "drop",
    "patch",
    "spray",
)


class MedicationChange(Base):
    """One event in a medication's timeline: started, dose changed, paused,
    stopped, or a plain note.

    Append-only by design — the current dose/schedule is *folded* from the rows
    in date order (see `medication_service._fold_current`), never stored on the
    parent, so there is exactly one source of truth. A row may carry only the
    fields that actually changed; nulls mean "unchanged, carry the previous
    value forward".
    """

    __tablename__ = "medication_changes"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('started','dose_change','schedule_change','paused',"
            "'resumed','stopped','note')",
            name="ck_medication_change_kind",
        ),
        CheckConstraint(
            "dose_amount IS NULL OR dose_amount > 0", name="ck_medication_dose_positive"
        ),
        Index("ix_medication_changes_med", "medication_id", "effective_on"),
        Index("ix_medication_changes_user_date", "user_id", "effective_on"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    medication_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("medications.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    effective_on: Mapped[date] = mapped_column(Date, nullable=False)
    dose_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    dose_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Free text on purpose: "twice daily", "every second morning with food".
    frequency: Mapped[str | None] = mapped_column(String(80), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
