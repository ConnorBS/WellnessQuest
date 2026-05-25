from __future__ import annotations

from typing import Any

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator


class HomeAssistantEntityMap(BaseModel):
    """Maps WQ metrics to Home Assistant entity IDs read by the pull worker."""

    steps: str | None = Field(default=None, max_length=255)
    sleep_minutes: str | None = Field(default=None, max_length=255)
    sleep_quality: str | None = Field(default=None, max_length=255)


class HomeAssistantConfig(BaseModel):
    base_url: AnyHttpUrl = Field(
        ..., description="Home Assistant base URL, e.g. http://homeassistant.local:8123"
    )
    # Only the outbound channel uses this (to build the HA webhook URL); the pull
    # worker never reads it. Optional so a pull-only setup (steps/sleep import with
    # no outbound events) can be saved without one.
    webhook_id: str | None = Field(
        default=None, min_length=8, description="HA webhook id (matches a HA automation trigger)"
    )
    entity_map: HomeAssistantEntityMap = Field(default_factory=HomeAssistantEntityMap)
    pull_interval_seconds: int = Field(default=300, ge=60, le=3600)

    @field_validator("webhook_id", mode="before")
    @classmethod
    def _blank_webhook_id_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class HomeAssistantSecrets(BaseModel):
    """Long-lived HA access token used by the WQ pull worker. Stored encrypted."""

    access_token: str | None = Field(default=None, min_length=20)
