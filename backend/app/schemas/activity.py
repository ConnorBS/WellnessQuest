from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ActivityAddIn(BaseModel):
    minutes: int = Field(..., gt=0, le=1440)
    client_id: str | None = Field(default=None, max_length=120)
    occurred_at: datetime | None = None
    exercise_type: str | None = Field(default=None, max_length=60)


class ActivityEntryOut(BaseModel):
    id: int
    minutes: int
    source: str
    occurred_at: datetime
    client_id: str | None = None
    exercise_type: str | None = None


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
