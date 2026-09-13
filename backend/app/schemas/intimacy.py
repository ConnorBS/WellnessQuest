from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.intimacy_entry import (
    INTIMACY_KINDS,
    INTIMACY_NOTE_MAX,
    INTIMACY_TAGS,
    PROTECTION_VALUES,
)

IntimacyKind = Literal["partnered", "solo"]
ProtectionValue = Literal["protected", "unprotected", "withdrawal", "unspecified"]
IntimacyTag = Literal[
    "orgasm",
    "no_orgasm",
    "high_drive",
    "low_drive",
    "painful",
    "toys",
    "fantasies",
    "bleeding",
]

# Keep the typed literals from drifting from the model vocabulary.
assert set(INTIMACY_KINDS) == set(IntimacyKind.__args__)  # type: ignore[attr-defined]
assert set(PROTECTION_VALUES) == set(ProtectionValue.__args__)  # type: ignore[attr-defined]
assert set(INTIMACY_TAGS) == set(IntimacyTag.__args__)  # type: ignore[attr-defined]


class IntimacyEntryIn(BaseModel):
    entry_date: date | None = None
    kind: IntimacyKind = "partnered"
    protection: ProtectionValue = "unspecified"
    tags: list[IntimacyTag] = Field(default_factory=list)
    note: str | None = Field(default=None, max_length=INTIMACY_NOTE_MAX)


class IntimacyEntryPatch(BaseModel):
    """Every field optional; only what is supplied changes. `note` is the one
    field a null actually clears — there is no "unset" kind or protection."""

    entry_date: date | None = None
    kind: IntimacyKind | None = None
    protection: ProtectionValue | None = None
    tags: list[IntimacyTag] | None = None
    note: str | None = Field(default=None, max_length=INTIMACY_NOTE_MAX)


class IntimacyEntryOut(BaseModel):
    id: int
    entry_date: date
    kind: str
    protection: str
    tags: list[str]
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class IntimacySummaryOut(BaseModel):
    """Counts only — enough for the section header without listing anything."""

    days: int
    count: int
    last_entry_date: date | None = None
