from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.integrations.base import IntegrationChannel, channels
from app.models.integration import Integration
from app.models.webhook import WebhookDelivery, WebhookSubscription
from app.services import events
from app.services.time_utils import utcnow
from app.telemetry.logger import get_logger

log = get_logger(__name__)

MAX_ATTEMPTS = 5
BASE_BACKOFF_SECONDS = 30


async def _enqueue(user_id: uuid.UUID, event: str, payload: dict[str, Any]) -> None:
    async with async_session() as db:
        stmt = (
            select(WebhookSubscription, Integration)
            .join(Integration, Integration.id == WebhookSubscription.integration_id)
            .where(
                WebhookSubscription.event == event,
                WebhookSubscription.active.is_(True),
                Integration.enabled.is_(True),
                or_(Integration.user_id == user_id, Integration.user_id.is_(None)),
            )
        )
        for sub, _integration in (await db.execute(stmt)).all():
            db.add(
                WebhookDelivery(
                    subscription_id=sub.id,
                    event=event,
                    payload=payload,
                    attempts=0,
                    next_retry_at=utcnow(),
                )
            )
        await db.commit()


async def _deliver_one(db: AsyncSession, delivery: WebhookDelivery) -> None:
    sub = (
        await db.execute(
            select(WebhookSubscription).where(WebhookSubscription.id == delivery.subscription_id)
        )
    ).scalar_one_or_none()
    if sub is None or not sub.active:
        delivery.delivered_at = utcnow()
        delivery.next_retry_at = None
        return

    integration = (
        await db.execute(
            select(Integration).where(Integration.id == sub.integration_id)
        )
    ).scalar_one_or_none()
    if integration is None or not integration.enabled:
        delivery.delivered_at = utcnow()
        delivery.next_retry_at = None
        return

    try:
        channel_cls: type[IntegrationChannel] = channels.get(integration.kind)
    except LookupError:
        delivery.attempts += 1
        delivery.status_code = 0
        delivery.response_body = f"unknown channel kind: {integration.kind}"
        delivery.next_retry_at = None
        return

    channel = channel_cls(integration.config, integration.secrets)
    delivery.attempts += 1
    try:
        # Subscription URL overrides config-based routing where applicable; HA uses webhook_id from config.
        status, body = await channel.emit(delivery.event, delivery.payload)
        delivery.status_code = status
        delivery.response_body = body
        if 200 <= status < 300:
            delivery.delivered_at = utcnow()
            delivery.next_retry_at = None
        else:
            _schedule_retry(delivery)
    except Exception as exc:  # noqa: BLE001
        delivery.status_code = 0
        delivery.response_body = f"{type(exc).__name__}: {exc}"
        _schedule_retry(delivery)


def _schedule_retry(delivery: WebhookDelivery) -> None:
    if delivery.attempts >= MAX_ATTEMPTS:
        delivery.next_retry_at = None  # dead-letter
        return
    delay = BASE_BACKOFF_SECONDS * (2 ** (delivery.attempts - 1))
    delivery.next_retry_at = utcnow() + timedelta(seconds=delay)


async def _drain_once() -> int:
    async with async_session() as db:
        stmt = (
            select(WebhookDelivery)
            .where(
                WebhookDelivery.delivered_at.is_(None),
                WebhookDelivery.next_retry_at.is_not(None),
                WebhookDelivery.next_retry_at <= utcnow(),
                WebhookDelivery.attempts < MAX_ATTEMPTS,
            )
            .limit(25)
        )
        deliveries = list((await db.execute(stmt)).scalars().all())
        for delivery in deliveries:
            await _deliver_one(db, delivery)
        await db.commit()
        return len(deliveries)


async def _loop(interval_seconds: float = 5.0) -> None:
    while True:
        try:
            await _drain_once()
        except Exception as exc:  # noqa: BLE001
            log.error("webhook_dispatcher_loop_error", error=str(exc))
        await asyncio.sleep(interval_seconds)


def start() -> asyncio.Task[None]:
    """Subscribe to events and start the delivery loop. Return the loop task."""
    events.subscribe(_enqueue)
    return asyncio.create_task(_loop(), name="webhook-dispatcher")
