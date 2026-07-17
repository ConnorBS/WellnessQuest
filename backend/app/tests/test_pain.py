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
async def test_pain_feature_registered(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["features"]["pain"] is True
