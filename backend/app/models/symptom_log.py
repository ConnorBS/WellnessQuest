from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

SEVERITY_VALUES: tuple[str, ...] = ("none", "mild", "moderate", "severe")
_SEV_IN = ", ".join(f"'{s}'" for s in SEVERITY_VALUES)


class SymptomLog(Base):
    """One symptom's severity (and optional duration) within a pain check-in."""

    __tablename__ = "symptom_logs"
    __table_args__ = (
        CheckConstraint(f"severity IN ({_SEV_IN})", name="ck_symptom_severity"),
        CheckConstraint(
            "duration_minutes IS NULL OR duration_minutes >= 0",
            name="ck_symptom_duration",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pain_entry_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("pain_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # No ondelete: catalog rows are archived, never hard-deleted, so history stays valid.
    catalog_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("symptom_catalog.id"),
        nullable=False,
    )
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
