from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.auth.passwords import hash_password
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


def _night(hours: float = 8, ended_ago: timedelta = timedelta(hours=2)) -> dict:
    ended = datetime.now(tz=UTC) - ended_ago
    started = ended - timedelta(hours=hours)
    return {"started_at": started.isoformat(), "ended_at": ended.isoformat()}


@pytest.mark.asyncio
async def test_manual_sleep_add_and_last(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    r = await client.get("/api/v1/sleep/last", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["entry"] is None
    assert r.json()["goal_minutes"] == 420

    r = await client.post(
        "/api/v1/sleep",
        headers=_auth(access),
        json={**_night(8), "quality_score": 80, "client_id": "n1"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["entry"]["duration_minutes"] == 480
    assert body["entry"]["source"] == "pwa"
    assert body["entry"]["quality_score"] == 80
    assert body["goal_met"] is True

    r = await client.get("/api/v1/sleep/last", headers=_auth(access))
    assert r.json()["entry"]["duration_minutes"] == 480


@pytest.mark.asyncio
async def test_manual_sleep_is_idempotent_per_client_id(client, db, unique_email):
    access = await _signup(client, db, unique_email)
    night = {**_night(7), "client_id": "same"}

    for _ in range(2):
        r = await client.post("/api/v1/sleep", headers=_auth(access), json=night)
        assert r.status_code == 201, r.text

    r = await client.get("/api/v1/sleep/recent", headers=_auth(access))
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_sleep_rejects_backwards_and_future_ranges(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    ended = datetime.now(tz=UTC) - timedelta(hours=1)
    backwards = {
        "started_at": ended.isoformat(),
        "ended_at": (ended - timedelta(hours=8)).isoformat(),
    }
    r = await client.post("/api/v1/sleep", headers=_auth(access), json=backwards)
    assert r.status_code == 422  # caught by the schema validator

    future_end = datetime.now(tz=UTC) + timedelta(hours=3)
    r = await client.post(
        "/api/v1/sleep",
        headers=_auth(access),
        json={
            "started_at": (future_end - timedelta(hours=8)).isoformat(),
            "ended_at": future_end.isoformat(),
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "future_time"


@pytest.mark.asyncio
async def test_sleep_last_can_be_scoped_to_a_day(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    await client.post(
        "/api/v1/sleep",
        headers=_auth(access),
        json={**_night(8, ended_ago=timedelta(hours=2)), "client_id": "recent"},
    )
    three_days_ago = datetime.now(tz=UTC) - timedelta(days=3)
    await client.post(
        "/api/v1/sleep",
        headers=_auth(access),
        json={
            "started_at": (three_days_ago - timedelta(hours=6)).isoformat(),
            "ended_at": three_days_ago.isoformat(),
            "client_id": "old",
        },
    )

    # Unscoped: the most recent night.
    r = await client.get("/api/v1/sleep/last", headers=_auth(access))
    assert r.json()["entry"]["duration_minutes"] == 480

    # Scoped to the older day: that night, not the recent one.
    day = three_days_ago.date().isoformat()
    r = await client.get(f"/api/v1/sleep/last?date={day}", headers=_auth(access))
    assert r.json()["entry"]["duration_minutes"] == 360

    # A day with nothing logged reports empty rather than falling back.
    empty_day = (datetime.now(tz=UTC) - timedelta(days=30)).date().isoformat()
    r = await client.get(f"/api/v1/sleep/last?date={empty_day}", headers=_auth(access))
    assert r.json()["entry"] is None


@pytest.mark.asyncio
async def test_manual_sleep_delete(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    r = await client.post(
        "/api/v1/sleep", headers=_auth(access), json={**_night(8), "client_id": "d1"}
    )
    entry_id = r.json()["entry"]["id"]

    r = await client.delete(f"/api/v1/sleep/{entry_id}", headers=_auth(access))
    assert r.status_code == 204

    r = await client.get("/api/v1/sleep/last", headers=_auth(access))
    assert r.json()["entry"] is None

    r = await client.delete(f"/api/v1/sleep/{entry_id}", headers=_auth(access))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_sleep_goal_can_be_configured(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    r = await client.get("/api/v1/sleep/last", headers=_auth(access))
    assert r.json()["goal_minutes"] == 420  # DEFAULT_SLEEP_MINUTES_PER_NIGHT

    r = await client.patch(
        "/api/v1/sleep/goal", headers=_auth(access), json={"target_minutes": 480}
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"target_minutes": 480}

    r = await client.get("/api/v1/sleep/last", headers=_auth(access))
    assert r.json()["goal_minutes"] == 480

    # A 7h night no longer meets an 8h goal.
    r = await client.post(
        "/api/v1/sleep", headers=_auth(access), json={**_night(7), "client_id": "u1"}
    )
    assert r.json()["goal_minutes"] == 480
    assert r.json()["goal_met"] is False


@pytest.mark.asyncio
async def test_sleep_goal_rejects_out_of_range(client, db, unique_email):
    access = await _signup(client, db, unique_email)

    for target in (0, -1, 1441):
        r = await client.patch(
            "/api/v1/sleep/goal", headers=_auth(access), json={"target_minutes": target}
        )
        assert r.status_code == 422, target


@pytest.mark.asyncio
async def test_sleep_entries_are_per_user(client, db, unique_email):
    mine = await _signup(client, db, unique_email)
    theirs = await _signup(client, db, f"other-{unique_email}")

    r = await client.post(
        "/api/v1/sleep", headers=_auth(mine), json={**_night(8), "client_id": "x"}
    )
    entry_id = r.json()["entry"]["id"]

    r = await client.delete(f"/api/v1/sleep/{entry_id}", headers=_auth(theirs))
    assert r.status_code == 404

    r = await client.get("/api/v1/sleep/recent", headers=_auth(theirs))
    assert r.json() == []
