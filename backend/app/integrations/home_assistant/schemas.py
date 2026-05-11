from __future__ import annotations

from pydantic import AnyHttpUrl, BaseModel, Field


class HomeAssistantConfig(BaseModel):
    base_url: AnyHttpUrl = Field(..., description="Home Assistant base URL, e.g. http://homeassistant.local:8123")
    webhook_id: str = Field(..., min_length=8, description="HA webhook id (matches a HA automation trigger)")
