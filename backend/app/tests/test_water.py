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


@pytest.mark.asyncio
async def test_water_patch_updates_fields(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/water",
        headers=_auth(access),
        json={"ml": 250, "client_id": "k1", "name": "Glass"},
    )
    entry_id = r.json()["entry"]["id"]

    r = await client.patch(
        f"/api/v1/water/{entry_id}",
        headers=_auth(access),
        json={"ml": 500, "name": "Bottle", "occurred_at": "2026-05-22T07:30:00Z"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ml"] == 500
    assert body["name"] == "Bottle"
    assert body["occurred_at"].startswith("2026-05-22T07:30:00")
    # source and client_id are unchanged (and intentionally not patchable)
    assert body["source"] == "pwa"
    assert body["client_id"] == "k1"


@pytest.mark.asyncio
async def test_water_patch_does_not_regrant_xp(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/water",
        headers=_auth(access),
        json={"ml": 250, "client_id": "k1"},
    )
    entry_id = r.json()["entry"]["id"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    xp_before = r.json()["xp_total"]

    # Edit ml upward — no extra XP should be granted on edit (passthrough).
    r = await client.patch(
        f"/api/v1/water/{entry_id}",
        headers=_auth(access),
        json={"ml": 1000},
    )
    assert r.status_code == 200
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["xp_total"] == xp_before


@pytest.mark.asyncio
async def test_water_patch_other_users_entry_returns_404(client, db, unique_email):
    user_a = await _signup(client, db, unique_email)
    email_b = f"u-other-{unique_email.split('-', 1)[1]}"
    user_b = await _signup(client, db, email_b)

    r = await client.post(
        "/api/v1/water",
        headers=_auth(user_a["tokens"]["access_token"]),
        json={"ml": 250, "client_id": "k1"},
    )
    entry_id = r.json()["entry"]["id"]

    r = await client.patch(
        f"/api/v1/water/{entry_id}",
        headers=_auth(user_b["tokens"]["access_token"]),
        json={"ml": 500},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_water_goal_patch_still_matches_first(client, db, unique_email):
    """Sanity check: PATCH /water/goal still routes to the goal handler, not
    the new entry handler — the path literal is declared first."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.patch(
        "/api/v1/water/goal",
        headers=_auth(access),
        json={"target_ml": 3000},
    )
    assert r.status_code == 200
    assert r.json()["target_ml"] == 3000
