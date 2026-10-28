from __future__ import annotations

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.schemas.ui_prefs import UiPrefs, ui_prefs_from_row
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


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_me_ui_prefs_default_to_empty(client, db, unique_email):
    access = await _signup(client, db, unique_email)
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200, r.text
    assert r.json()["ui_prefs"] == {
        "theme": {
            "background": None,
            "card": None,
            "border": None,
            "accent": None,
            "text": None,
            "muted": None,
        },
        "card_colors": {},
        "hidden_sections": [],
    }


@pytest.mark.asyncio
async def test_patch_ui_prefs_round_trips_and_replaces(client, db, unique_email):
    access = await _signup(client, db, unique_email)
    prefs = {
        "theme": {"background": "#101820", "accent": "#F2AA4C"},
        "card_colors": {"water": "#0b3d5c", "mood": "#3b2a4d"},
        "hidden_sections": ["streaks", "xp_bar", "streaks"],
    }
    r = await client.patch("/api/v1/me", headers=_auth(access), json={"ui_prefs": prefs})
    assert r.status_code == 200, r.text
    out = r.json()["ui_prefs"]
    assert out["theme"]["background"] == "#101820"
    assert out["theme"]["accent"] == "#F2AA4C"
    assert out["theme"]["card"] is None
    assert out["card_colors"] == {"water": "#0b3d5c", "mood": "#3b2a4d"}
    # Duplicates collapse, first occurrence wins.
    assert out["hidden_sections"] == ["streaks", "xp_bar"]

    # Persisted, not just echoed.
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["ui_prefs"]["card_colors"]["water"] == "#0b3d5c"

    # The blob is replaced wholesale, so clearing a colour really clears it.
    r = await client.patch(
        "/api/v1/me",
        headers=_auth(access),
        json={"ui_prefs": {"theme": {}, "card_colors": {}, "hidden_sections": []}},
    )
    assert r.status_code == 200, r.text
    assert r.json()["ui_prefs"]["theme"]["background"] is None
    assert r.json()["ui_prefs"]["card_colors"] == {}

    # A PATCH that doesn't mention ui_prefs leaves them alone.
    r = await client.patch("/api/v1/me", headers=_auth(access), json={"ui_prefs": prefs})
    r = await client.patch("/api/v1/me", headers=_auth(access), json={"title_hidden": True})
    assert r.json()["ui_prefs"]["card_colors"]["mood"] == "#3b2a4d"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "prefs",
    [
        {"theme": {"background": "red"}},
        {"theme": {"background": "#fff"}},
        {"theme": {"background": "#ffffff; background-image: url(x)"}},
        {"theme": {"sidebar": "#ffffff"}},
        {"card_colors": {"not_a_tracker": "#ffffff"}},
        {"hidden_sections": ["nav"]},
        {"bogus": True},
    ],
)
async def test_patch_ui_prefs_rejects_bad_shapes(client, db, unique_email, prefs):
    access = await _signup(client, db, unique_email)
    r = await client.patch("/api/v1/me", headers=_auth(access), json={"ui_prefs": prefs})
    assert r.status_code == 422, r.text


def test_ui_prefs_from_row_drops_stale_keys():
    row = {
        "theme": {"accent": "#10b981", "sidebar": "#000000"},
        "card_colors": {"water": "#000000", "retired_tracker": "#000000"},
        "hidden_sections": ["xp_bar", "nav"],
    }
    out = ui_prefs_from_row(row)
    assert out.theme.accent == "#10b981"
    assert out.card_colors == {"water": "#000000"}
    assert out.hidden_sections == ["xp_bar"]
    assert ui_prefs_from_row(None) == UiPrefs()
    # A malformed colour written outside the API falls back to defaults.
    assert ui_prefs_from_row({"theme": {"accent": "nope"}}) == UiPrefs()


def test_ui_prefs_to_row_is_compact():
    prefs = UiPrefs.model_validate({"theme": {"accent": "#10b981"}})
    assert prefs.to_row() == {
        "theme": {"accent": "#10b981"},
        "card_colors": {},
        "hidden_sections": [],
    }
