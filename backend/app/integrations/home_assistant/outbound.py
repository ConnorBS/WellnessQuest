from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import IntegrationChannel, channels
from app.integrations.home_assistant.schemas import (
    HomeAssistantConfig,
    HomeAssistantSecrets,
)


@channels.register
class HomeAssistantChannel(IntegrationChannel):
    kind = "home_assistant"
    label = "Home Assistant"
    config_schema = HomeAssistantConfig
    secrets_schema = HomeAssistantSecrets

    async def emit(self, event: str, payload: dict[str, Any]) -> tuple[int, str]:
        webhook_id = self.config.get("webhook_id")
        if not webhook_id:
            raise ValueError("home_assistant integration has no webhook_id configured")
        base_url = str(self.config["base_url"]).rstrip("/")
        url = f"{base_url}/api/webhook/{webhook_id}"
        body = {"event": event, **payload}
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json=body)
            return resp.status_code, resp.text[:512]
