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
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Who was involved. `solo` covers masturbation — Clue and Flo both track it in
# the same log rather than a separate one, and the cycle-relevant distinction is
# really just "could this have involved sperm".
INTIMACY_KINDS: tuple[str, ...] = ("partnered", "solo")

# Contraception as logged, not as prescribed: the point is whether *this*
# occurrence was protected, so the vocabulary stays coarse (Apple Health records
# only a protection yes/no; Clue adds withdrawal). `unspecified` is the honest
# default for "logged it, didn't say" and is distinct from `unprotected`.
PROTECTION_VALUES: tuple[str, ...] = (
    "protected",
    "unprotected",
    "withdrawal",
    "unspecified",
)

# Free-standing tags, modelled on Clue's "Sex life" chip set. Deliberately a
# flat vocabulary rather than columns: it grows without a migration per idea,
# and matches how period symptoms are already stored.
INTIMACY_TAGS: tuple[str, ...] = (
    "orgasm",
    "no_orgasm",
    "high_drive",
    "low_drive",
    "painful",
    "toys",
    "fantasies",
    "bleeding",
)

_KIND_IN = ", ".join(f"'{k}'" for k in INTIMACY_KINDS)
_PROTECTION_IN = ", ".join(f"'{p}'" for p in PROTECTION_VALUES)

# Short on purpose. The note is the most sensitive column in the table; there is
# no reason for it to hold an essay.
INTIMACY_NOTE_MAX = 500


class IntimacyEntry(Base):
    """One logged sexual-activity occurrence.

    Named ``intimacy`` rather than ``sex`` throughout the code, the table and the
    URLs for the same reason activity endpoints are aliased to ``/move``: ad,
    privacy and DNS filters match on the word in a path and kill the request
    with no useful error. The user-facing label is still "Sexual activity".

    Several occurrences per day are allowed — Apple Health's one-per-day cap is
    a well-known complaint — so this is a plain log keyed on ``entry_date`` with
    ``created_at`` ordering within the day, the same shape as journal entries
    (and unlike ``period_entries``, which upserts one row per date because a day
    has exactly one flow).
    """

    __tablename__ = "intimacy_entries"
    __table_args__ = (
        CheckConstraint(f"kind IN ({_KIND_IN})", name="ck_intimacy_kind"),
        CheckConstraint(
            f"protection IN ({_PROTECTION_IN})", name="ck_intimacy_protection"
        ),
        Index("ix_intimacy_entries_user_date", "user_id", "entry_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    protection: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="unspecified"
    )
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default="{}"
    )
    note: Mapped[str | None] = mapped_column(String(INTIMACY_NOTE_MAX), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
