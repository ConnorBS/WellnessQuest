from __future__ import annotations

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.services.user_bootstrap import bootstrap_user_assets


async def _signup(client, db, email: str) -> dict:
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
    return {"user": {"id": str(user.id), "email": email}, "tokens": r.json()}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_water_add_and_today(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/water/today", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["total_ml"] == 0

    r = await client.post(
        "/api/v1/water",
        headers=_auth(access),
        json={"ml": 250, "client_id": "k1"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["total_ml"] == 250
    assert body["xp_delta"] >= 2  # 250 ml -> floor(250/100) = 2

    # Idempotent on same client_id
    r = await client.post(
        "/api/v1/water",
        headers=_auth(access),
        json={"ml": 250, "client_id": "k1"},
    )
    assert r.status_code == 201
    assert r.json()["total_ml"] == 250


@pytest.mark.asyncio
async def test_water_goal_met_grants_xp_once(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    seen_newly_met = False
    for i in range(9):  # 9 * 250 = 2250 ml > default 2000 ml goal
        r = await client.post(
            "/api/v1/water",
            headers=_auth(access),
            json={"ml": 250, "client_id": f"k{i}"},
        )
        assert r.status_code == 201
        if r.json()["goal_met"] and not seen_newly_met:
            seen_newly_met = True

    assert seen_newly_met
    # Verify no double-credit by checking final state
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200
    # 20 daily cap + 50 goal_met = 70 max XP from water today
    assert r.json()["xp_total"] <= 70


@pytest.mark.asyncio
async def test_water_rejects_invalid_ml(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post("/api/v1/water", headers=_auth(access), json={"ml": -1})
    assert r.status_code == 422
