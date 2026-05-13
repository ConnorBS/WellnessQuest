"""Background worker that pulls metric state from Home Assistant.

For each enabled Home Assistant integration row we:

1. Decrypt its `secrets.access_token`.
2. For each (metric, entity_id) in `config.entity_map`, call
   ``GET {base_url}/api/states/{entity_id}`` with the bearer token.
3. Translate the HA state into a metric write via the existing services,
   using a deterministic `client_id` so re-polling the same value collapses
   to a no-op via the ``UNIQUE(user_id, client_id)`` index.

The worker stores its bookkeeping (``last_polled_at``, ``last_steps_seen``,
``last_sleep_marker``) inside the integration's ``config`` JSONB so we don't
need an extra table. ``config`` is plaintext by design; only ``secrets`` is
Fernet-encrypted.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.db.session import async_session
from app.models.integration import Integration
from app.models.user import User
from app.security.crypto import SecretsDecryptError, decrypt_secrets
from app.services import sleep_service, steps_service
from app.services.time_utils import day_bounds_for_user, day_for_user, utcnow
from app.telemetry.logger import get_logger

log = get_logger(__name__)

LOOP_INTERVAL_SECONDS = 30.0
REQUEST_TIMEOUT_SECONDS = 10.0
DEFAULT_PULL_INTERVAL_SECONDS = 300

UNREADABLE_STATES = {"unknown", "unavailable", "none", ""}


def _disabled() -> bool:
    return os.environ.get("WQ_HA_PULL_DISABLED") == "1"


def _parse_ha_datetime(s: str) -> datetime:
    """HA emits ISO 8601 with either `Z` or `+00:00` suffix."""
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _parse_int_state(state: str) -> int | None:
    if state.lower() in UNREADABLE_STATES:
        return None
    try:
        return int(float(state))
    except (TypeError, ValueError):
        return None


async def _load_integration(db: AsyncSession, integration_id: uuid.UUID) -> Integration | None:
    return (
        await db.execute(select(Integration).where(Integration.id == integration_id))
    ).scalar_one_or_none()


async def _load_user(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()


async def _fetch_state(
    client: httpx.AsyncClient, base_url: str, entity_id: str
) -> dict[str, Any] | int:
    """Return the parsed JSON, or the HTTP status code if non-200."""
    url = f"{base_url.rstrip('/')}/api/states/{entity_id}"
    resp = await client.get(url)
    if resp.status_code != 200:
        return resp.status_code
    return resp.json()


async def _last_steps_seen_today(db: AsyncSession, user: User) -> int:
    """Sum of step deltas already written today (in user's local tz)."""
    from sqlalchemy import func

    from app.models.steps_entry import StepsEntry

    day = day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = select(func.coalesce(func.sum(StepsEntry.count), 0)).where(
        StepsEntry.user_id == user.id,
        StepsEntry.occurred_at >= start,
        StepsEntry.occurred_at < end,
        StepsEntry.source == "ha_pull",
    )
    return int((await db.execute(stmt)).scalar_one())


async def _handle_steps(
    db: AsyncSession,
    user: User,
    integration: Integration,
    entity_id: str,
    payload: dict[str, Any],
) -> None:
    state = payload.get("state", "")
    if not isinstance(state, str):
        return
    current = _parse_int_state(state)
    if current is None:
        log.debug("ha_pull_steps_unreadable", entity_id=entity_id, state=state)
        return
    last_changed_str = payload.get("last_changed") or payload.get("last_updated")
    if not isinstance(last_changed_str, str):
        return
    try:
        last_changed = _parse_ha_datetime(last_changed_str)
    except ValueError:
        return

    seen_today = await _last_steps_seen_today(db, user)
    # Cumulative counter -> delta. If counter reset (midnight), write current.
    if seen_today == 0:
        delta = current
    elif current >= seen_today:
        delta = current - seen_today
    else:
        # Counter reset detected; trust the new value as today's total so far.
        delta = current

    if delta <= 0:
        return

    client_id = f"ha:{entity_id}:{last_changed.isoformat()}"
    await steps_service.add(
        db,
        user=user,
        count=delta,
        source="ha_pull",
        client_id=client_id,
        occurred_at=last_changed,
    )


async def _handle_sleep(
    db: AsyncSession,
    user: User,
    integration: Integration,
    duration_entity: str,
    duration_payload: dict[str, Any],
    quality_payload: dict[str, Any] | None,
) -> None:
    state = duration_payload.get("state", "")
    if not isinstance(state, str):
        return
    duration_minutes = _parse_int_state(state)
    if duration_minutes is None or duration_minutes <= 0:
        return
    last_changed_str = duration_payload.get("last_changed") or duration_payload.get(
        "last_updated"
    )
    if not isinstance(last_changed_str, str):
        return
    try:
        last_changed = _parse_ha_datetime(last_changed_str)
    except ValueError:
        return

    quality_score: int | None = None
    if quality_payload is not None:
        q_state = quality_payload.get("state", "")
        if isinstance(q_state, str):
            qv = _parse_int_state(q_state)
            if qv is not None and 0 <= qv <= 100:
                quality_score = qv

    started_at = last_changed - timedelta(minutes=duration_minutes)
    ended_at = last_changed
    client_id = f"ha:sleep:{duration_entity}:{last_changed.isoformat()}"
    await sleep_service.add(
        db,
        user=user,
        started_at=started_at,
        ended_at=ended_at,
        source="ha_pull",
        client_id=client_id,
        quality_score=quality_score,
    )


async def _poll_one_integration(integration_id: uuid.UUID) -> None:
    async with async_session() as db:
        integration = await _load_integration(db, integration_id)
        if integration is None or not integration.enabled:
            return
        if integration.user_id is None:
            return  # account-wide rows have no user context for inbound data

        try:
            decrypted = decrypt_secrets(integration.secrets)
        except SecretsDecryptError as exc:
            log.error(
                "ha_pull_decrypt_failed",
                integration_id=str(integration.id),
                error=str(exc),
            )
            return

        token = decrypted.get("access_token")
        if not token:
            return

        config = integration.config or {}
        entity_map = config.get("entity_map") or {}
        steps_entity = entity_map.get("steps")
        sleep_minutes_entity = entity_map.get("sleep_minutes")
        sleep_quality_entity = entity_map.get("sleep_quality")

        if not any((steps_entity, sleep_minutes_entity)):
            return

        base_url = config.get("base_url")
        if not base_url:
            return

        user = await _load_user(db, integration.user_id)
        if user is None or user.disabled_at is not None:
            return

        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS, headers=headers
        ) as client:
            disabled_due_to_auth = False
            steps_payload: dict[str, Any] | None = None
            sleep_minutes_payload: dict[str, Any] | None = None
            sleep_quality_payload: dict[str, Any] | None = None

            if steps_entity:
                result = await _fetch_state(client, base_url, steps_entity)
                if isinstance(result, int):
                    if result in (401, 403):
                        disabled_due_to_auth = True
                    else:
                        log.warning(
                            "ha_pull_non_200",
                            entity_id=steps_entity,
                            status=result,
                        )
                else:
                    steps_payload = result

            if sleep_minutes_entity and not disabled_due_to_auth:
                result = await _fetch_state(client, base_url, sleep_minutes_entity)
                if isinstance(result, int):
                    if result in (401, 403):
                        disabled_due_to_auth = True
                    else:
                        log.warning(
                            "ha_pull_non_200",
                            entity_id=sleep_minutes_entity,
                            status=result,
                        )
                else:
                    sleep_minutes_payload = result

            if sleep_quality_entity and not disabled_due_to_auth:
                result = await _fetch_state(client, base_url, sleep_quality_entity)
                if isinstance(result, dict):
                    sleep_quality_payload = result

        if disabled_due_to_auth:
            integration.enabled = False
            await db.commit()
            log.error(
                "ha_pull_auth_failed_integration_disabled",
                integration_id=str(integration.id),
            )
            return

        if steps_payload is not None and steps_entity:
            try:
                await _handle_steps(db, user, integration, steps_entity, steps_payload)
            except Exception as exc:  # noqa: BLE001
                log.error("ha_pull_steps_handler_error", error=str(exc))

        if sleep_minutes_payload is not None and sleep_minutes_entity:
            try:
                await _handle_sleep(
                    db,
                    user,
                    integration,
                    sleep_minutes_entity,
                    sleep_minutes_payload,
                    sleep_quality_payload,
                )
            except Exception as exc:  # noqa: BLE001
                log.error("ha_pull_sleep_handler_error", error=str(exc))

        # Stamp last_polled_at on the config JSONB.
        integration.config = {**config, "last_polled_at": utcnow().isoformat()}
        flag_modified(integration, "config")
        await db.commit()


