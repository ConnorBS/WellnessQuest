from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class SleepAddIn(BaseModel):
    started_at: datetime
    ended_at: datetime
    quality_score: int | None = Field(default=None, ge=0, le=100)
    client_id: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def _check_order(self) -> SleepAddIn:
        if self.ended_at <= self.started_at:
            raise ValueError("ended_at must be after started_at")
        return self


class SleepEntryOut(BaseModel):
    id: int
    started_at: datetime
    ended_at: datetime
    duration_minutes: int
    quality_score: int | None = None
    source: str
    client_id: str | None = None


class SleepLastOut(BaseModel):
    entry: SleepEntryOut | None
    goal_minutes: int


class SleepAddOut(BaseModel):
    entry: SleepEntryOut
    goal_minutes: int
    xp_delta: int
    goal_met: bool
