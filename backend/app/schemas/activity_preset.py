from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field

IconKind = Literal["builtin", "upload", "none"]


class ActivityPresetIn(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    minutes: int = Field(gt=0, le=1440)
    icon_kind: IconKind = "none"
    icon_key: str | None = Field(default=None, max_length=64)
    sort_order: int = 0


class ActivityPresetOut(BaseModel):
    id: uuid.UUID
    label: str
    minutes: int
    icon_kind: IconKind
    icon_key: str | None
    sort_order: int


class ActivityGoalUpdate(BaseModel):
    target_minutes: int = Field(gt=0, le=1440)


class ActivityGoalOut(BaseModel):
    target_minutes: int
