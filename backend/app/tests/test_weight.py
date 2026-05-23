from __future__ import annotations

from decimal import Decimal

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
async def test_weight_patch_updates_fields(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.post(
        "/api/v1/weight",
        headers=_auth(access),
        json={"weight_kg": "80.5"},
    )
    assert r.status_code == 201, r.text
    entry_id = r.json()["id"]

    r = await client.patch(
        f"/api/v1/weight/{entry_id}",
        headers=_auth(access),
        json={
            "weight_kg": "81.2",
            "note": "after dinner",
            "occurred_at": "2026-05-22T19:30:00Z",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert Decimal(body["weight_kg"]) == Decimal("81.2")
    assert body["note"] == "after dinner"
    assert body["occurred_at"].startswith("2026-05-22T19:30:00")


@pytest.mark.asyncio
async def test_weight_patch_missing_returns_404(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.patch(
        "/api/v1/weight/9999999",
        headers=_auth(access),
        json={"weight_kg": "75.0"},
    )
    assert r.status_code == 404
