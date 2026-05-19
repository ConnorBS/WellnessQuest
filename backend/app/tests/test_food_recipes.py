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


def _scrambled_eggs_recipe() -> dict:
    return {
        "label": "My scrambled eggs",
        "yields_servings": 1,
        "serving_label": "1 bowl",
        "meal_type": "breakfast",
        "sort_order": 0,
        "ingredients": [
            {
                "name": "Large egg",
                "provider": "openfoodfacts",
                "provider_id": "1234567890",
                "quantity": 2,
                "unit": "serving",
                "serving_g": 50,
                "serving_label": "1 large egg",
                "kcal": 144,  # 2 × 72
                "protein_g": 12,
                "carbs_g": 0.4,
                "fat_g": 10,
                "nutrients": {"cholesterol_mg": 372, "sodium_mg": 142},
            },
            {
                "name": "Mayonnaise",
                "quantity": 15,
                "unit": "g",
                "kcal": 100,
                "protein_g": 0.2,
                "fat_g": 11,
                "nutrients": {"sodium_mg": 90},
            },
            {
                "name": "Salt",
                "quantity": 1,
                "unit": "g",
                "kcal": 0,
                "nutrients": {"sodium_mg": 388},
            },
        ],
    }


@pytest.mark.asyncio
async def test_recipe_create_aggregates_totals(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json=_scrambled_eggs_recipe(),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["label"] == "My scrambled eggs"
    # 144 + 100 + 0 = 244
    assert body["total_kcal"] == 244
    # 12 + 0.2 + 0 = 12.2 (Decimal rendered as string)
    assert float(body["total_protein_g"]) == pytest.approx(12.2)
    # 10 + 11 + 0 = 21.0
    assert float(body["total_fat_g"]) == pytest.approx(21.0)
    # 0.4 + 0 + 0 = 0.4 — only egg has carbs
    assert float(body["total_carbs_g"]) == pytest.approx(0.4)
    # sodium: 142 + 90 + 388 = 620, cholesterol: 372 (only egg has it)
    assert body["total_nutrients"]["sodium_mg"] == pytest.approx(620)
    assert body["total_nutrients"]["cholesterol_mg"] == pytest.approx(372)
    assert len(body["ingredients"]) == 3
    # Positions are dense and starting from 0.
    assert [i["position"] for i in body["ingredients"]] == [0, 1, 2]


@pytest.mark.asyncio
async def test_recipe_list_and_get(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/food/recipes", headers=_auth(access))
    assert r.status_code == 200
    assert r.json() == []

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json=_scrambled_eggs_recipe(),
    )
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = await client.get("/api/v1/food/recipes", headers=_auth(access))
    body = r.json()
    assert len(body) == 1
    # List endpoint omits ingredients to keep payload small.
    assert "ingredients" not in body[0]
    assert body[0]["total_kcal"] == 244

    r = await client.get(f"/api/v1/food/recipes/{recipe_id}", headers=_auth(access))
    body = r.json()
    assert len(body["ingredients"]) == 3


@pytest.mark.asyncio
async def test_recipe_update_replaces_ingredients(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json=_scrambled_eggs_recipe(),
    )
    recipe_id = r.json()["id"]

    # Replace with a single-ingredient recipe.
    updated = {
        "label": "Just toast",
        "yields_servings": 1,
        "ingredients": [
            {
                "name": "White toast",
                "quantity": 1,
                "unit": "serving",
                "serving_g": 30,
                "kcal": 80,
                "protein_g": 3,
            }
        ],
    }
    r = await client.patch(
        f"/api/v1/food/recipes/{recipe_id}",
        headers=_auth(access),
        json=updated,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["label"] == "Just toast"
    assert body["total_kcal"] == 80
    assert len(body["ingredients"]) == 1
    # The old ingredients (eggs, mayo, salt) are gone.
    assert body["ingredients"][0]["name"] == "White toast"
    # Cholesterol from the previous version must be cleared too.
    assert body["total_nutrients"] is None or "cholesterol_mg" not in (
        body["total_nutrients"] or {}
    )


@pytest.mark.asyncio
async def test_recipe_log_writes_food_entry(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json={**_scrambled_eggs_recipe(), "yields_servings": 2},
    )
    recipe_id = r.json()["id"]

    # Log half a serving of a 2-serving recipe => factor 0.25 => 244*0.25 = 61
    r = await client.post(
        f"/api/v1/food/recipes/{recipe_id}/log",
        headers=_auth(access),
        json={"servings": 0.5, "client_id": "rec-1"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["entry"]["kcal"] == 61
    assert body["entry"]["name"] == "My scrambled eggs"
    assert body["entry"]["provider"] == "recipe"
    assert body["entry"]["provider_id"] == recipe_id
    assert body["entry"]["meal_type"] == "breakfast"  # inherited from recipe
    # XP still flows through food_service.add — 1 XP per food log.
    assert body["xp_delta"] == 1
    # Day total includes the entry.
    assert body["total_kcal"] == 61

    # /food/today should show the recipe-log as a normal entry.
    r = await client.get("/api/v1/food/today", headers=_auth(access))
    body = r.json()
    assert body["total_kcal"] == 61
    assert len(body["entries"]) == 1
    assert body["entries"][0]["provider"] == "recipe"


@pytest.mark.asyncio
async def test_recipe_log_idempotent_on_client_id(client, db, unique_email):
    """Re-posting with the same client_id MUST return the same entry, not
    a second one. Same contract as plain /food."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json=_scrambled_eggs_recipe(),
    )
    recipe_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/food/recipes/{recipe_id}/log",
        headers=_auth(access),
        json={"servings": 1, "client_id": "dedup"},
    )
    first_kcal = r.json()["total_kcal"]
    assert r.json()["xp_delta"] == 1

    # Replay
    r = await client.post(
        f"/api/v1/food/recipes/{recipe_id}/log",
        headers=_auth(access),
        json={"servings": 1, "client_id": "dedup"},
    )
    assert r.status_code == 201
    body = r.json()
    # Same totals — no second entry was created.
    assert body["total_kcal"] == first_kcal
    assert body["xp_delta"] == 0  # idempotent replay grants no XP

    r = await client.get("/api/v1/food/today", headers=_auth(access))
    assert len(r.json()["entries"]) == 1


@pytest.mark.asyncio
async def test_recipe_log_too_large_rejected(client, db, unique_email):
    """Multiplied kcal must stay <= 20000 (the food_entries CHECK). The
    service rejects pre-flight so the API returns 422 rather than 500."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json={
            "label": "Giant batch",
            "yields_servings": 1,
            "ingredients": [
                {"name": "Olive oil", "quantity": 1000, "unit": "g", "kcal": 9000},
                {"name": "Sugar", "quantity": 1000, "unit": "g", "kcal": 4000},
            ],
        },
    )
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    # 13000 × 2 = 26000 > 20000 ceiling
    r = await client.post(
        f"/api/v1/food/recipes/{recipe_id}/log",
        headers=_auth(access),
        json={"servings": 2, "client_id": "x"},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "recipe_log_too_large"


@pytest.mark.asyncio
async def test_recipe_delete_preserves_logged_entries(client, db, unique_email):
    """Logged food entries are independent snapshots. Deleting the recipe
    must NOT remove them."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json=_scrambled_eggs_recipe(),
    )
    recipe_id = r.json()["id"]

    await client.post(
        f"/api/v1/food/recipes/{recipe_id}/log",
        headers=_auth(access),
        json={"servings": 1, "client_id": "k"},
    )

    r = await client.delete(
        f"/api/v1/food/recipes/{recipe_id}", headers=_auth(access)
    )
    assert r.status_code == 204

    # Recipe gone
    r = await client.get(f"/api/v1/food/recipes/{recipe_id}", headers=_auth(access))
    assert r.status_code == 404

    # Entry still there — name and kcal preserved.
    r = await client.get("/api/v1/food/today", headers=_auth(access))
    body = r.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["name"] == "My scrambled eggs"


@pytest.mark.asyncio
async def test_recipe_ownership_isolation(client, db, unique_email):
    """User A cannot read/edit/delete user B's recipes (404)."""
    data_a = await _signup(client, db, unique_email)
    data_b = await _signup(client, db, f"other-{unique_email}")
    access_a = data_a["tokens"]["access_token"]
    access_b = data_b["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access_a),
        json=_scrambled_eggs_recipe(),
    )
    recipe_id = r.json()["id"]

    # B cannot see A's recipe in their list
    r = await client.get("/api/v1/food/recipes", headers=_auth(access_b))
    assert r.json() == []

    # B cannot GET / PATCH / DELETE / LOG A's recipe
    r = await client.get(
        f"/api/v1/food/recipes/{recipe_id}", headers=_auth(access_b)
    )
    assert r.status_code == 404
    r = await client.patch(
        f"/api/v1/food/recipes/{recipe_id}",
        headers=_auth(access_b),
        json={"label": "evil", "yields_servings": 1, "ingredients": [
            {"name": "x", "quantity": 1, "unit": "g", "kcal": 1}
        ]},
    )
    assert r.status_code == 404
    r = await client.delete(
        f"/api/v1/food/recipes/{recipe_id}", headers=_auth(access_b)
    )
    assert r.status_code == 404
    r = await client.post(
        f"/api/v1/food/recipes/{recipe_id}/log",
        headers=_auth(access_b),
        json={"servings": 1, "client_id": "x"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_recipe_rejects_empty_ingredients(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json={
            "label": "Empty",
            "yields_servings": 1,
            "ingredients": [],
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_recipe_rejects_zero_yields(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json={
            "label": "Bad yields",
            "yields_servings": 0,
            "ingredients": [
                {"name": "x", "quantity": 1, "unit": "g", "kcal": 1}
            ],
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_recipe_rejects_bad_unit(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/recipes",
        headers=_auth(access),
        json={
            "label": "x",
            "yields_servings": 1,
            "ingredients": [
                {"name": "x", "quantity": 1, "unit": "oz", "kcal": 1}
            ],
        },
    )
    assert r.status_code == 422
