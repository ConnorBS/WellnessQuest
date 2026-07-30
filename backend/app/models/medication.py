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
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Dosage forms the UI offers. Free-text `form` is rejected by the CHECK so the
# list stays renderable as a picker; "other" is the escape hatch.
MEDICATION_FORMS: tuple[str, ...] = (
    "tablet",
    "capsule",
    "liquid",
    "injection",
    "patch",
    "inhaler",
    "cream",
    "drops",
    "spray",
    "suppository",
    "other",
)


class Medication(Base):
    """One medication in the user's register.

    Identity only — the dose/schedule timeline lives in `medication_changes`,
    which is the append-only audit trail (same shape as weight/BP targets).
    `ended_on IS NULL` means "currently taking"; a non-NULL `ended_on` moves it
    to the past-medications list without deleting any history.
    """

    __tablename__ = "medications"
    __table_args__ = (
        CheckConstraint(
            "form IS NULL OR form IN ("
            "'tablet','capsule','liquid','injection','patch','inhaler',"
            "'cream','drops','spray','suppository','other')",
            name="ck_medication_form",
        ),
        CheckConstraint(
            "ended_on IS NULL OR ended_on >= started_on", name="ck_medication_dates"
        ),
        Index("ix_medications_user", "user_id", "sort_order"),
        Index("ix_medications_user_ended", "user_id", "ended_on"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    form: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # What it's for, in the user's words — not a coded indication.
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    prescriber: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_on: Mapped[date] = mapped_column(Date, nullable=False)
    ended_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    stopped_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
