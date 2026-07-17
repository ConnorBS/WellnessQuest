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
async def test_add_and_list_period(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/period",
        headers=_auth(access),
        json={
            "entry_date": "2026-07-10",
            "flow": "medium",
            "symptoms": ["cramps", "fatigue"],
            "note": "day 1",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["flow"] == "medium"
    assert sorted(body["symptoms"]) == ["cramps", "fatigue"]

    r = await client.get("/api/v1/period", headers=_auth(access))
    assert r.status_code == 200
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_upsert_is_idempotent_by_date(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    await client.post(
        "/api/v1/period",
        headers=_auth(access),
        json={"entry_date": "2026-07-10", "flow": "light", "symptoms": []},
    )
    # Same date again → updates the existing row, not a second row.
    r = await client.post(
        "/api/v1/period",
        headers=_auth(access),
        json={"entry_date": "2026-07-10", "flow": "heavy", "symptoms": ["cramps"]},
    )
    assert r.status_code == 201
    assert r.json()["flow"] == "heavy"

    rows = (await client.get("/api/v1/period", headers=_auth(access))).json()
    assert len(rows) == 1
    assert rows[0]["flow"] == "heavy"
    assert rows[0]["symptoms"] == ["cramps"]


@pytest.mark.asyncio
async def test_invalid_flow_and_symptom_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/period",
        headers=_auth(access),
        json={"entry_date": "2026-07-10", "flow": "torrential", "symptoms": []},
    )
    assert r.status_code == 422

    r = await client.post(
        "/api/v1/period",
        headers=_auth(access),
        json={"entry_date": "2026-07-10", "flow": "light", "symptoms": ["sneezing"]},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_delete_period(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    created = (
        await client.post(
            "/api/v1/period",
            headers=_auth(access),
            json={"entry_date": "2026-07-10", "flow": "spotting", "symptoms": []},
        )
    ).json()
    eid = created["id"]

    r = await client.delete(f"/api/v1/period/{eid}", headers=_auth(access))
    assert r.status_code == 204
    r = await client.delete(f"/api/v1/period/{eid}", headers=_auth(access))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_period_feature_registered(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["features"]["period"] is True
