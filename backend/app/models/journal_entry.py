from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Long enough for a proper entry, short enough that a runaway paste can't fill
# the table. Mirrored by the pydantic max_length so the API rejects before the
# DB does.
JOURNAL_BODY_MAX = 4000


class JournalEntry(Base):
    """Free-text notes about a day — what happened, what was worth remembering.

    Several notes per day are expected. ``entry_date`` is the day the note is
    *about* (the user's local calendar date), which is what the day switcher
    filters on; ``created_at`` only orders notes within that day. Back-dating is
    therefore just picking an earlier ``entry_date``, and it never rewrites the
    order of anything already written.
    """

    __tablename__ = "journal_entries"
    __table_args__ = (
        Index("ix_journal_entries_user_date", "user_id", "entry_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    body: Mapped[str] = mapped_column(String(JOURNAL_BODY_MAX), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
