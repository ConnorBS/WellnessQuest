from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.pain_entry import BODY_REGIONS
from app.models.symptom_log import SEVERITY_VALUES

Severity = Literal["none", "mild", "moderate", "severe"]
RegionKey = Literal[
    "head",
    "neck",
    "left_shoulder",
    "right_shoulder",
    "chest",
    "upper_back",
    "lower_back",
    "abdomen",
    "left_arm",
    "right_arm",
    "left_hand",
    "right_hand",
    "hip",
    "left_leg",
    "right_leg",
    "left_knee",
    "right_knee",
    "left_foot",
    "right_foot",
]

# Guard the typed literals against the model vocabularies drifting.
assert set(SEVERITY_VALUES) == set(Severity.__args__)  # type: ignore[attr-defined]
assert set(BODY_REGIONS) == set(RegionKey.__args__)  # type: ignore[attr-defined]


# --- symptom catalog -------------------------------------------------------

class SymptomCatalogIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class SymptomCatalogPatch(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class SymptomCatalogOut(BaseModel):
    id: int
    name: str
    sort_order: int


class SymptomReorderIn(BaseModel):
    ids: list[int]


# --- pain entries ----------------------------------------------------------

class SymptomLogIn(BaseModel):
    catalog_id: int
    severity: Severity
    duration_minutes: int | None = Field(default=None, ge=0, le=10080)


class SymptomLogOut(BaseModel):
    id: int
    catalog_id: int
    name: str
    severity: str
    duration_minutes: int | None = None


class PainEntryIn(BaseModel):
    pain_level: int = Field(..., ge=0, le=10)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)
    locations: list[RegionKey] = Field(default_factory=list)
    symptoms: list[SymptomLogIn] = Field(default_factory=list)


class PainEntryOut(BaseModel):
    id: int
    pain_level: int
    occurred_at: datetime
    note: str | None = None
    locations: list[str]
    symptoms: list[SymptomLogOut]


class PainSummaryOut(BaseModel):
    latest: PainEntryOut | None
