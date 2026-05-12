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


class WeightSummaryOut(BaseModel):
    unit: str  # "kg" | "lb"
    latest: WeightEntryOut | None
    # Closest entry at least 7 days before `latest` — used to render a
    # "down/up X over a week" line on the dashboard card.
    prior_week: WeightEntryOut | None
    delta_kg: Decimal | None
