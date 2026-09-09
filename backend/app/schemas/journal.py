from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.journal_entry import JOURNAL_BODY_MAX


class JournalEntryIn(BaseModel):
    # Omitted entry_date means "today in the user's timezone" — resolved in the
    # router, which is the only place that knows the user.
    entry_date: date | None = None
    body: str = Field(..., min_length=1, max_length=JOURNAL_BODY_MAX)


class JournalEntryPatch(BaseModel):
    entry_date: date | None = None
    body: str | None = Field(default=None, min_length=1, max_length=JOURNAL_BODY_MAX)


class JournalEntryOut(BaseModel):
    id: int
    entry_date: date
    body: str
    created_at: datetime
    updated_at: datetime


class JournalSummaryOut(BaseModel):
    """Dashboard card payload: what's already written for the viewed day."""

    entry_date: date
    count: int
    latest: JournalEntryOut | None
