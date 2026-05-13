from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StepsEntry(Base):
    """Append-only step deltas. Today's total is SUM grouped by user + day-in-tz.

    HA cumulative step counters are converted to deltas by the pull worker
    before insert, so a SUM gives an accurate daily total without double-
    counting the underlying cumulative sensor.
    """

    __tablename__ = "steps_entries"
    __table_args__ = (
        CheckConstraint(
            "count > 0 AND count <= 200000", name="ck_steps_entries_count_range"
        ),
        UniqueConstraint("user_id", "client_id", name="uq_steps_entries_user_client"),
        Index("ix_steps_entries_user_occurred_at", "user_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # 'pwa'|'ha'|'ha_pull'|'manual'
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    client_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
