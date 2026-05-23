from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class WaterAddIn(BaseModel):
    ml: int = Field(..., gt=0, le=5000)
    client_id: str | None = Field(default=None, max_length=120)
    occurred_at: datetime | None = None
    name: str | None = Field(default=None, max_length=60)


class WaterEntryOut(BaseModel):
    id: int
    ml: int
    source: str
    occurred_at: datetime
    client_id: str | None = None
    name: str | None = None


class WaterEntryPatch(BaseModel):
    """All fields optional; only provided ones are updated. `source` and
    `client_id` are intentionally not patchable — source is the audit trail
    of where the row came from, and client_id is the idempotency key."""

    ml: int | None = Field(default=None, gt=0, le=5000)
    occurred_at: datetime | None = None
    name: str | None = Field(default=None, max_length=60)


class WaterTodayOut(BaseModel):
    date: str  # YYYY-MM-DD in user's tz
    total_ml: int
    goal_ml: int
    percent: int
    entries: list[WaterEntryOut]


class WaterAddOut(BaseModel):
    entry: WaterEntryOut
    total_ml: int
    goal_ml: int
    xp_delta: int
    goal_met: bool


class WaterRecentEntry(BaseModel):
    name: str
    ml: int
    last_logged_at: datetime
