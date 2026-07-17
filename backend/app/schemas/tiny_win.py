from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class TinyWinItemIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)


class TinyWinItemOut(BaseModel):
    id: int
    label: str
    sort_order: int
    done: bool


class TinyWinReorderIn(BaseModel):
    ids: list[int]


class TinyWinDayCount(BaseModel):
    entry_date: date
    done: int
