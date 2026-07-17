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

# Seeded on user creation; the gentle "tiny wins still count" self-care list.
DEFAULT_TINY_WINS: tuple[str, ...] = (
    "Got out of bed",
    "Got dressed",
    "Brushed teeth / washed face",
    "Ate or drank something",
    "Took medication",
    "Replied to a message",
    "Moved my body",
    "Had a shower",
    "Took breaks when needed",
    "Kept myself safe",
)


class TinyWinItem(Base):
    """A self-care checklist item. Soft-deleted via archived_at so past check-ins
    stay valid."""

    __tablename__ = "tiny_win_items"
    __table_args__ = (
        Index("ix_tiny_win_items_user", "user_id", "sort_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
