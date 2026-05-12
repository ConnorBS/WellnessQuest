from __future__ import annotations

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

CadenceKind = Literal["daily", "weekly", "monthly", "interval"]
HabitStatus = Literal["done", "ok", "due_today", "overdue"]
IconKind = Literal["builtin", "upload", "none"]


class HabitIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    icon_kind: IconKind = "none"
    icon_key: str | None = Field(default=None, max_length=64)
    cadence_kind: CadenceKind
    weekly_target: int | None = Field(default=None, ge=1, le=7)
    monthly_target: int | None = Field(default=None, ge=1, le=31)
    interval_days: int | None = Field(default=None, ge=2, le=365)
    sort_order: int = 0

    @model_validator(mode="after")
    def _check_cadence_fields(self) -> HabitIn:
        if self.cadence_kind == "weekly" and self.weekly_target is None:
            raise ValueError("weekly_target required for cadence_kind=weekly")
        if self.cadence_kind == "monthly" and self.monthly_target is None:
            raise ValueError("monthly_target required for cadence_kind=monthly")
        if self.cadence_kind == "interval" and self.interval_days is None:
            raise ValueError("interval_days required for cadence_kind=interval")
        return self


class HabitOut(BaseModel):
    id: uuid.UUID
    name: str
    icon_kind: IconKind
    icon_key: str | None
    cadence_kind: CadenceKind
    weekly_target: int | None
    monthly_target: int | None
    interval_days: int | None
    sort_order: int


class HabitStatusOut(BaseModel):
    status: HabitStatus
    done_today: bool
    last_checked_on: date | None
    # Weekly-only:
    period_count: int | None = None
    period_target: int | None = None
    period_ends_on: date | None = None
    # Interval-only:
    days_since_last: int | None = None
    days_until_due: int | None = None  # 0 = today, negative = overdue
    # Streak (consecutive periods met):
    streak: int = 0


class HabitWithStatusOut(BaseModel):
    habit: HabitOut
    status: HabitStatusOut


class HabitCheckinOut(BaseModel):
    id: int
    habit_id: uuid.UUID
    occurred_on: date
    note: str | None = None
