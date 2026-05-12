from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field

IconKind = Literal["builtin", "upload", "none"]


class WaterPresetIn(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    volume_ml: int = Field(gt=0, le=5000)
    icon_kind: IconKind = "none"
    icon_key: str | None = Field(default=None, max_length=64)
    sort_order: int = 0


class WaterPresetOut(BaseModel):
    id: uuid.UUID
    label: str
    volume_ml: int
    icon_kind: IconKind
    icon_key: str | None
    sort_order: int


class WaterGoalUpdate(BaseModel):
    target_ml: int = Field(gt=0, le=20000)


class WaterGoalOut(BaseModel):
    target_ml: int
