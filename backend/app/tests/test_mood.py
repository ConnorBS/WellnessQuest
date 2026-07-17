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
async def test_add_and_list_mood(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/mood",
        headers=_auth(access),
        json={"mood": "happy", "energy": 3, "note": "good day"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mood"] == "happy"
    assert body["energy"] == 3
    assert body["note"] == "good day"

    # A second check-in same day — multiple per day are allowed.
    r2 = await client.post(
        "/api/v1/mood",
        headers=_auth(access),
        json={"mood": "tired", "energy": 1},
    )
    assert r2.status_code == 201

    r = await client.get("/api/v1/mood", headers=_auth(access))
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2


@pytest.mark.asyncio
async def test_mood_summary(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/mood/summary", headers=_auth(access))
    assert r.status_code == 200
    assert r.json() == {"latest": None, "today_count": 0}

    await client.post(
        "/api/v1/mood",
        headers=_auth(access),
        json={"mood": "calm", "energy": 2},
    )
    r = await client.get("/api/v1/mood/summary", headers=_auth(access))
    body = r.json()
    assert body["latest"]["mood"] == "calm"
    assert body["today_count"] == 1


@pytest.mark.asyncio
async def test_invalid_mood_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/mood",
        headers=_auth(access),
        json={"mood": "ecstatic", "energy": 2},
    )
    assert r.status_code == 422

    r = await client.post(
        "/api/v1/mood",
        headers=_auth(access),
        json={"mood": "happy", "energy": 9},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_and_delete_mood(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    created = (
        await client.post(
            "/api/v1/mood",
            headers=_auth(access),
            json={"mood": "sad", "energy": 1},
        )
    ).json()
    eid = created["id"]

    r = await client.patch(
        f"/api/v1/mood/{eid}",
        headers=_auth(access),
        json={"mood": "grateful", "energy": 2},
    )
    assert r.status_code == 200
    assert r.json()["mood"] == "grateful"
    assert r.json()["energy"] == 2

    r = await client.delete(f"/api/v1/mood/{eid}", headers=_auth(access))
    assert r.status_code == 204
    r = await client.delete(f"/api/v1/mood/{eid}", headers=_auth(access))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_mood_feature_registered(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["features"]["mood"] is True
