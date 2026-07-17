from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.auth.passwords import hash_password
from app.models.tiny_win_item import DEFAULT_TINY_WINS
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
async def test_items_seeded_and_undone(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/tiny-wins", headers=_auth(access))
    assert r.status_code == 200
    items = r.json()
    assert [i["label"] for i in items] == list(DEFAULT_TINY_WINS)
    assert all(i["done"] is False for i in items)


@pytest.mark.asyncio
async def test_toggle_on_and_off(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    items = (await client.get("/api/v1/tiny-wins", headers=_auth(access))).json()
    iid = items[0]["id"]

    r = await client.post(f"/api/v1/tiny-wins/{iid}/toggle", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["done"] is True

    # Reflected in the day list.
    listed = (await client.get("/api/v1/tiny-wins", headers=_auth(access))).json()
    assert next(i for i in listed if i["id"] == iid)["done"] is True

    # Toggle off.
    r = await client.post(f"/api/v1/tiny-wins/{iid}/toggle", headers=_auth(access))
    assert r.json()["done"] is False


@pytest.mark.asyncio
async def test_toggle_future_date_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    items = (await client.get("/api/v1/tiny-wins", headers=_auth(access))).json()
    iid = items[0]["id"]
    future = (date.today() + timedelta(days=2)).isoformat()
    r = await client.post(
        f"/api/v1/tiny-wins/{iid}/toggle?date={future}", headers=_auth(access)
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "future_date"


@pytest.mark.asyncio
async def test_item_add_rename_archive(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    created = (
        await client.post(
            "/api/v1/tiny-wins/items", headers=_auth(access), json={"label": "Drank water"}
        )
    ).json()
    iid = created["id"]

    r = await client.patch(
        f"/api/v1/tiny-wins/items/{iid}", headers=_auth(access), json={"label": "Hydrated"}
    )
    assert r.status_code == 200
    assert r.json()["label"] == "Hydrated"

    r = await client.delete(f"/api/v1/tiny-wins/items/{iid}", headers=_auth(access))
    assert r.status_code == 204
    labels = [i["label"] for i in (await client.get("/api/v1/tiny-wins", headers=_auth(access))).json()]
    assert "Hydrated" not in labels


@pytest.mark.asyncio
async def test_counts_reflects_checkins(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    items = (await client.get("/api/v1/tiny-wins", headers=_auth(access))).json()
    await client.post(f"/api/v1/tiny-wins/{items[0]['id']}/toggle", headers=_auth(access))
    await client.post(f"/api/v1/tiny-wins/{items[1]['id']}/toggle", headers=_auth(access))

    r = await client.get("/api/v1/tiny-wins/counts", headers=_auth(access))
    assert r.status_code == 200
    counts = r.json()
    assert len(counts) == 1
    assert counts[0]["done"] == 2


@pytest.mark.asyncio
async def test_tiny_wins_feature_registered(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["features"]["tiny_wins"] is True
