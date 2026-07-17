from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.mood_entry import MOOD_VALUES

# A typed alias so FastAPI returns 422 on an unknown mood.
MoodValue = Literal[
    "happy",
    "calm",
    "excited",
    "motivated",
    "relaxed",
    "grateful",
    "productive",
    "tired",
    "sad",
    "stressed",
    "anxious",
    "overwhelmed",
    "frustrated",
    "low_energy",
    "angry",
]

# Guard against the Literal above drifting from the model's CHECK vocabulary.
assert set(MOOD_VALUES) == set(MoodValue.__args__)  # type: ignore[attr-defined]


class MoodEntryIn(BaseModel):
    mood: MoodValue
    energy: int = Field(..., ge=1, le=3)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


class MoodEntryOut(BaseModel):
    id: int
    mood: str
    energy: int
    occurred_at: datetime
    note: str | None = None


class MoodEntryPatch(BaseModel):
    mood: MoodValue | None = None
    energy: int | None = Field(default=None, ge=1, le=3)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


class MoodSummaryOut(BaseModel):
    latest: MoodEntryOut | None
    today_count: int
