from __future__ import annotations

from datetime import timedelta

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.services.time_utils import utcnow
from app.services.user_bootstrap import bootstrap_user_assets

BASE = "/api/v1/reflux"


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
async def test_add_and_list(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        BASE,
        headers=_auth(access),
        json={
            "severity": "moderate",
            "triggers": ["spicy", "caffeine", "spicy"],
            "note": "  after dinner  ",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["severity"] == "moderate"
    # Deduped and sorted for stable display.
    assert body["triggers"] == ["caffeine", "spicy"]
    assert body["note"] == "after dinner"
    assert body["occurred_at"]  # defaulted to now

    # Several episodes a day are expected.
    r2 = await client.post(BASE, headers=_auth(access), json={"severity": "mild"})
    assert r2.status_code == 201, r2.text
    assert r2.json()["triggers"] == []

    r = await client.get(BASE, headers=_auth(access))
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_summary_counts(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get(f"{BASE}/summary", headers=_auth(access))
    assert r.status_code == 200
    assert r.json() == {"latest": None, "today_count": 0, "week_count": 0}

    now = utcnow()
    for days_ago, severity in ((0, "severe"), (3, "mild"), (10, "moderate")):
        r = await client.post(
            BASE,
            headers=_auth(access),
            json={
                "severity": severity,
                "occurred_at": (now - timedelta(days=days_ago)).isoformat(),
            },
        )
        assert r.status_code == 201, r.text

    r = await client.get(f"{BASE}/summary", headers=_auth(access))
    body = r.json()
    assert body["latest"]["severity"] == "severe"
    assert body["today_count"] == 1
    # Today + 3 days ago; the 10-day-old one is outside the week.
    assert body["week_count"] == 2


@pytest.mark.asyncio
async def test_invalid_vocabulary_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    for payload in (
        {"severity": "apocalyptic"},
        {"severity": "mild", "triggers": ["kale"]},
        {},
    ):
        r = await client.post(BASE, headers=_auth(access), json=payload)
        assert r.status_code == 422, (payload, r.text)


@pytest.mark.asyncio
async def test_patch_changes_only_supplied_fields(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        BASE,
        headers=_auth(access),
        json={"severity": "mild", "triggers": ["tomato"], "note": "keep me"},
    )
    entry_id = r.json()["id"]

    r = await client.patch(
        f"{BASE}/{entry_id}", headers=_auth(access), json={"severity": "severe"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["severity"] == "severe"
    assert body["triggers"] == ["tomato"]
    assert body["note"] == "keep me"

    r = await client.patch(
        f"{BASE}/{entry_id}",
        headers=_auth(access),
        json={"triggers": ["late_meal", "alcohol"], "note": None},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["triggers"] == ["alcohol", "late_meal"]
    assert body["note"] is None

    r = await client.patch(
        f"{BASE}/999999", headers=_auth(access), json={"severity": "mild"}
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_and_per_user_isolation(client, db, unique_email):
    mine = await _signup(client, db, unique_email)
    theirs = await _signup(client, db, f"other-{unique_email}")
    me = _auth(mine["tokens"]["access_token"])
    other = _auth(theirs["tokens"]["access_token"])

    r = await client.post(BASE, headers=me, json={"severity": "mild"})
    entry_id = r.json()["id"]

    assert (await client.get(BASE, headers=other)).json() == []
    assert (await client.delete(f"{BASE}/{entry_id}", headers=other)).status_code == 404

    assert (await client.delete(f"{BASE}/{entry_id}", headers=me)).status_code == 204
    assert (await client.delete(f"{BASE}/{entry_id}", headers=me)).status_code == 404


@pytest.mark.asyncio
async def test_feature_is_registered_and_on_by_default(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/features", headers=_auth(access))
    assert r.status_code == 200
    entry = next(f for f in r.json()["features"] if f["key"] == "reflux")
    assert entry["label"] == "Acid reflux"
    assert entry["enabled"] is True
