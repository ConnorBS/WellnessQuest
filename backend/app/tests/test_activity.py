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
async def test_activity_patch_updates_fields(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/activity",
        headers=_auth(access),
        json={"minutes": 20, "client_id": "k1", "name": "Quick walk"},
    )
    assert r.status_code == 201, r.text
    entry_id = r.json()["entry"]["id"]

    r = await client.patch(
        f"/api/v1/activity/{entry_id}",
        headers=_auth(access),
        json={
            "minutes": 30,
            "exercise_type": "Walking",
            "occurred_at": "2026-05-22T07:00:00Z",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["minutes"] == 30
    assert body["name"] == "Quick walk"  # unchanged
    assert body["exercise_type"] == "Walking"
    assert body["occurred_at"].startswith("2026-05-22T07:00:00")
    assert body["source"] == "pwa"  # unchanged, not patchable
    assert body["client_id"] == "k1"  # unchanged, not patchable


@pytest.mark.asyncio
async def test_activity_patch_does_not_regrant_xp(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/activity",
        headers=_auth(access),
        json={"minutes": 10, "client_id": "k1"},
    )
    entry_id = r.json()["entry"]["id"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    xp_before = r.json()["xp_total"]

    r = await client.patch(
        f"/api/v1/activity/{entry_id}",
        headers=_auth(access),
        json={"minutes": 60},
    )
    assert r.status_code == 200
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["xp_total"] == xp_before


@pytest.mark.asyncio
async def test_activity_goal_patch_still_matches_first(client, db, unique_email):
    """Sanity check: PATCH /activity/goal still routes to the goal handler."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.patch(
        "/api/v1/activity/goal",
        headers=_auth(access),
        json={"target_minutes": 45},
    )
    assert r.status_code == 200
    assert r.json()["target_minutes"] == 45


@pytest.mark.asyncio
async def test_move_alias_serves_same_data_as_activity(client, db, unique_email):
    """The /move alias (used by the PWA to dodge ad-blockers that match the
    word "activity") and the legacy /activity prefix hit the same handlers and
    the same rows."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Log through the alias the PWA now uses.
    r = await client.post(
        "/api/v1/move",
        headers=_auth(access),
        json={"minutes": 15, "client_id": "m1", "name": "Walk around the block"},
    )
    assert r.status_code == 201, r.text

    # Both prefixes report the entry, proving they share one data path.
    via_move = await client.get("/api/v1/move/today", headers=_auth(access))
    via_activity = await client.get("/api/v1/activity/today", headers=_auth(access))
    assert via_move.status_code == 200, via_move.text
    assert via_activity.status_code == 200, via_activity.text
    assert via_move.json()["total_minutes"] == 15
    assert via_activity.json()["total_minutes"] == 15

    # Sub-resources are aliased too.
    presets = await client.get("/api/v1/move/presets", headers=_auth(access))
    assert presets.status_code == 200, presets.text
