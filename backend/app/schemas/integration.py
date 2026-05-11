from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class IntegrationCreateIn(BaseModel):
    kind: str = Field(..., min_length=1, max_length=40)
    name: str = Field(..., min_length=1, max_length=120)
    config: dict[str, Any] = Field(default_factory=dict)
    secrets: dict[str, Any] = Field(default_factory=dict)


class IntegrationOut(BaseModel):
    id: uuid.UUID
    kind: str
    name: str
    config: dict[str, Any]
    enabled: bool
    created_at: datetime


class WebhookSubscribeIn(BaseModel):
    event: str = Field(..., min_length=1, max_length=80)
    url: str = Field(..., min_length=1, max_length=2000)


class WebhookSubscriptionOut(BaseModel):
    id: uuid.UUID
    integration_id: uuid.UUID
    event: str
    url: str
    active: bool
