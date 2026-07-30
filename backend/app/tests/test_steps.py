from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.auth.passwords import hash_password
from app.models.streak import Streak
from app.models.user import User
from app.services.user_bootstrap import bootstrap_user_assets


async def _signup(client, db, email: str) -> str:
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
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_manual_steps_add_and_list(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    r = await client.get("/api/v1/steps/today", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["total"] == 0
    assert r.json()["entries"] == []

    r = await client.post(
        "/api/v1/steps",
        headers=_auth(access),
        json={"count": 3000, "client_id": "s1"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["total"] == 3000
    assert body["entry"]["source"] == "pwa"
    assert body["xp_delta"] >= 6  # floor(3000 / 500)

    r = await client.get("/api/v1/steps/today", headers=_auth(access))
    assert r.json()["total"] == 3000
    entries = r.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["count"] == 3000
    assert entries[0]["source"] == "pwa"


@pytest.mark.asyncio
async def test_manual_steps_are_idempotent_per_client_id(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    for _ in range(2):
        r = await client.post(
            "/api/v1/steps",
            headers=_auth(access),
            json={"count": 1200, "client_id": "dupe"},
        )
        assert r.status_code == 201, r.text

    r = await client.get("/api/v1/steps/today", headers=_auth(access))
    assert r.json()["total"] == 1200
    assert len(r.json()["entries"]) == 1


@pytest.mark.asyncio
async def test_manual_steps_delete(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    r = await client.post(
        "/api/v1/steps", headers=_auth(access), json={"count": 900, "client_id": "d1"}
    )
    entry_id = r.json()["entry"]["id"]

    r = await client.delete(f"/api/v1/steps/{entry_id}", headers=_auth(access))
    assert r.status_code == 204

    r = await client.get("/api/v1/steps/today", headers=_auth(access))
    assert r.json()["total"] == 0

    r = await client.delete(f"/api/v1/steps/{entry_id}", headers=_auth(access))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_backdated_steps_land_on_their_own_day(client, db, unique_email):
    """A back-filled entry must not inflate today's total or streak."""
    access = await _signup(client, db, unique_email)

    two_days_ago = datetime.now(tz=UTC) - timedelta(days=2)
    r = await client.post(
        "/api/v1/steps",
        headers=_auth(access),
        json={
            "count": 9000,  # over the 8000 default goal
            "client_id": "old",
            "occurred_at": two_days_ago.isoformat(),
        },
    )
    assert r.status_code == 201, r.text
    # Totals are reported for the entry's own day, not for today.
    assert r.json()["total"] == 9000

    today = await client.get("/api/v1/steps/today", headers=_auth(access))
    assert today.json()["total"] == 0

    past_day = two_days_ago.date().isoformat()
    r = await client.get(f"/api/v1/steps/today?date={past_day}", headers=_auth(access))
    assert r.json()["total"] == 9000

    # No streak was started for a day that isn't today.
    await db.rollback()  # fresh snapshot; the API committed on its own session
    streak = (
        await db.execute(select(Streak).where(Streak.metric == "steps"))
    ).scalar_one_or_none()
    assert streak is None or streak.current_len == 0


@pytest.mark.asyncio
async def test_steps_goal_met_grants_bonus_once(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    first = await client.post(
        "/api/v1/steps", headers=_auth(access), json={"count": 9000, "client_id": "g1"}
    )
    assert first.json()["goal_met"] is True

    second = await client.post(
        "/api/v1/steps", headers=_auth(access), json={"count": 500, "client_id": "g2"}
    )
    assert second.json()["goal_met"] is True
    # The +50 crossing bonus fires once; the second log is step XP only.
    assert second.json()["xp_delta"] < 50


@pytest.mark.asyncio
async def test_steps_rejects_nonsense_counts(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    for count in (0, -5, 500_000):
        r = await client.post(
            "/api/v1/steps", headers=_auth(access), json={"count": count}
        )
        assert r.status_code == 422, count