async def _scan_and_dispatch(tracking: set[asyncio.Task[None]]) -> None:
    async with async_session() as db:
        rows = (
            await db.execute(
                select(Integration).where(
                    Integration.kind == "home_assistant", Integration.enabled.is_(True)
                )
            )
        ).scalars().all()

    now = utcnow()
    for row in rows:
        config = row.config or {}
        interval = int(config.get("pull_interval_seconds") or DEFAULT_PULL_INTERVAL_SECONDS)
        last_str = config.get("last_polled_at")
        if last_str:
            try:
                last = datetime.fromisoformat(last_str)
                if last.tzinfo is None:
                    last = last.replace(tzinfo=UTC)
            except ValueError:
                last = None
        else:
            last = None
        if last is not None and (now - last).total_seconds() < interval:
            continue
        task = asyncio.create_task(
            _poll_one_integration(row.id), name=f"ha-pull-{row.id}"
        )
        tracking.add(task)
        task.add_done_callback(tracking.discard)


async def _loop() -> None:
    tracking: set[asyncio.Task[None]] = set()
    while True:
        if not _disabled():
            try:
                await _scan_and_dispatch(tracking)
            except Exception as exc:  # noqa: BLE001
                log.error("ha_pull_loop_error", error=str(exc))
        await asyncio.sleep(LOOP_INTERVAL_SECONDS)


def start() -> asyncio.Task[None]:
    """Start the pull loop. Return the task so lifespan can cancel it."""
    return asyncio.create_task(_loop(), name="ha-pull-worker")
