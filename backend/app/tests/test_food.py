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


@pytest.mark.asyncio
async def test_food_servings_and_nutrients_roundtrip(client, db, unique_email):
    """A log POST that includes servings/serving_g/nutrients must persist
    those fields, return them on /food/today, and contribute to nutrients_total
    and dv_percent."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    payload = {
        "name": "Oatmeal Crisp",
        "brand": "Quaker",
        "kcal": 230,
        "protein_g": 6.0,
        "carbs_g": 46.0,
        "fat_g": 4.0,
        "servings": 2.0,
        "serving_g": 58.0,
        "serving_label": "1 cup",
        "nutrients": {
            "saturated_fat_g": 1.0,
            "trans_fat_g": 0.0,
            "fibre_g": 10.0,
            "sugars_g": 26.0,
            "sodium_mg": 240.0,
            "iron_mg": 15.0,
            "vit_b6_mg": 0.7,
        },
        "meal_type": "breakfast",
        "client_id": "scan-1",
    }
    r = await client.post("/api/v1/food", headers=_auth(access), json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    e = body["entry"]
    assert float(e["servings"]) == 2.0
    assert float(e["serving_g"]) == 58.0
    assert e["serving_label"] == "1 cup"
    assert e["nutrients"]["fibre_g"] == 10.0
    assert e["nutrients"]["vit_b6_mg"] == 0.7

    r = await client.get("/api/v1/food/today", headers=_auth(access))
    body = r.json()
    assert body["nutrients_total"]["fibre_g"] == 10.0
    assert body["nutrients_total"]["sodium_mg"] == 240.0
    # 10g fibre vs Health Canada DV 28g = 35.7% (rounded)
    assert body["dv_percent"]["fibre_g"] == pytest.approx(35.7, abs=0.5)
    # 240 mg sodium / 2300 mg DV ~= 10.4%
    assert body["dv_percent"]["sodium_mg"] == pytest.approx(10.4, abs=0.5)
    # kcal DV: 230 / 2000 = 11.5%
    assert body["dv_percent"]["kcal"] == pytest.approx(11.5, abs=0.5)


@pytest.mark.asyncio
async def test_food_unit_roundtrip(client, db, unique_email):
    """`unit` ('g' or 'ml') round-trips through POST /food, GET /food/today,
    PATCH /food/{id}, and POST + PATCH /food/presets. Older rows that pre-date
    the column (and any POST that omits the field) come back as `unit=None`."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Log a liquid food with unit=ml.
    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={
            "name": "1% Milk",
            "brand": "Reid's Dairy",
            "kcal": 110,
            "protein_g": 9.0,
            "carbs_g": 13.0,
            "fat_g": 2.5,
            "servings": 1.0,
            "serving_g": 250.0,
            "serving_label": "1 cup",
            "unit": "ml",
            "meal_type": "snack",
            "client_id": "milk-1",
        },
    )
    assert r.status_code == 201, r.text
    e = r.json()["entry"]
    assert e["unit"] == "ml"
    entry_id = e["id"]

    # GET /food/today preserves it.
    r = await client.get("/api/v1/food/today", headers=_auth(access))
    body = r.json()
    assert any(en["unit"] == "ml" for en in body["entries"])

    # PATCH flips to g — direct passthrough, no recomputation.
    r = await client.patch(
        f"/api/v1/food/{entry_id}",
        headers=_auth(access),
        json={"unit": "g"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["entry"]["unit"] == "g"

    # Presets carry unit too — round trip POST + PATCH.
    r = await client.post(
        "/api/v1/food/presets",
        headers=_auth(access),
        json={
            "label": "1% Milk (1 cup)",
            "kcal": 110,
            "serving_g": 250.0,
            "serving_label": "1 cup",
            "unit": "ml",
        },
    )
    assert r.status_code == 201
    preset = r.json()
    assert preset["unit"] == "ml"

    r = await client.patch(
        f"/api/v1/food/presets/{preset['id']}",
        headers=_auth(access),
        json={
            "label": "1% Milk",
            "kcal": 110,
            "serving_g": 250.0,
            "serving_label": "1 cup",
            "unit": "g",
        },
    )
    assert r.status_code == 200
    assert r.json()["unit"] == "g"

    # POST without `unit` stays null for back-compat.
    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={"name": "Apple", "kcal": 95, "client_id": "apple-1"},
    )
    assert r.status_code == 201
    assert r.json()["entry"]["unit"] is None


@pytest.mark.asyncio
async def test_food_dv_combines_saturated_and_trans(client, db, unique_email):
    """DV is computed against the COMBINED saturated+trans value per Health
    Canada — the parser sums them when the combined key isn't supplied."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={
            "name": "Margarine",
            "kcal": 100,
            "nutrients": {"saturated_fat_g": 4.0, "trans_fat_g": 2.0},
            "client_id": "sat-1",
        },
    )
    assert r.status_code == 201, r.text
    r = await client.get("/api/v1/food/today", headers=_auth(access))
    body = r.json()
    # 4 + 2 = 6g of combined sat+trans; DV is 20g → 30%
    assert body["dv_percent"]["saturated_trans_g"] == pytest.approx(30.0, abs=0.5)


@pytest.mark.asyncio
async def test_food_patch_entry(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={
            "name": "Cereal",
            "kcal": 230,
            "servings": 1.0,
            "serving_g": 58.0,
            "meal_type": "breakfast",
            "client_id": "p1",
        },
    )
    assert r.status_code == 201
    entry_id = r.json()["entry"]["id"]

    # Edit: bump to 2 servings, double kcal, change meal type
    r = await client.patch(
        f"/api/v1/food/{entry_id}",
        headers=_auth(access),
        json={"servings": 2.0, "kcal": 460, "meal_type": "lunch"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["entry"]["kcal"] == 460
    assert float(body["entry"]["servings"]) == 2.0
    assert body["entry"]["meal_type"] == "lunch"
    assert body["total_kcal"] == 460

    # PATCH against unknown id is 404
    r = await client.patch(
        "/api/v1/food/999999",
        headers=_auth(access),
        json={"kcal": 100},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_food_patch_rejects_unknown_nutrient(client, db, unique_email):
    """The NutrientPanel whitelist must reject extra keys so the JSONB blob
    doesn't accumulate typos / garbage."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food",
        headers=_auth(access),
        json={"name": "X", "kcal": 100, "client_id": "n1"},
    )
    entry_id = r.json()["entry"]["id"]

    r = await client.patch(
        f"/api/v1/food/{entry_id}",
        headers=_auth(access),
        json={"nutrients": {"unobtanium_mg": 1.0}},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_food_daily_values_endpoint(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/food/daily-values", headers=_auth(access))
    assert r.status_code == 200
    body = r.json()
    # Spot-check Health Canada Schedule K numbers used on every label.
    assert body["values"]["fibre_g"] == 28
    assert body["values"]["sodium_mg"] == 2300
    assert body["values"]["vit_d_mcg"] == 20
    assert body["meta"]["sodium_mg"]["kind"] == "limit"
    assert body["meta"]["fibre_g"]["kind"] == "encourage"
    assert body["meta"]["protein_g"]["kind"] == "macro"


@pytest.mark.asyncio
async def test_food_scan_label_returns_parsed_panel(client, db, unique_email, tmp_path):
    """The scan endpoint must accept an image and return a structured
    LabelScanOut. Tesseract may or may not be installed in test env — when
    not installed, the service returns empty raw_text with blank nutrients
    (the UI surfaces a manual fallback)."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Generate a synthetic 1x1 white PNG so the multipart upload validates.
    from PIL import Image

    img_path = tmp_path / "label.png"
    Image.new("RGB", (10, 10), color="white").save(img_path)

    with img_path.open("rb") as f:
        r = await client.post(
            "/api/v1/food/scan-label",
            headers=_auth(access),
            files={"file": ("label.png", f, "image/png")},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "raw_text" in body
    assert "nutrients" in body
    assert body["language"] in {"en", "fr", "mixed"}


@pytest.mark.asyncio
async def test_food_scan_label_rejects_non_image(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/food/scan-label",
        headers=_auth(access),
        files={"file": ("doc.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400
    assert "unsupported_content_type" in r.json()["detail"]
