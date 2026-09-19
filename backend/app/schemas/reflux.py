from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.reflux_entry import REFLUX_SEVERITIES, REFLUX_TRIGGERS

RefluxSeverity = Literal["mild", "moderate", "severe"]
RefluxTrigger = Literal[
    "caffeine",
    "alcohol",
    "chocolate",
    "spicy",
    "fatty_fried",
    "citrus",
    "tomato",
    "carbonated",
    "mint",
    "onion_garlic",
    "dairy",
    "large_meal",
    "late_meal",
]

# Keep the typed literals from drifting from the model vocabulary.
assert set(REFLUX_SEVERITIES) == set(RefluxSeverity.__args__)  # type: ignore[attr-defined]
assert set(REFLUX_TRIGGERS) == set(RefluxTrigger.__args__)  # type: ignore[attr-defined]


class RefluxEntryIn(BaseModel):
    severity: RefluxSeverity
    occurred_at: datetime | None = None
    triggers: list[RefluxTrigger] = Field(default_factory=list)
    note: str | None = Field(default=None, max_length=500)


class RefluxEntryPatch(BaseModel):
    """Only supplied fields change. `note` is the one field an explicit null
    clears; a null severity / time / triggers means "leave it"."""

    severity: RefluxSeverity | None = None
    occurred_at: datetime | None = None
    triggers: list[RefluxTrigger] | None = None
    note: str | None = Field(default=None, max_length=500)


class RefluxEntryOut(BaseModel):
    id: int
    severity: str
    occurred_at: datetime
    triggers: list[str]
    note: str | None = None


class RefluxSummaryOut(BaseModel):
    latest: RefluxEntryOut | None
    today_count: int
    week_count: int
