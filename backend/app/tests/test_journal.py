from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.services.time_utils import utcnow
from app.services.user_bootstrap import bootstrap_user_assets


# The test users all live in UTC, so "today" has to be UTC's today rather than
# the test host's — otherwise these fail on a machine running behind UTC.
def _today():
    return utcnow().date()


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
async def test_add_defaults_to_today_and_lists(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    today = _today()

    r = await client.post(
        "/api/v1/journal",
        headers=_auth(access),
        json={"body": "  Saw a heron on the walk home.  "},
    )
    assert r.status_code == 201, r.text
    entry = r.json()
    assert entry["entry_date"] == today.isoformat()
    # Whitespace is trimmed on the way in.
    assert entry["body"] == "Saw a heron on the walk home."

    r = await client.get("/api/v1/journal", headers=_auth(access))
    assert r.status_code == 200
    assert [e["id"] for e in r.json()] == [entry["id"]]


@pytest.mark.asyncio
async def test_day_list_is_scoped_and_ordered_oldest_first(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    yesterday = (_today() - timedelta(days=1)).isoformat()

    first = (
        await client.post(
            "/api/v1/journal",
            headers=_auth(access),
            json={"entry_date": yesterday, "body": "Morning: dentist."},
        )
    ).json()
    second = (
        await client.post(
            "/api/v1/journal",
            headers=_auth(access),
            json={"entry_date": yesterday, "body": "Evening: good film."},
        )
    ).json()
    await client.post(
        "/api/v1/journal", headers=_auth(access), json={"body": "Today's note."}
    )

    r = await client.get(f"/api/v1/journal?date={yesterday}", headers=_auth(access))
    assert r.status_code == 200
    assert [e["id"] for e in r.json()] == [first["id"], second["id"]]


@pytest.mark.asyncio
async def test_summary_counts_the_requested_day(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    yesterday = (_today() - timedelta(days=1)).isoformat()

    r = await client.get("/api/v1/journal/summary", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["count"] == 0
    assert r.json()["latest"] is None

    await client.post(
        "/api/v1/journal",
        headers=_auth(access),
        json={"entry_date": yesterday, "body": "One."},
    )
    await client.post(
        "/api/v1/journal",
        headers=_auth(access),
        json={"entry_date": yesterday, "body": "Two."},
    )

    r = await client.get(
        f"/api/v1/journal/summary?date={yesterday}", headers=_auth(access)
    )
    body = r.json()
    assert body["entry_date"] == yesterday
    assert body["count"] == 2
    assert body["latest"]["body"] == "Two."

    # Today is still empty.
    r = await client.get("/api/v1/journal/summary", headers=_auth(access))
    assert r.json()["count"] == 0


@pytest.mark.asyncio
async def test_recent_spans_days_newest_first(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    older = (_today() - timedelta(days=3)).isoformat()

    await client.post(
        "/api/v1/journal",
        headers=_auth(access),
        json={"entry_date": older, "body": "Older note."},
    )
    await client.post(
        "/api/v1/journal", headers=_auth(access), json={"body": "Newer note."}
    )

    r = await client.get("/api/v1/journal/recent", headers=_auth(access))
    assert r.status_code == 200
    assert [e["body"] for e in r.json()] == ["Newer note.", "Older note."]


@pytest.mark.asyncio
async def test_future_date_rejected_on_add_and_patch(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    tomorrow = (_today() + timedelta(days=1)).isoformat()

    r = await client.post(
        "/api/v1/journal",
        headers=_auth(access),
        json={"entry_date": tomorrow, "body": "Not yet."},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "future_date"

    entry = (
        await client.post(
            "/api/v1/journal", headers=_auth(access), json={"body": "Today."}
        )
    ).json()
    r = await client.patch(
        f"/api/v1/journal/{entry['id']}",
        headers=_auth(access),
        json={"entry_date": tomorrow},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_empty_body_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.post("/api/v1/journal", headers=_auth(access), json={"body": ""})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_and_delete(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    entry = (
        await client.post(
            "/api/v1/journal", headers=_auth(access), json={"body": "Frist draft."}
        )
    ).json()

    # A fresh note carries identical timestamps; the UI reads that as "not
    # edited", so the equality matters.
    assert entry["created_at"] == entry["updated_at"]

    r = await client.patch(
        f"/api/v1/journal/{entry['id']}",
        headers=_auth(access),
        json={"body": "First draft."},
    )
    assert r.status_code == 200
    assert r.json()["body"] == "First draft."
    # entry_date left alone by a body-only patch.
    assert r.json()["entry_date"] == entry["entry_date"]
    assert datetime.fromisoformat(r.json()["updated_at"]) > datetime.fromisoformat(
        entry["updated_at"]
    )

    r = await client.delete(f"/api/v1/journal/{entry['id']}", headers=_auth(access))
    assert r.status_code == 204
    r = await client.get("/api/v1/journal", headers=_auth(access))
    assert r.json() == []


@pytest.mark.asyncio
async def test_entries_are_per_user(client, db, unique_email):
    mine = await _signup(client, db, unique_email)
    theirs = await _signup(client, db, f"other-{unique_email}")
    entry = (
        await client.post(
            "/api/v1/journal",
            headers=_auth(mine["tokens"]["access_token"]),
            json={"body": "Private."},
        )
    ).json()

    other = _auth(theirs["tokens"]["access_token"])
    assert (await client.get("/api/v1/journal", headers=other)).json() == []
    assert (
        await client.patch(
            f"/api/v1/journal/{entry['id']}", headers=other, json={"body": "Nope."}
        )
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/journal/{entry['id']}", headers=other)
    ).status_code == 404


@pytest.mark.asyncio
async def test_journal_is_a_toggleable_feature(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/features", headers=_auth(access))
    keys = {f["key"]: f for f in r.json()["features"]}
    assert keys["journal"]["label"] == "Journal"
    assert keys["journal"]["enabled"] is True
