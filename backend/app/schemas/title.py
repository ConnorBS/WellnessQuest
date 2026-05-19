from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class TitleSummary(BaseModel):
    """Minimal title payload used by /me (equipped + pending unlocks).

    `description` is included so the unlock popup can tell the user *why*
    they earned the title without a separate fetch — "Marvin's Mood" is
    meaningless until you also see "Active 5 distinct days."
    """

    id: uuid.UUID
    slug: str
    name: str
    description: str
    rarity: str
    category: str


class TitleOut(BaseModel):
    """Catalog row + per-user unlock state."""

    id: uuid.UUID
    slug: str
    name: str
    description: str
    category: str
    rarity: str
    is_secret: bool
    sort_order: int
    unlocked: bool
    unlocked_at: datetime | None
    acknowledged_at: datetime | None


class CategorySummary(BaseModel):
    category: str
    total: int
    unlocked: int


class EquipTitleIn(BaseModel):
    title_id: uuid.UUID | None
