from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class WeightEntryIn(BaseModel):
    weight_kg: Decimal = Field(..., gt=Decimal("0"), lt=Decimal("1000"))
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


class WeightEntryOut(BaseModel):
    id: int
    weight_kg: Decimal
    occurred_at: datetime
    note: str | None = None


class WeightEntryPatch(BaseModel):
    """All fields optional; only provided ones are updated."""

    weight_kg: Decimal | None = Field(default=None, gt=Decimal("0"), lt=Decimal("1000"))
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


class WeightTargetIn(BaseModel):
    # None = explicit "no target as of effective_at" (clears the goal). Non-None
    # values are range-checked at the endpoint, not here, so that null can pass.
    target_kg: Decimal | None = None
    effective_at: datetime | None = None


class WeightTargetOut(BaseModel):
    id: int
    target_kg: Decimal | None
    effective_at: datetime


class WeightSummaryOut(BaseModel):
    unit: str  # "kg" | "lb"
    latest: WeightEntryOut | None
    # Closest entry at least 7 days before `latest` — kept populated for
    # backward compat with any UI / cached page still reading the raw delta.
    prior_week: WeightEntryOut | None
    delta_kg: Decimal | None
    # Current target (latest weight_targets row). None if user never set one
    # OR if the latest row explicitly cleared the target (target_kg = NULL).
    current_target: WeightTargetOut | None = None
    # Smoothed trend (EWMA per Hacker's Diet) — the headline number the
    # dashboard shows. trend_delta_kg compares trend now vs trend ~2 weeks
    # ago, NOT raw-vs-raw, so it doesn't moralize daily fluctuation.
    trend_kg: Decimal | None = None
    trend_delta_kg: Decimal | None = None
    trend_lookback_days: int = 14
    # False until the user has enough readings spanning enough time for a
    # meaningful trend; UI hides the trend line and prompts for more entries.
    trend_ready: bool = False
    # First reading on or after current target's effective_at — anchors the
    # "X% of the way to target" progress framing.
    starting_kg: Decimal | None = None


class WeightTrendPoint(BaseModel):
    occurred_at: datetime
    weight_kg: Decimal
    trend_kg: Decimal


class WeightTrendSeriesOut(BaseModel):
    unit: str
    points: list[WeightTrendPoint]
