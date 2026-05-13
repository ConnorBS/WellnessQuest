from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from app.telemetry.logger import get_logger

log = get_logger(__name__)

Handler = Callable[[uuid.UUID, str, dict[str, Any]], Awaitable[None]]

_handlers: list[Handler] = []


def subscribe(handler: Handler) -> None:
    _handlers.append(handler)


async def emit(user_id: uuid.UUID, event: str, payload: dict[str, Any]) -> None:
    """Fan-out to all subscribed handlers. Failures are logged, not raised."""
    if not _handlers:
        return
    results = await asyncio.gather(
        *(_safe(h, user_id, event, payload) for h in _handlers), return_exceptions=False
    )
    _ = results


async def _safe(h: Handler, user_id: uuid.UUID, event: str, payload: dict[str, Any]) -> None:
    try:
        await h(user_id, event, payload)
    except Exception as exc:  # noqa: BLE001
        log.error(
            "event_handler_failed", event_name=event, handler=h.__name__, error=str(exc)
        )
