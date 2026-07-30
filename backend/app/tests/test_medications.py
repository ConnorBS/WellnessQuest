from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.services.user_bootstrap import bootstrap_user_assets


async def _signup(client, db, email: str) -> str:
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
    return r.json()["access_token"]


def _today():
    """The user fixture is UTC, so compare against the UTC date, not the
    container's local one."""
    return datetime.now(UTC).date()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _create(client, token: str, **kwargs) -> dict:
    body = {"name": "Sertraline", "dose_amount": "50", "dose_unit": "mg", "frequency": "once daily"}
    body.update(kwargs)
    r = await client.post("/api/v1/medications", json=body, headers=_auth(token))
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_create_seeds_started_change(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token)
    assert med["active"] is True
    assert med["ended_on"] is None
    assert med["dose_amount"] == "50.000"
    assert med["dose_unit"] == "mg"
    assert med["frequency"] == "once daily"
    assert [c["kind"] for c in med["changes"]] == ["started"]
    assert med["started_on"] == _today().isoformat()


@pytest.mark.asyncio
async def test_no_medications_by_default(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    r = await client.get("/api/v1/medications", headers=_auth(token))
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_dose_change_folds_to_current(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token, started_on=str(_today() - timedelta(days=30)))
    r = await client.post(
        f"/api/v1/medications/{med['id']}/changes",
        json={
            "kind": "dose_change",
            "effective_on": str(_today() - timedelta(days=7)),
            "dose_amount": "100",
            "dose_unit": "mg",
            "note": "GP doubled it",
        },
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    # Current dose reflects the newest row; the original 50mg stays in history.
    assert body["dose_amount"] == "100.000"
    assert body["frequency"] == "once daily"  # unchanged rows carry forward
    assert [c["kind"] for c in body["changes"]] == ["dose_change", "started"]


@pytest.mark.asyncio
async def test_backdated_change_does_not_override_newer(client, db, unique_email):
    """A row inserted late but dated earlier must not win the fold."""
    token = await _signup(client, db, unique_email)
    med = await _create(client, token, started_on=str(_today() - timedelta(days=60)))
    await client.post(
        f"/api/v1/medications/{med['id']}/changes",
        json={
            "kind": "dose_change",
            "effective_on": str(_today() - timedelta(days=5)),
            "dose_amount": "100",
        },
        headers=_auth(token),
    )
    r = await client.post(
        f"/api/v1/medications/{med['id']}/changes",
        json={
            "kind": "dose_change",
            "effective_on": str(_today() - timedelta(days=40)),
            "dose_amount": "75",
        },
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    assert r.json()["dose_amount"] == "100.000"


@pytest.mark.asyncio
async def test_stop_moves_to_past_and_resume_returns(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token)
    r = await client.post(
        f"/api/v1/medications/{med['id']}/stop",
        json={"reason": "side effects"},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["active"] is False
    assert body["ended_on"] == _today().isoformat()
    assert body["stopped_reason"] == "side effects"
    # Past medications keep their last known dose.
    assert body["dose_amount"] == "50.000"

    r = await client.get("/api/v1/medications?status=active", headers=_auth(token))
    assert r.json() == []
    r = await client.get("/api/v1/medications?status=past", headers=_auth(token))
    assert len(r.json()) == 1

    # Stopping twice is rejected rather than silently appending a second row.
    r = await client.post(
        f"/api/v1/medications/{med['id']}/stop", json={}, headers=_auth(token)
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "already_stopped"

    r = await client.post(
        f"/api/v1/medications/{med['id']}/resume", json={}, headers=_auth(token)
    )
    assert r.status_code == 200
    body = r.json()
    assert body["active"] is True
    assert body["stopped_reason"] is None
    # The stop stays in the timeline — the gap is the history.
    kinds = [c["kind"] for c in body["changes"]]
    assert "stopped" in kinds
    assert "resumed" in kinds


@pytest.mark.asyncio
async def test_resume_requires_stopped(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token)
    r = await client.post(
        f"/api/v1/medications/{med['id']}/resume", json={}, headers=_auth(token)
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "not_stopped"


@pytest.mark.asyncio
async def test_future_dates_rejected(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    tomorrow = str(_today() + timedelta(days=1))
    r = await client.post(
        "/api/v1/medications",
        json={"name": "Vitamin D", "started_on": tomorrow},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "future_date"

    med = await _create(client, token)
    r = await client.post(
        f"/api/v1/medications/{med['id']}/changes",
        json={"kind": "dose_change", "effective_on": tomorrow, "dose_amount": "10"},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "future_date"


@pytest.mark.asyncio
async def test_stop_before_start_rejected(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token, started_on=str(_today() - timedelta(days=2)))
    r = await client.post(
        f"/api/v1/medications/{med['id']}/stop",
        json={"ended_on": str(_today() - timedelta(days=10))},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "ended_before_started"


@pytest.mark.asyncio
async def test_patch_edits_identity_without_touching_timeline(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token)
    r = await client.patch(
        f"/api/v1/medications/{med['id']}",
        json={"name": "Sertraline (Zoloft)", "prescriber": "Dr Kim", "reason": None},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Sertraline (Zoloft)"
    assert body["prescriber"] == "Dr Kim"
    assert body["change_count"] == 1  # still just the `started` row


@pytest.mark.asyncio
async def test_invalid_form_and_kind_rejected(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    r = await client.post(
        "/api/v1/medications",
        json={"name": "Thing", "form": "smoothie"},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_form"

    med = await _create(client, token)
    r = await client.post(
        f"/api/v1/medications/{med['id']}/changes",
        json={"kind": "stopped"},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_kind"


@pytest.mark.asyncio
async def test_delete_change_protects_started_row(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token)
    started_id = med["changes"][0]["id"]
    r = await client.delete(
        f"/api/v1/medications/{med['id']}/changes/{started_id}", headers=_auth(token)
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "cannot_delete_started"

    r = await client.post(
        f"/api/v1/medications/{med['id']}/changes",
        json={"kind": "note", "note": "oops"},
        headers=_auth(token),
    )
    note_id = r.json()["changes"][0]["id"]
    r = await client.delete(
        f"/api/v1/medications/{med['id']}/changes/{note_id}", headers=_auth(token)
    )
    assert r.status_code == 204
    r = await client.get(f"/api/v1/medications/{med['id']}", headers=_auth(token))
    assert r.json()["change_count"] == 1


@pytest.mark.asyncio
async def test_history_feed_spans_medications(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    a = await _create(client, token, name="Sertraline")
    await _create(client, token, name="Vitamin D")
    await client.post(
        f"/api/v1/medications/{a['id']}/changes",
        json={"kind": "dose_change", "dose_amount": "100"},
        headers=_auth(token),
    )
    r = await client.get("/api/v1/medications/history", headers=_auth(token))
    assert r.status_code == 200, r.text
    feed = r.json()
    assert len(feed) == 3
    assert {e["medication_name"] for e in feed} == {"Sertraline", "Vitamin D"}


@pytest.mark.asyncio
async def test_other_users_medications_are_invisible(client, db, unique_email):
    token_a = await _signup(client, db, unique_email)
    med = await _create(client, token_a)
    token_b = await _signup(client, db, f"other-{unique_email}")
    r = await client.get(f"/api/v1/medications/{med['id']}", headers=_auth(token_b))
    assert r.status_code == 404
    r = await client.post(
        f"/api/v1/medications/{med['id']}/stop", json={}, headers=_auth(token_b)
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_medication_removes_timeline(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    med = await _create(client, token)
    r = await client.delete(f"/api/v1/medications/{med['id']}", headers=_auth(token))
    assert r.status_code == 204
    r = await client.get("/api/v1/medications/history", headers=_auth(token))
    assert r.json() == []


@pytest.mark.asyncio
async def test_options_lists_vocabularies(client, db, unique_email):
    token = await _signup(client, db, unique_email)
    r = await client.get("/api/v1/medications/options", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert "tablet" in body["forms"]
    assert "mg" in body["dose_units"]
    assert "stopped" not in body["change_kinds"]
