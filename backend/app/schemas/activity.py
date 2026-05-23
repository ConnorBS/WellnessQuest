from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ActivityAddIn(BaseModel):
    minutes: int = Field(..., gt=0, le=1440)
    client_id: str | None = Field(default=None, max_length=120)
    occurred_at: datetime | None = None
    exercise_type: str | None = Field(default=None, max_length=60)
    name: str | None = Field(default=None, max_length=60)


class ActivityEntryOut(BaseModel):
    id: int
    minutes: int
    source: str
    occurred_at: datetime
    client_id: str | None = None
    exercise_type: str | None = None
    name: str | None = None


class ActivityEntryPatch(BaseModel):
    """All fields optional; only provided ones are updated. `source` and
    `client_id` are intentionally not patchable."""

    minutes: int | None = Field(default=None, gt=0, le=1440)
    occurred_at: datetime | None = None
    exercise_type: str | None = Field(default=None, max_length=60)
    name: str | None = Field(default=None, max_length=60)


class ActivityTodayOut(BaseModel):
    date: str
    total_minutes: int
    goal_minutes: int
    percent: int
    entries: list[ActivityEntryOut]


class ActivityAddOut(BaseModel):
    entry: ActivityEntryOut
    total_minutes: int
    goal_minutes: int
    xp_delta: int
    goal_met: bool


class ActivityRecentEntry(BaseModel):
    """Recently-logged activity entry surfaced as datalist suggestions in the
    quick-log modal. Includes both a free-form name and the exercise_type so
    the modal can populate two distinct autocomplete fields from one fetch.
    """

    name: str | None = None
    exercise_type: str | None = None
    minutes: int
    last_logged_at: datetime
