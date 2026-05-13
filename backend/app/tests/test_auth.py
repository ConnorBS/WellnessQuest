from __future__ import annotations

import pytest

from app.auth.passwords import hash_password, verify_password
from app.models.user import User


def test_password_roundtrip():
    h = hash_password("CorrectHorse-Battery-Staple")
    assert verify_password("CorrectHorse-Battery-Staple", h)
    assert not verify_password("wrong", h)


@pytest.mark.asyncio
async def test_setup_status_then_create_first_admin(client):
    r = await client.get("/api/v1/setup/status")
    assert r.status_code == 200
    assert r.json() == {"setup_required": True}

    r = await client.post(
        "/api/v1/setup/admin",
        json={
            "email": "first-admin@example.com",
            "password": "SuperSecure-Pass-1!",
            "display_name": "First Admin",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["role"] == "admin"
    assert body["user"]["must_change_password"] is False
    assert body["tokens"]["access_token"]

    r = await client.get("/api/v1/setup/status")
    assert r.json() == {"setup_required": False}

    # Second attempt is blocked
    r = await client.post(
        "/api/v1/setup/admin",
        json={
            "email": "second@example.com",
            "password": "SuperSecure-Pass-1!",
            "display_name": "Should Not Exist",
        },
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "setup_already_complete"


@pytest.mark.asyncio
async def test_login_and_refresh_rotate(client):
    setup = await client.post(
        "/api/v1/setup/admin",
        json={
            "email": "rotate@example.com",
            "password": "SuperSecure-Pass-1!",
            "display_name": "Rotator",
        },
    )
    assert setup.status_code == 201

    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "rotate@example.com", "password": "SuperSecure-Pass-1!"},
    )
    assert r.status_code == 200
    refresh = r.json()["refresh_token"]

    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert r.json()["refresh_token"] != refresh


@pytest.mark.asyncio
async def test_change_password_clears_must_change_and_revokes_other_sessions(
    client, db, unique_email
):
    # First, become admin via setup.
    r = await client.post(
        "/api/v1/setup/admin",
        json={
            "email": "admin@example.com",
            "password": "SuperSecure-Pass-1!",
            "display_name": "Admin",
        },
    )
    assert r.status_code == 201
    admin_access = r.json()["tokens"]["access_token"]

    # Admin creates a second user with a temp password.
    r = await client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_access}"},
        json={
            "email": unique_email,
            "display_name": "Partner",
            "password": "TempPass-12345!",
            "role": "user",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["must_change_password"] is True

    # Partner logs in with the temp password.
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "TempPass-12345!"},
    )
    assert r.status_code == 200
    access = r.json()["access_token"]
    old_refresh = r.json()["refresh_token"]

    # Open a second login session for the same user — represents another device.
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "TempPass-12345!"},
    )
    assert r.status_code == 200
    other_device_refresh = r.json()["refresh_token"]

    # /me reports must_change_password=true until they rotate.
    r = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {access}"}
    )
    assert r.status_code == 200
    assert r.json()["must_change_password"] is True

    # Change password.
    r = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "current_password": "TempPass-12345!",
            "new_password": "BrandNewPass-99!",
        },
    )
    assert r.status_code == 200, r.text
    new_refresh = r.json()["refresh_token"]

    # The other device's refresh token is now revoked.
    r = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": other_device_refresh}
    )
    assert r.status_code == 401

    # The freshly-issued refresh token still works.
    r = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_refresh}
    )
    assert r.status_code == 200

    # Old refresh from the first login is also revoked.
    r = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_cannot_disable_last_admin(client):
    r = await client.post(
        "/api/v1/setup/admin",
        json={
            "email": "lonely-admin@example.com",
            "password": "SuperSecure-Pass-1!",
            "display_name": "Solo",
        },
    )
    assert r.status_code == 201
    admin_id = r.json()["user"]["id"]
    access = r.json()["tokens"]["access_token"]

    r = await client.patch(
        f"/api/v1/admin/users/{admin_id}",
        headers={"Authorization": f"Bearer {access}"},
        json={"disabled": True},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "last_admin"

    r = await client.patch(
        f"/api/v1/admin/users/{admin_id}",
        headers={"Authorization": f"Bearer {access}"},
        json={"role": "user"},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "last_admin"


_ = User  # ensure model registration
