from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ApiTokenCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    scopes: list[str] = Field(default_factory=lambda: ["water:read", "water:write"])


class ApiTokenCreateOut(BaseModel):
    id: uuid.UUID
    name: str
    scopes: list[str]
    token: str  # raw value, shown exactly once
    created_at: datetime


class ApiTokenOut(BaseModel):
    id: uuid.UUID
    name: str
    scopes: list[str]
    last_used_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None
