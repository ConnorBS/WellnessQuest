from __future__ import annotations

import pytest

from app.auth.passwords import hash_password
from app.models.symptom_catalog import DEFAULT_SYMPTOMS
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
async def test_catalog_seeded_on_signup(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/pain/symptoms", headers=_auth(access))
    assert r.status_code == 200
    names = [c["name"] for c in r.json()]
    assert names == list(DEFAULT_SYMPTOMS)


@pytest.mark.asyncio
async def test_catalog_add_rename_archive(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    created = (
        await client.post(
            "/api/v1/pain/symptoms", headers=_auth(access), json={"name": "Tinnitus"}
        )
    ).json()
    cid = created["id"]

    r = await client.patch(
        f"/api/v1/pain/symptoms/{cid}", headers=_auth(access), json={"name": "Ear ringing"}
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Ear ringing"

    r = await client.delete(f"/api/v1/pain/symptoms/{cid}", headers=_auth(access))
    assert r.status_code == 204
    # Archived → no longer listed.
    names = [c["name"] for c in (await client.get("/api/v1/pain/symptoms", headers=_auth(access))).json()]
    assert "Ear ringing" not in names


@pytest.mark.asyncio
async def test_add_pain_entry_with_locations_and_symptoms(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    catalog = (await client.get("/api/v1/pain/symptoms", headers=_auth(access))).json()
    sid = catalog[0]["id"]

    r = await client.post(
        "/api/v1/pain",
        headers=_auth(access),
        json={
            "pain_level": 7,
            "note": "rough day",
            "locations": ["lower_back", "neck", "lower_back"],
            "symptoms": [{"catalog_id": sid, "severity": "moderate", "duration_minutes": 120}],
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["pain_level"] == 7
    # De-duped locations.
    assert sorted(body["locations"]) == ["lower_back", "neck"]
    assert body["symptoms"][0]["severity"] == "moderate"
    assert body["symptoms"][0]["name"] == catalog[0]["name"]
    assert body["symptoms"][0]["duration_minutes"] == 120

    # Summary reflects the latest entry.
    s = await client.get("/api/v1/pain/summary", headers=_auth(access))
    assert s.json()["latest"]["pain_level"] == 7


@pytest.mark.asyncio
async def test_add_pain_rejects_bad_inputs(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Out-of-range pain level.
    r = await client.post(
        "/api/v1/pain", headers=_auth(access), json={"pain_level": 11}
    )
    assert r.status_code == 422

    # Unknown region.
    r = await client.post(
        "/api/v1/pain",
        headers=_auth(access),
        json={"pain_level": 3, "locations": ["nose"]},
    )
    assert r.status_code == 422

    # Symptom catalog id that isn't the user's.
    r = await client.post(
        "/api/v1/pain",
        headers=_auth(access),
        json={"pain_level": 3, "symptoms": [{"catalog_id": 999999, "severity": "mild"}]},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "unknown_symptom"


@pytest.mark.asyncio
async def test_update_pain_entry(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    catalog = (await client.get("/api/v1/pain/symptoms", headers=_auth(access))).json()
    first, second = catalog[0]["id"], catalog[1]["id"]

    created = (
        await client.post(
            "/api/v1/pain",
            headers=_auth(access),
            json={
                "pain_level": 7,
                "note": "rough day",
                "locations": ["lower_back", "neck"],
                "symptoms": [{"catalog_id": first, "severity": "moderate"}],
            },
        )
    ).json()
    eid = created["id"]

    # Partial patch: only the fields sent change.
    r = await client.patch(
        f"/api/v1/pain/{eid}",
        headers=_auth(access),
        json={"pain_level": 2, "occurred_at": "2026-01-02T03:04:05Z"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["pain_level"] == 2
    assert body["occurred_at"].startswith("2026-01-02T03:04:05")
    assert body["note"] == "rough day"
    assert sorted(body["locations"]) == ["lower_back", "neck"]
    assert [s["catalog_id"] for s in body["symptoms"]] == [first]

    # Collections are replace-whole, and locations still de-dup.
    r = await client.patch(
        f"/api/v1/pain/{eid}",
        headers=_auth(access),
        json={
            "locations": ["head", "head"],
            "symptoms": [{"catalog_id": second, "severity": "severe", "duration_minutes": 30}],
            "note": "  ",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["locations"] == ["head"]
    assert body["note"] is None
    assert [(s["catalog_id"], s["severity"], s["duration_minutes"]) for s in body["symptoms"]] == [
        (second, "severe", 30)
    ]

    # Clearing both collections.
    body = (
        await client.patch(
            f"/api/v1/pain/{eid}",
            headers=_auth(access),
            json={"locations": [], "symptoms": []},
        )
    ).json()
    assert body["locations"] == []
    assert body["symptoms"] == []

    # Persisted, not just echoed back.
    listed = (await client.get("/api/v1/pain", headers=_auth(access))).json()
    assert listed[0]["pain_level"] == 2
    assert listed[0]["locations"] == []


@pytest.mark.asyncio
async def test_update_pain_rejects_bad_inputs(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    eid = (
        await client.post("/api/v1/pain", headers=_auth(access), json={"pain_level": 3})
    ).json()["id"]

    r = await client.patch(
        f"/api/v1/pain/{eid}", headers=_auth(access), json={"pain_level": 11}
    )
    assert r.status_code == 422

    r = await client.patch(
        f"/api/v1/pain/{eid}", headers=_auth(access), json={"locations": ["nose"]}
    )
    assert r.status_code == 422

    r = await client.patch(
        f"/api/v1/pain/{eid}",
        headers=_auth(access),
        json={"symptoms": [{"catalog_id": 999999, "severity": "mild"}]},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "unknown_symptom"

    r = await client.patch(
        "/api/v1/pain/999999", headers=_auth(access), json={"pain_level": 1}
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_pain_keeps_archived_symptom(client, db, unique_email):
    """Archiving a symptom must not lock the entries that already use it."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    catalog = (await client.get("/api/v1/pain/symptoms", headers=_auth(access))).json()
    sid = catalog[0]["id"]
    eid = (
        await client.post(
            "/api/v1/pain",
            headers=_auth(access),
            json={
                "pain_level": 4,
                "symptoms": [{"catalog_id": sid, "severity": "mild"}],
            },
        )
    ).json()["id"]

    assert (
        await client.delete(f"/api/v1/pain/symptoms/{sid}", headers=_auth(access))
    ).status_code == 204

    r = await client.patch(
        f"/api/v1/pain/{eid}",
        headers=_auth(access),
        json={
            "pain_level": 6,
            "symptoms": [{"catalog_id": sid, "severity": "severe"}],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["symptoms"][0]["severity"] == "severe"


@pytest.mark.asyncio
async def test_update_pain_scoped_to_owner(client, db, unique_email):
    owner = await _signup(client, db, unique_email)
    other = await _signup(client, db, f"other-{unique_email}")
    eid = (
        await client.post(
            "/api/v1/pain",
            headers=_auth(owner["tokens"]["access_token"]),
            json={"pain_level": 3},
        )
    ).json()["id"]

    r = await client.patch(
        f"/api/v1/pain/{eid}",
        headers=_auth(other["tokens"]["access_token"]),
        json={"pain_level": 9},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_pain_entry_cascades(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    catalog = (await client.get("/api/v1/pain/symptoms", headers=_auth(access))).json()
    sid = catalog[0]["id"]
    created = (
        await client.post(
            "/api/v1/pain",
            headers=_auth(access),
            json={
                "pain_level": 5,
                "locations": ["head"],
                "symptoms": [{"catalog_id": sid, "severity": "mild"}],
            },
        )
    ).json()
    eid = created["id"]

    r = await client.delete(f"/api/v1/pain/{eid}", headers=_auth(access))
    assert r.status_code == 204
    r = await client.delete(f"/api/v1/pain/{eid}", headers=_auth(access))
    assert r.status_code == 404
    assert (await client.get("/api/v1/pain", headers=_auth(access))).json() == []


@pytest.mark.asyncio
async def test_add_pain_with_back_regions(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.post(
        "/api/v1/pain",
        headers=_auth(access),
        json={
            "pain_level": 4,
            "locations": ["left_glute", "left_hamstring", "back_head"],
        },
    )
    assert r.status_code == 201, r.text
    assert sorted(r.json()["locations"]) == ["back_head", "left_glute", "left_hamstring"]


@pytest.mark.asyncio
async def test_pain_feature_registered(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["features"]["pain"] is True
