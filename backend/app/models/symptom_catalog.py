from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
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

# Seeded on user creation; the user can rename, archive, or add their own.
DEFAULT_SYMPTOMS: tuple[str, ...] = (
    "Cramps",
    "Headache",
    "Nausea",
    "Fatigue",
    "Dizziness",
    "Brain fog",
    "Joint pain",
    "Muscle spasms",
    "Insomnia",
    "Low mood",
)


class SymptomCatalog(Base):
    """A user's editable list of symptoms. Soft-deleted via archived_at so
    historical symptom logs keep referencing the row."""

    __tablename__ = "symptom_catalog"
    __table_args__ = (
        Index("ix_symptom_catalog_user", "user_id", "sort_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
