from __future__ import annotations

from datetime import timedelta

import pytest

from app.auth.invites import generate_invite_code
from app.auth.passwords import hash_password, verify_password
from app.models.invite import Invite
from app.models.user import User
from app.services.time_utils import utcnow


def test_password_roundtrip():
    h = hash_password("CorrectHorse-Battery-Staple")
    assert verify_password("CorrectHorse-Battery-Staple", h)
    assert not verify_password("wrong", h)


async def _create_invite(db) -> str:
    raw, code_hash = generate_invite_code()
    db.add(
        Invite(
            email=None,
            code_hash=code_hash,
            expires_at=utcnow() + timedelta(hours=1),
        )
    )
    await db.commit()
    return raw


@pytest.mark.asyncio
async def test_signup_login_refresh(client, db, unique_email):
    invite_code = await _create_invite(db)

    r = await client.post(
        "/api/v1/auth/signup",
        json={
            "invite_code": invite_code,
            "email": unique_email,
            "password": "TestPassword-123!",
            "display_name": "Tester",
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    refresh = data["tokens"]["refresh_token"]
    assert data["user"]["email"] == unique_email

    # login
    r2 = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "TestPassword-123!"},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["access_token"]

    # refresh rotates and returns a new pair
    r3 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r3.status_code == 200, r3.text
    assert r3.json()["refresh_token"] != refresh


@pytest.mark.asyncio
async def test_signup_rejects_bad_invite(client, unique_email):
    r = await client.post(
        "/api/v1/auth/signup",
        json={
            "invite_code": "not-real-code-xxxxxxxxxxxxxxx",
            "email": unique_email,
            "password": "TestPassword-123!",
            "display_name": "Tester",
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_invite"


_ = User  # ensure model registration
