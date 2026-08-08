from __future__ import annotations

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.services.blood_pressure_categories import BPCategory, classify
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
async def test_add_entry_returns_201_and_persists(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 120, "diastolic": 80, "pulse": 72},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["systolic"] == 120
    assert body["diastolic"] == 80
    assert body["pulse"] == 72

    r = await client.get("/api/v1/blood-pressure", headers=_auth(access))
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["systolic"] == 120


@pytest.mark.asyncio
async def test_add_entry_optional_pulse_and_note(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 118, "diastolic": 76, "note": "after coffee"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["pulse"] is None
    assert body["note"] == "after coffee"


@pytest.mark.asyncio
async def test_rejects_systolic_le_diastolic(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 110, "diastolic": 120},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_rejects_out_of_range(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 0, "diastolic": 80},
    )
    assert r.status_code == 422

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 350, "diastolic": 200},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_delete_entry(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 130, "diastolic": 82},
    )
    entry_id = r.json()["id"]

    r = await client.delete(
        f"/api/v1/blood-pressure/{entry_id}", headers=_auth(access)
    )
    assert r.status_code == 204

    r = await client.delete(
        f"/api/v1/blood-pressure/{entry_id}", headers=_auth(access)
    )
    assert r.status_code == 404

    r = await client.get("/api/v1/blood-pressure", headers=_auth(access))
    assert r.json() == []


@pytest.mark.asyncio
async def test_patch_entry_updates_fields(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 120, "diastolic": 80, "pulse": 72},
    )
    entry_id = r.json()["id"]

    r = await client.patch(
        f"/api/v1/blood-pressure/{entry_id}",
        headers=_auth(access),
        json={"systolic": 125, "note": "after walk", "occurred_at": "2026-05-22T08:00:00Z"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["systolic"] == 125
    assert body["diastolic"] == 80
    assert body["pulse"] == 72  # untouched
    assert body["note"] == "after walk"
    assert body["occurred_at"].startswith("2026-05-22T08:00:00")


@pytest.mark.asyncio
async def test_patch_rejects_invariant_violation(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 120, "diastolic": 80},
    )
    entry_id = r.json()["id"]

    r = await client.patch(
        f"/api/v1/blood-pressure/{entry_id}",
        headers=_auth(access),
        json={"systolic": 70},  # would make sys (70) <= dia (80)
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "systolic_must_exceed_diastolic"


@pytest.mark.asyncio
async def test_patch_other_users_entry_returns_404(client, db, unique_email):
    user_a = await _signup(client, db, unique_email)
    email_b = f"u-other-{unique_email.split('-', 1)[1]}"
    user_b = await _signup(client, db, email_b)

    r = await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(user_a["tokens"]["access_token"]),
        json={"systolic": 120, "diastolic": 80},
    )
    entry_id = r.json()["id"]

    r = await client.patch(
        f"/api/v1/blood-pressure/{entry_id}",
        headers=_auth(user_b["tokens"]["access_token"]),
        json={"systolic": 130},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_summary_returns_latest_and_target(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/blood-pressure/summary", headers=_auth(access))
    assert r.status_code == 200
    assert r.json() == {"latest": None, "current_target": None}

    await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access),
        json={"systolic": 122, "diastolic": 78},
    )
    await client.post(
        "/api/v1/blood-pressure/targets",
        headers=_auth(access),
        json={"target_systolic": 130, "target_diastolic": 80},
    )

    r = await client.get("/api/v1/blood-pressure/summary", headers=_auth(access))
    assert r.status_code == 200
    body = r.json()
    assert body["latest"]["systolic"] == 122
    assert body["current_target"]["target_systolic"] == 130
    assert body["current_target"]["target_diastolic"] == 80


@pytest.mark.asyncio
async def test_target_clear_via_null_pair(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    await client.post(
        "/api/v1/blood-pressure/targets",
        headers=_auth(access),
        json={"target_systolic": 125, "target_diastolic": 75},
    )
    r = await client.post(
        "/api/v1/blood-pressure/targets",
        headers=_auth(access),
        json={"target_systolic": None, "target_diastolic": None},
    )
    assert r.status_code == 201

    r = await client.get(
        "/api/v1/blood-pressure/targets/current", headers=_auth(access)
    )
    assert r.status_code == 200
    body = r.json()
    assert body is not None
    assert body["target_systolic"] is None
    assert body["target_diastolic"] is None


@pytest.mark.asyncio
async def test_target_rejects_single_value(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure/targets",
        headers=_auth(access),
        json={"target_systolic": 130, "target_diastolic": None},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_target_rejects_systolic_le_diastolic(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/blood-pressure/targets",
        headers=_auth(access),
        json={"target_systolic": 80, "target_diastolic": 130},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_scope_isolation(client, db, unique_email):
    user_a = await _signup(client, db, unique_email)
    access_a = user_a["tokens"]["access_token"]

    email_b = f"u-other-{unique_email.split('-', 1)[1]}"
    user_b = await _signup(client, db, email_b)
    access_b = user_b["tokens"]["access_token"]

    await client.post(
        "/api/v1/blood-pressure",
        headers=_auth(access_a),
        json={"systolic": 121, "diastolic": 79},
    )

    r = await client.get("/api/v1/blood-pressure", headers=_auth(access_b))
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_me_includes_show_bp_card(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["show_bp_card"] is True

    r = await client.patch(
        "/api/v1/me", headers=_auth(access), json={"show_bp_card": False}
    )
    assert r.status_code == 200
    assert r.json()["show_bp_card"] is False


def test_classify_parity():
    assert classify(118, 76) is BPCategory.NORMAL
    assert classify(122, 78) is BPCategory.ELEVATED
    assert classify(122, 80) is BPCategory.STAGE_1  # diastolic ≥80 wins
    assert classify(135, 80) is BPCategory.STAGE_1
    assert classify(150, 95) is BPCategory.STAGE_2
    assert classify(190, 121) is BPCategory.CRISIS
    assert classify(140, 60) is BPCategory.STAGE_2


@pytest.mark.asyncio
async def test_me_show_bp_category_defaults_true_and_patches(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["show_bp_category"] is True

    r = await client.patch(
        "/api/v1/me", headers=_auth(access), json={"show_bp_category": False}
    )
    assert r.status_code == 200
    assert r.json()["show_bp_category"] is False

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["show_bp_category"] is False
