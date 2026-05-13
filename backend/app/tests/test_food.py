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
async def test_food_add_and_today(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/food/today", headers=_auth(access))
    assert r.status_code == 200
    body = r.json()
    assert body["total_kcal"] == 0
    assert body["target_kcal"] == 2000
    assert body["over_target"] is False
    assert body["remaining_kcal"] == 2000

    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={
            "name": "Banana",
            "kcal": 105,
            "protein_g": 1.3,
            "carbs_g": 27,
            "fat_g": 0.3,
            "meal_type": "snack",
            "client_id": "f1",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["total_kcal"] == 105
    assert body["over_target"] is False
    assert body["xp_delta"] == 1  # one entry, one XP

    # Idempotent on same client_id
    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={"name": "Banana", "kcal": 105, "client_id": "f1"},
    )
    assert r.status_code == 201
    assert r.json()["total_kcal"] == 105

    r = await client.get("/api/v1/food/today", headers=_auth(access))
    body = r.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["name"] == "Banana"
    assert body["entries"][0]["meal_type"] == "snack"
    assert float(body["macros"]["protein_g"]) == pytest.approx(1.3)


@pytest.mark.asyncio
async def test_food_target_exceeded_transition(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Lower the ceiling to make the test cheap.
    r = await client.patch(
        "/api/v1/food/goal", headers=_auth(access), json={"target_kcal": 500}
    )
    assert r.status_code == 200
    assert r.json()["target_kcal"] == 500

    # Stay under
    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={"name": "Apple", "kcal": 400, "client_id": "u1"},
    )
    assert r.status_code == 201
    assert r.json()["over_target"] is False

    # Cross over
    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={"name": "Cookie", "kcal": 200, "client_id": "u2"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["over_target"] is True
    assert body["total_kcal"] == 600


@pytest.mark.asyncio
async def test_food_rejects_invalid(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food", headers=_auth(access), json={"name": "x", "kcal": -1}
    )
    assert r.status_code == 422

    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={"name": "x", "kcal": 100, "meal_type": "elevenses"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_food_xp_cap(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    granted = 0
    for i in range(8):
        r = await client.post(
            "/api/v1/food",
            headers=_auth(access),
            json={"name": "Snack", "kcal": 50, "client_id": f"f{i}"},
        )
        assert r.status_code == 201
        granted += r.json()["xp_delta"]
    assert granted == 5  # FOOD_DAILY_CAP


@pytest.mark.asyncio
async def test_food_barcode_rejects_garbage(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/food/barcode/not-a-number", headers=_auth(access))
    assert r.status_code == 400
    r = await client.get("/api/v1/food/barcode/123", headers=_auth(access))  # too short
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_food_presets_crud(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/food/presets", headers=_auth(access))
    assert r.status_code == 200
    assert r.json() == []

    r = await client.post(
        "/api/v1/food/presets",
        headers=_auth(access),
        json={"label": "Coffee", "kcal": 5, "meal_type": "breakfast"},
    )
    assert r.status_code == 201
    preset = r.json()
    assert preset["label"] == "Coffee"
    assert preset["meal_type"] == "breakfast"

    r = await client.patch(
        f"/api/v1/food/presets/{preset['id']}",
        headers=_auth(access),
        json={"label": "Coffee w/ milk", "kcal": 30, "meal_type": "breakfast"},
    )
    assert r.status_code == 200
    assert r.json()["kcal"] == 30

    r = await client.delete(
        f"/api/v1/food/presets/{preset['id']}", headers=_auth(access)
    )
    assert r.status_code == 204
