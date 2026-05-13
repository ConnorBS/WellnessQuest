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
