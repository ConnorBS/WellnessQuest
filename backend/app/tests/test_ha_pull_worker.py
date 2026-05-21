from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select

from app.integrations.home_assistant import pull_worker
from app.models.integration import Integration
from app.models.sleep_entry import SleepEntry
from app.models.steps_entry import StepsEntry
from app.services.time_utils import utcnow
from app.tests.test_ha_endpoints import _signup_and_token


def _mock_transport(responses: dict[str, Any]) -> httpx.MockTransport:
    """`responses` keyed by entity_id -> dict (200 JSON body) or int (status code)."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path  # /api/states/<entity_id>
        entity_id = path.rsplit("/", 1)[-1]
        body = responses.get(entity_id)
        if body is None:
            return httpx.Response(404)
        if isinstance(body, int):
            return httpx.Response(body)
        return httpx.Response(200, json=body)

    return httpx.MockTransport(handler)


async def _setup_integration(client, db, email, *, entity_map: dict[str, str]):
    access, _ha_token = await _signup_and_token(client, db, email)
    r = await client.post(
        "/api/v1/integrations",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "kind": "home_assistant",
            "name": "Home",
            "config": {
                "base_url": "http://homeassistant.local:8123",
                "webhook_id": "abcd1234efgh",
                "entity_map": entity_map,
                "pull_interval_seconds": 60,
            },
            "secrets": {"access_token": "x" * 30},
        },
    )
    assert r.status_code == 201, r.text
    integration_id = uuid.UUID(r.json()["id"])

    # Reload to capture user_id (the API stamps it server-side)
    return (
        await db.execute(select(Integration).where(Integration.id == integration_id))
    ).scalar_one()


def _patch_transport(monkeypatch, transport):
    original = httpx.AsyncClient

    class PatchedClient(original):
        def __init__(self, *args, **kwargs):
            kwargs.pop("transport", None)
            super().__init__(*args, transport=transport, **kwargs)

    monkeypatch.setattr(pull_worker.httpx, "AsyncClient", PatchedClient)


@pytest.mark.asyncio
async def test_poll_steps_writes_delta_first_time(client, db, unique_email, monkeypatch):
    integration = await _setup_integration(
        client, db, unique_email, entity_map={"steps": "sensor.steps_today"}
    )

    last_changed = (utcnow()).isoformat()
    transport = _mock_transport(
        {
            "sensor.steps_today": {
                "state": "4321",
                "last_changed": last_changed,
                "attributes": {},
            }
        }
    )
    _patch_transport(monkeypatch, transport)

    await pull_worker._poll_one_integration(integration.id)

    total = int(
        (
            await db.execute(
                select(func.coalesce(func.sum(StepsEntry.count), 0)).where(
                    StepsEntry.user_id == integration.user_id
                )
            )
        ).scalar_one()
    )
    assert total == 4321


@pytest.mark.asyncio
async def test_poll_steps_idempotent_on_repeat(client, db, unique_email, monkeypatch):
    integration = await _setup_integration(
        client, db, unique_email, entity_map={"steps": "sensor.steps_today"}
    )
    payload = {
        "state": "1000",
        "last_changed": utcnow().isoformat(),
        "attributes": {},
    }
    transport = _mock_transport({"sensor.steps_today": payload})
    _patch_transport(monkeypatch, transport)

    await pull_worker._poll_one_integration(integration.id)
    await pull_worker._poll_one_integration(integration.id)

    count = int(
        (
            await db.execute(
                select(func.count(StepsEntry.id)).where(
                    StepsEntry.user_id == integration.user_id
                )
            )
        ).scalar_one()
    )
    assert count == 1  # second poll re-used the same client_id -> no insert


@pytest.mark.asyncio
async def test_poll_steps_skips_unreadable_state(client, db, unique_email, monkeypatch):
    integration = await _setup_integration(
        client, db, unique_email, entity_map={"steps": "sensor.steps_today"}
    )
    transport = _mock_transport(
        {
            "sensor.steps_today": {
                "state": "unavailable",
                "last_changed": utcnow().isoformat(),
                "attributes": {},
            }
        }
    )
    _patch_transport(monkeypatch, transport)

    await pull_worker._poll_one_integration(integration.id)

    count = int(
        (
            await db.execute(
                select(func.count(StepsEntry.id)).where(
                    StepsEntry.user_id == integration.user_id
                )
            )
        ).scalar_one()
    )
    assert count == 0


@pytest.mark.asyncio
async def test_poll_steps_counter_reset_writes_current(client, db, unique_email, monkeypatch):
    integration = await _setup_integration(
        client, db, unique_email, entity_map={"steps": "sensor.steps_today"}
    )

    first = {
        "state": "5000",
        "last_changed": (utcnow() - timedelta(hours=1)).isoformat(),
        "attributes": {},
    }
    second = {
        "state": "200",  # counter reset, e.g. after midnight
        "last_changed": utcnow().isoformat(),
        "attributes": {},
    }

    _patch_transport(monkeypatch, _mock_transport({"sensor.steps_today": first}))
    await pull_worker._poll_one_integration(integration.id)

    _patch_transport(monkeypatch, _mock_transport({"sensor.steps_today": second}))
    await pull_worker._poll_one_integration(integration.id)

    rows = (
        await db.execute(
            select(StepsEntry).where(StepsEntry.user_id == integration.user_id).order_by(
                StepsEntry.occurred_at.asc()
            )
        )
    ).scalars().all()
    assert len(rows) == 2
    assert rows[0].count == 5000
    assert rows[1].count == 200  # treat reset as current value, not negative


@pytest.mark.asyncio
async def test_poll_401_disables_integration(client, db, unique_email, monkeypatch):
    integration = await _setup_integration(
        client, db, unique_email, entity_map={"steps": "sensor.steps_today"}
    )
    transport = _mock_transport({"sensor.steps_today": 401})
    _patch_transport(monkeypatch, transport)

    await pull_worker._poll_one_integration(integration.id)

    row = (
        await db.execute(select(Integration).where(Integration.id == integration.id))
    ).scalar_one()
    assert row.enabled is False


@pytest.mark.asyncio
async def test_poll_sleep_writes_session(client, db, unique_email, monkeypatch):
    integration = await _setup_integration(
        client,
        db,
        unique_email,
        entity_map={
            "sleep_minutes": "sensor.cpap_sleep_duration",
            "sleep_quality": "sensor.cpap_score",
        },
    )

    ended_at = utcnow()
    transport = _mock_transport(
        {
            "sensor.cpap_sleep_duration": {
                "state": "420",  # 7 hours
                "last_changed": ended_at.isoformat(),
                "attributes": {},
            },
            "sensor.cpap_score": {
                "state": "88",
                "last_changed": ended_at.isoformat(),
                "attributes": {},
            },
        }
    )
    _patch_transport(monkeypatch, transport)

    await pull_worker._poll_one_integration(integration.id)

    row = (
        await db.execute(
            select(SleepEntry).where(SleepEntry.user_id == integration.user_id)
        )
    ).scalar_one()
    assert row.duration_minutes == 420
    assert row.quality_score == 88
    assert row.source == "ha_pull"


@pytest.mark.asyncio
async def test_secrets_are_encrypted_at_rest(client, db, unique_email):
    integration = await _setup_integration(
        client, db, unique_email, entity_map={"steps": "sensor.steps_today"}
    )
    # Refresh from DB to bypass session identity map
    row = (
        await db.execute(select(Integration).where(Integration.id == integration.id))
    ).scalar_one()
    # Raw storage is the v1: ciphertext, not the plaintext access_token
    assert row.secrets["access_token"].startswith("v1:")
    assert "x" * 30 not in row.secrets["access_token"]
