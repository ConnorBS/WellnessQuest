from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.auth.passwords import hash_password
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.time_utils import day_for_user
from app.services.user_bootstrap import bootstrap_user_assets

BASE = "/api/v1/period/intimacy"


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
            "entry_date": "2026-07-10",
            "kind": "partnered",
            "protection": "protected",
            "tags": ["orgasm", "orgasm", "toys"],
            "note": "  spaced  ",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["kind"] == "partnered"
    assert body["protection"] == "protected"
    # Deduped and sorted for stable display.
    assert body["tags"] == ["orgasm", "toys"]
    assert body["note"] == "spaced"

    r = await client.get(f"{BASE}?days=730", headers=_auth(access))
    assert r.status_code == 200
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_several_occurrences_per_day(client, db, unique_email):
    """Unlike period_entries, this is a log — a day can hold more than one row."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    today = day_for_user("UTC").isoformat()

    for kind in ("partnered", "solo"):
        r = await client.post(
            BASE,
            headers=_auth(access),
            json={"entry_date": today, "kind": kind},
        )
        assert r.status_code == 201, r.text

    r = await client.get(f"{BASE}/day?date={today}", headers=_auth(access))
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    # Oldest first within the day.
    assert [row["kind"] for row in rows] == ["partnered", "solo"]


@pytest.mark.asyncio
async def test_defaults_and_summary(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(BASE, headers=_auth(access), json={})
    assert r.status_code == 201, r.text
    body = r.json()
    today = day_for_user("UTC")
    assert body["entry_date"] == today.isoformat()
    assert body["kind"] == "partnered"
    assert body["protection"] == "unspecified"
    assert body["tags"] == []
    assert body["note"] is None

    r = await client.get(f"{BASE}/summary", headers=_auth(access))
    assert r.status_code == 200
    assert r.json() == {
        "days": 30,
        "count": 1,
        "last_entry_date": today.isoformat(),
    }


@pytest.mark.asyncio
async def test_future_date_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    tomorrow = (day_for_user("UTC") + timedelta(days=1)).isoformat()

    r = await client.post(
        BASE, headers=_auth(access), json={"entry_date": tomorrow}
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "future_date"


@pytest.mark.asyncio
async def test_invalid_vocabulary_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    for payload in (
        {"kind": "telepathic"},
        {"protection": "hopeful"},
        {"tags": ["vibes"]},
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
        json={
            "kind": "partnered",
            "protection": "unprotected",
            "tags": ["painful"],
            "note": "keep me",
        },
    )
    entry_id = r.json()["id"]

    r = await client.patch(
        f"{BASE}/{entry_id}",
        headers=_auth(access),
        json={"protection": "protected"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["protection"] == "protected"
    assert body["tags"] == ["painful"]
    assert body["note"] == "keep me"

    # An explicit null clears the note — the one field that can be emptied.
    r = await client.patch(
        f"{BASE}/{entry_id}", headers=_auth(access), json={"note": None}
    )
    assert r.status_code == 200, r.text
    assert r.json()["note"] is None

    r = await client.patch(
        f"{BASE}/999999", headers=_auth(access), json={"kind": "solo"}
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(BASE, headers=_auth(access), json={"kind": "solo"})
    entry_id = r.json()["id"]

    r = await client.delete(f"{BASE}/{entry_id}", headers=_auth(access))
    assert r.status_code == 204
    r = await client.delete(f"{BASE}/{entry_id}", headers=_auth(access))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_entries_are_per_user(client, db, unique_email):
    mine = await _signup(client, db, unique_email)
    theirs = await _signup(client, db, f"other-{unique_email}")

    r = await client.post(
        BASE,
        headers=_auth(mine["tokens"]["access_token"]),
        json={"kind": "solo", "note": "private"},
    )
    entry_id = r.json()["id"]

    other = _auth(theirs["tokens"]["access_token"])
    assert (await client.get(BASE, headers=other)).json() == []
    assert (await client.delete(f"{BASE}/{entry_id}", headers=other)).status_code == 404
    assert (
        await client.patch(f"{BASE}/{entry_id}", headers=other, json={"kind": "solo"})
    ).status_code == 404


@pytest.mark.asyncio
async def test_audit_rows_omit_the_private_detail(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        BASE,
        headers=_auth(access),
        json={
            "kind": "solo",
            "protection": "unprotected",
            "tags": ["orgasm"],
            "note": "secret",
        },
    )
    assert r.status_code == 201, r.text

    rows = (
        (
            await db.execute(
                select(AuditLog).where(AuditLog.action == "intimacy.add")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    meta = rows[0].meta or {}
    assert set(meta) == {"entry_date"}
    serialised = str(meta)
    for private in ("secret", "solo", "unprotected", "orgasm"):
        assert private not in serialised


@pytest.mark.asyncio
async def test_feature_is_registered_and_off_by_default(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/features", headers=_auth(access))
    assert r.status_code == 200
    entry = next(f for f in r.json()["features"] if f["key"] == "intimacy")
    assert entry["label"] == "Sexual activity"
    assert entry["enabled"] is False

    r = await client.patch(
        "/api/v1/features",
        headers=_auth(access),
        json={"feature_key": "intimacy", "enabled": True},
    )
    assert r.status_code == 200, r.text
    entry = next(f for f in r.json()["features"] if f["key"] == "intimacy")
    assert entry["enabled"] is True
