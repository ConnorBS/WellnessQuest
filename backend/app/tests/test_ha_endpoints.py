from __future__ import annotations

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.services.user_bootstrap import bootstrap_user_assets


async def _signup_and_token(client, db, email: str) -> tuple[str, str]:
    user = User(
        email=email,
        password_hash=hash_password("TestPassword-123!"),
        display_name="Tester",
        role="user",
        timezone="UTC",
        must_change_password=False,
    )
    db.add(user)
    await db.flush()
    await bootstrap_user_assets(db, user)
    await db.commit()
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "TestPassword-123!"},
    )
    assert r.status_code == 200, r.text
    access = r.json()["access_token"]

    r = await client.post(
        "/api/v1/api-tokens",
        headers={"Authorization": f"Bearer {access}"},
        json={"name": "HA test", "scopes": ["water:read", "water:write"]},
    )
    assert r.status_code == 201, r.text
    return access, r.json()["token"]


@pytest.mark.asyncio
async def test_ha_add_water_with_token(client, db, unique_email):
    _access, ha_token = await _signup_and_token(client, db, unique_email)

    r = await client.post(
        "/api/v1/ha/water/add",
        headers={"X-WQ-Token": ha_token},
        json={"ml": 500, "client_id": "ha-1"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["entry"]["source"] == "ha"

    r = await client.get("/api/v1/ha/water/today", headers={"X-WQ-Token": ha_token})
    assert r.status_code == 200
    assert r.json()["total_ml"] == 500


@pytest.mark.asyncio
async def test_ha_requires_token(client):
    r = await client.get("/api/v1/ha/water/today")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_ha_scope_enforced(client, db, unique_email):
    access, _ = await _signup_and_token(client, db, unique_email)

    # Create a read-only token, then try to write
    r = await client.post(
        "/api/v1/api-tokens",
        headers={"Authorization": f"Bearer {access}"},
        json={"name": "RO", "scopes": ["water:read"]},
    )
    assert r.status_code == 201
    ro_token = r.json()["token"]

    r = await client.post(
        "/api/v1/ha/water/add",
        headers={"X-WQ-Token": ro_token},
        json={"ml": 200},
    )
    assert r.status_code == 403


async def _scoped_token(client, access, name, scopes):
    r = await client.post(
        "/api/v1/api-tokens",
        headers={"Authorization": f"Bearer {access}"},
        json={"name": name, "scopes": scopes},
    )
    assert r.status_code == 201, r.text
    return r.json()["token"]


@pytest.mark.asyncio
async def test_ha_add_steps_with_token(client, db, unique_email):
    access, _ = await _signup_and_token(client, db, unique_email)
    token = await _scoped_token(client, access, "steps", ["steps:read", "steps:write"])

    r = await client.post(
        "/api/v1/ha/steps/add",
        headers={"X-WQ-Token": token},
        json={"count": 3000, "client_id": "ha-steps-1"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["entry"]["source"] == "ha"

    # Idempotent on same client_id
    r2 = await client.post(
        "/api/v1/ha/steps/add",
        headers={"X-WQ-Token": token},
        json={"count": 3000, "client_id": "ha-steps-1"},
    )
    assert r2.status_code == 201

    r3 = await client.get("/api/v1/ha/steps/today", headers={"X-WQ-Token": token})
    assert r3.status_code == 200
    assert r3.json()["total"] == 3000


@pytest.mark.asyncio
async def test_ha_steps_requires_steps_scope(client, db, unique_email):
    access, water_token = await _signup_and_token(client, db, unique_email)
    # Water-only token shouldn't be able to write steps.
    r = await client.post(
        "/api/v1/ha/steps/add",
        headers={"X-WQ-Token": water_token},
        json={"count": 1000},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_ha_add_sleep_with_token(client, db, unique_email):
    access, _ = await _signup_and_token(client, db, unique_email)
    token = await _scoped_token(client, access, "sleep", ["sleep:read", "sleep:write"])

    r = await client.post(
        "/api/v1/ha/sleep/add",
        headers={"X-WQ-Token": token},
        json={
            "started_at": "2026-05-12T23:00:00+00:00",
            "ended_at": "2026-05-13T07:00:00+00:00",
            "quality_score": 82,
            "client_id": "ha-sleep-1",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["entry"]["duration_minutes"] == 8 * 60
    assert body["entry"]["quality_score"] == 82
    assert body["goal_met"] is True  # 8h >= 7h default goal

    r2 = await client.get("/api/v1/ha/sleep/last", headers={"X-WQ-Token": token})
    assert r2.status_code == 200
    assert r2.json()["entry"]["duration_minutes"] == 8 * 60


@pytest.mark.asyncio
async def test_ha_sleep_rejects_inverted_times(client, db, unique_email):
    access, _ = await _signup_and_token(client, db, unique_email)
    token = await _scoped_token(client, access, "sleep", ["sleep:write"])
    r = await client.post(
        "/api/v1/ha/sleep/add",
        headers={"X-WQ-Token": token},
        json={
            "started_at": "2026-05-13T07:00:00+00:00",
            "ended_at": "2026-05-12T23:00:00+00:00",
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_ha_me_stats_requires_me_read(client, db, unique_email):
    access, water_token = await _signup_and_token(client, db, unique_email)
    # Water-only token: /me/stats now demands me:read.
    r = await client.get("/api/v1/ha/me/stats", headers={"X-WQ-Token": water_token})
    assert r.status_code == 403

    me_token = await _scoped_token(client, access, "me", ["me:read"])
    r2 = await client.get("/api/v1/ha/me/stats", headers={"X-WQ-Token": me_token})
    assert r2.status_code == 200
    body = r2.json()
    assert set(body.keys()) >= {
        "xp_total",
        "level",
        "streaks",
        "water_today",
        "steps_today",
        "sleep_last_night",
    }
    assert body["sleep_last_night"] is None
    assert body["water_today"]["total_ml"] == 0
    assert body["steps_today"]["total"] == 0


@pytest.mark.asyncio
async def test_api_tokens_rejects_unknown_scope(client, db, unique_email):
    access, _ = await _signup_and_token(client, db, unique_email)
    r = await client.post(
        "/api/v1/api-tokens",
        headers={"Authorization": f"Bearer {access}"},
        json={"name": "bad", "scopes": ["something:weird"]},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_api_token_create_returns_full_shape(client, db, unique_email):
    # The frontend parses the create response against the same schema as the
    # list endpoint plus `token`, so last_used_at and revoked_at must be present
    # (null) on creation or the client rejects an otherwise-successful 201.
    access, _ = await _signup_and_token(client, db, unique_email)
    r = await client.post(
        "/api/v1/api-tokens",
        headers={"Authorization": f"Bearer {access}"},
        json={"name": "shape", "scopes": ["water:read", "steps:read", "sleep:read", "me:read"]},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert set(body) >= {"id", "name", "scopes", "token", "last_used_at", "created_at", "revoked_at"}
    assert body["last_used_at"] is None
    assert body["revoked_at"] is None
