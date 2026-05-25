from __future__ import annotations

import pytest

from app.tests.test_ha_endpoints import _signup_and_token


async def _access(client, db, email: str) -> str:
    access, _token = await _signup_and_token(client, db, email)
    return access


@pytest.mark.asyncio
async def test_create_pull_only_integration_without_webhook_id(client, db, unique_email):
    """A steps/sleep import setup has no outbound webhook; webhook_id is optional."""
    access = await _access(client, db, unique_email)
    r = await client.post(
        "/api/v1/integrations",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "kind": "home_assistant",
            "name": "Home",
            "config": {
                "base_url": "http://homeassistant.local:8123",
                "entity_map": {"steps": "sensor.steps_today"},
                "pull_interval_seconds": 300,
            },
            "secrets": {"access_token": "x" * 30},
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["config"].get("webhook_id") in (None, "")


@pytest.mark.asyncio
async def test_blank_webhook_id_is_accepted_as_none(client, db, unique_email):
    """The form sends an empty string when the field is left blank; it must not 400."""
    access = await _access(client, db, unique_email)
    r = await client.post(
        "/api/v1/integrations",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "kind": "home_assistant",
            "name": "Home",
            "config": {
                "base_url": "http://homeassistant.local:8123",
                "webhook_id": "   ",
                "entity_map": {},
                "pull_interval_seconds": 300,
            },
            "secrets": {},
        },
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_too_short_webhook_id_rejected(client, db, unique_email):
    access = await _access(client, db, unique_email)
    r = await client.post(
        "/api/v1/integrations",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "kind": "home_assistant",
            "name": "Home",
            "config": {
                "base_url": "http://homeassistant.local:8123",
                "webhook_id": "short",
                "entity_map": {},
            },
            "secrets": {},
        },
    )
    assert r.status_code == 400, r.text
    assert "invalid_config" in r.json()["detail"]


@pytest.mark.asyncio
async def test_create_with_webhook_id_and_subscribe(client, db, unique_email):
    access = await _access(client, db, unique_email)
    r = await client.post(
        "/api/v1/integrations",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "kind": "home_assistant",
            "name": "Home",
            "config": {
                "base_url": "http://homeassistant.local:8123",
                "webhook_id": "abcd1234efgh",
                "entity_map": {},
            },
            "secrets": {"access_token": "x" * 30},
        },
    )
    assert r.status_code == 201, r.text
    integration_id = r.json()["id"]

    r2 = await client.post(
        f"/api/v1/integrations/{integration_id}/webhooks",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "event": "water.goal_met",
            "url": "http://homeassistant.local:8123/api/webhook/abcd1234efgh",
        },
    )
    assert r2.status_code == 201, r2.text
    assert r2.json()["event"] == "water.goal_met"
