from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.models.period_entry import FLOW_VALUES, PERIOD_SYMPTOMS

FlowValue = Literal["spotting", "light", "medium", "heavy"]
PeriodSymptom = Literal[
    "cramps",
    "headache",
    "mood_swings",
    "bloating",
    "fatigue",
    "backache",
    "nausea",
    "tender_breasts",
    "acne",
    "cravings",
]

# Keep the typed literals from drifting from the model vocabulary.
assert set(FLOW_VALUES) == set(FlowValue.__args__)  # type: ignore[attr-defined]
assert set(PERIOD_SYMPTOMS) == set(PeriodSymptom.__args__)  # type: ignore[attr-defined]


class PeriodEntryIn(BaseModel):
    entry_date: date
    flow: FlowValue
    symptoms: list[PeriodSymptom] = Field(default_factory=list)
    note: str | None = Field(default=None, max_length=500)


class PeriodEntryOut(BaseModel):
    id: int
    entry_date: date
    flow: str
    symptoms: list[str]
    note: str | None = None
