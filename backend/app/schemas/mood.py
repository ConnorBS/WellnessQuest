from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

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


def _dedupe(moods: list[str] | None) -> list[str] | None:
    # Keep first-seen order — the first feeling is the strongest.
    return list(dict.fromkeys(moods)) if moods is not None else None


class MoodEntryIn(BaseModel):
    # Ordered, strongest first. ``mood`` is the pre-multi-select single field,
    # still accepted so older clients / API tokens keep working.
    moods: list[MoodValue] | None = Field(default=None, min_length=1)
    mood: MoodValue | None = None
    energy: int = Field(..., ge=1, le=3)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)

    _dedupe_moods = field_validator("moods")(_dedupe)

    @model_validator(mode="after")
    def _fold_legacy_mood(self) -> MoodEntryIn:
        if self.moods is None:
            if self.mood is None:
                raise ValueError("moods is required")
            self.moods = [self.mood]
        return self


class MoodEntryOut(BaseModel):
    id: int
    moods: list[str]
    # Strongest feeling (``moods[0]``), kept for clients that predate ``moods``.
    mood: str
    energy: int
    occurred_at: datetime
    note: str | None = None


class MoodEntryPatch(BaseModel):
    moods: list[MoodValue] | None = Field(default=None, min_length=1)
    energy: int | None = Field(default=None, ge=1, le=3)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)

    _dedupe_moods = field_validator("moods")(_dedupe)


class MoodSummaryOut(BaseModel):
    latest: MoodEntryOut | None
    today_count: int
