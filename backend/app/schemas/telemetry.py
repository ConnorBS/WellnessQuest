from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class TelemetryEvent(BaseModel):
    level: Literal["info", "warning", "error"] = "info"
    message: str = Field(..., min_length=1, max_length=2000)
    stack: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class TelemetryBatchIn(BaseModel):
    events: list[TelemetryEvent] = Field(..., max_length=100)


class TelemetryBatchOut(BaseModel):
    accepted: int
