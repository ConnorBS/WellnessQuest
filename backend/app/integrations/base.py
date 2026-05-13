from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar

from pydantic import BaseModel

from app.providers.base import Registry


class IntegrationChannel(ABC):
    """An outbound channel. Configured rows in `integrations` table reference `kind`."""

    kind: ClassVar[str]
    label: ClassVar[str]
    config_schema: ClassVar[type[BaseModel]]
    secrets_schema: ClassVar[type[BaseModel] | None] = None

    def __init__(self, config: dict[str, Any], secrets: dict[str, Any] | None = None) -> None:
        self.config = self.config_schema.model_validate(config).model_dump()
        self.secrets = secrets or {}

    @abstractmethod
    async def emit(self, event: str, payload: dict[str, Any]) -> tuple[int, str]:
        """Deliver `event` with `payload`. Return (http_status, response_body)."""


channels: Registry[IntegrationChannel] = Registry()
