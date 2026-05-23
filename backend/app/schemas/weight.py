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
    # Closest entry at least 7 days before `latest` — used to render a
    # "down/up X over a week" line on the dashboard card.
    prior_week: WeightEntryOut | None
    delta_kg: Decimal | None
    # Current target (latest weight_targets row). None if user never set one
    # OR if the latest row explicitly cleared the target (target_kg = NULL).
    current_target: WeightTargetOut | None = None
