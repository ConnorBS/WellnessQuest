from __future__ import annotations

import pytest

from app.auth.passwords import hash_password
from app.features import FEATURE_KEYS, default_features
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
async def test_features_default_to_the_registry(client, db, unique_email):
    """A fresh user has no override rows, so every key comes back at its
    registry default — which is on for most trackers and off for the ones that
    are opt-in (see FeatureDef.default_enabled)."""
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/features", headers=_auth(access))
    assert r.status_code == 200, r.text
    items = r.json()["features"]
    keys = {i["key"] for i in items}
    assert keys == set(FEATURE_KEYS)
    assert {i["key"]: i["enabled"] for i in items} == default_features()


@pytest.mark.asyncio
async def test_me_exposes_features_map(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200, r.text
    features = r.json()["features"]
    assert set(features) == set(FEATURE_KEYS)
    assert features["water"] is True


@pytest.mark.asyncio
async def test_toggle_feature_off_and_on(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.patch(
        "/api/v1/features",
        headers=_auth(access),
        json={"feature_key": "weight", "enabled": False},
    )
    assert r.status_code == 200, r.text
    weight = next(i for i in r.json()["features"] if i["key"] == "weight")
    assert weight["enabled"] is False

    # Reflected on /me too.
    me = await client.get("/api/v1/me", headers=_auth(access))
    assert me.json()["features"]["weight"] is False

    # Toggling back on removes the override effect.
    r = await client.patch(
        "/api/v1/features",
        headers=_auth(access),
        json={"feature_key": "weight", "enabled": True},
    )
    assert r.status_code == 200
    weight = next(i for i in r.json()["features"] if i["key"] == "weight")
    assert weight["enabled"] is True


@pytest.mark.asyncio
async def test_toggle_unknown_feature_rejected(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.patch(
        "/api/v1/features",
        headers=_auth(access),
        json={"feature_key": "not_a_real_feature", "enabled": False},
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "unknown_feature"


@pytest.mark.asyncio
async def test_me_default_order_is_registry_order(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    order = r.json()["feature_order"]
    assert order[0] == "water"
    assert set(order) == set(FEATURE_KEYS)


@pytest.mark.asyncio
async def test_reorder_features(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Put mood + weight first; the rest keep registry order after them.
    r = await client.post(
        "/api/v1/features/order",
        headers=_auth(access),
        json={"order": ["mood", "weight", "bogus_key"]},
    )
    assert r.status_code == 200, r.text
    keys = [f["key"] for f in r.json()["features"]]
    assert keys[0] == "mood"
    assert keys[1] == "weight"
    # Unknown key dropped; every real feature still present exactly once.
    assert "bogus_key" not in keys
    assert set(keys) == set(FEATURE_KEYS)

    # Reflected on /me too.
    me = await client.get("/api/v1/me", headers=_auth(access))
    assert me.json()["feature_order"][:2] == ["mood", "weight"]


@pytest.mark.asyncio
async def test_features_require_auth(client):
    r = await client.get("/api/v1/features")
    assert r.status_code == 401
