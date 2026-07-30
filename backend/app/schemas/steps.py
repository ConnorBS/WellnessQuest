from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class StepsAddIn(BaseModel):
    count: int = Field(..., gt=0, le=200_000)
    client_id: str | None = Field(default=None, max_length=120)
    occurred_at: datetime | None = None


class StepsEntryOut(BaseModel):
    id: int
    count: int
    source: str
    occurred_at: datetime
    client_id: str | None = None


class StepsTodayOut(BaseModel):
    date: str
    total: int
    goal: int
    percent: int
    # Empty on the HA rollup endpoints, which only care about the total.
    entries: list[StepsEntryOut] = Field(default_factory=list)


class StepsGoalUpdate(BaseModel):
    target_steps: int = Field(gt=0, le=200_000)


class StepsGoalOut(BaseModel):
    target_steps: int


class StepsAddOut(BaseModel):
    entry: StepsEntryOut
    total: int
    goal: int
    xp_delta: int
    goal_met: bool
