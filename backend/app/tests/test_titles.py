from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.auth.passwords import hash_password
from app.models.title import Title
from app.models.user import User
from app.models.user_title import UserTitle
from app.models.water_entry import WaterEntry
from app.services import title_service
from app.services.time_utils import utcnow
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
    return {"user_id": user.id, "tokens": r.json()}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _seed_titles(db, rows: list[dict]) -> list[Title]:
    titles: list[Title] = []
    for i, row in enumerate(rows):
        t = Title(
            slug=row["slug"],
            name=row["name"],
            description=row.get("description", ""),
            category=row.get("category", "test"),
            rarity=row.get("rarity", "common"),
            condition_kind=row["condition_kind"],
            condition_params=row.get("condition_params", {}),
            opt_out_group=row.get("opt_out_group"),
            is_secret=row.get("is_secret", False),
            sort_order=row.get("sort_order", i),
        )
        db.add(t)
        titles.append(t)
    await db.flush()
    return titles


@pytest.mark.asyncio
async def test_scan_unlocks_signup_titles(client, db, unique_email):
    """Newbie-style signup titles should be unlocked on bootstrap."""
    await _seed_titles(
        db,
        [{"slug": "newbie", "name": "Newbie", "condition_kind": "signup"}],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)

    r = await client.get("/api/v1/me", headers=_auth(data["tokens"]["access_token"]))
    assert r.status_code == 200, r.text
    body = r.json()
    pending = body["pending_title_unlocks"]
    assert len(pending) == 1
    assert pending[0]["slug"] == "newbie"


@pytest.mark.asyncio
async def test_lifetime_water_threshold_unlocks_on_rescan(
    client, db, unique_email
):
    await _seed_titles(
        db,
        [
            {
                "slug": "water_1000",
                "name": "First Litre",
                "condition_kind": "lifetime_water_ml",
                "condition_params": {"threshold": 1000},
            }
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Log enough water to cross the threshold.
    for _ in range(4):
        r = await client.post(
            "/api/v1/water",
            headers=_auth(access),
            json={"ml": 300, "source": "pwa"},
        )
        assert r.status_code == 201, r.text

    # Force a re-scan by nulling the cursor (24h freshness window would
    # otherwise skip the scan since /me was already called during signup).
    user = (
        await db.execute(select(User).where(User.id == data["user_id"]))
    ).scalar_one()
    user.titles_last_scan_at = None
    await db.commit()

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200
    slugs = [t["slug"] for t in r.json()["pending_title_unlocks"]]
    assert "water_1000" in slugs


@pytest.mark.asyncio
async def test_opt_out_filters_weight_titles(client, db, unique_email):
    titles = await _seed_titles(
        db,
        [
            {
                "slug": "weighed_once",
                "name": "First Weigh-In",
                "category": "weight_milestone",
                "condition_kind": "weight_logs_count",
                "condition_params": {"threshold": 1},
                "opt_out_group": "weight_loss",
            }
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Opt out BEFORE producing weight entries.
    r = await client.patch(
        "/api/v1/me",
        headers=_auth(access),
        json={"weight_titles_opt_out": True},
    )
    assert r.status_code == 200
    assert r.json()["weight_titles_opt_out"] is True

    # Log a weight entry.
    r = await client.post(
        "/api/v1/weight",
        headers=_auth(access),
        json={"weight_kg": 80.0},
    )
    assert r.status_code in (200, 201), r.text

    # Force a scan and confirm the opted-out title is NOT unlocked.
    user = (
        await db.execute(select(User).where(User.id == data["user_id"]))
    ).scalar_one()
    user.titles_last_scan_at = None
    await db.commit()

    r = await client.get("/api/v1/me", headers=_auth(access))
    pending_slugs = [t["slug"] for t in r.json()["pending_title_unlocks"]]
    assert "weighed_once" not in pending_slugs
    _ = titles  # touch to keep ref alive in scope; assertion above covers


@pytest.mark.asyncio
async def test_equip_rejects_unowned_title(client, db, unique_email):
    titles = await _seed_titles(
        db,
        [
            {
                "slug": "locked_title",
                "name": "Locked",
                "condition_kind": "lifetime_water_ml",
                "condition_params": {"threshold": 999999},
            }
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.patch(
        "/api/v1/titles/equipped",
        headers=_auth(access),
        json={"title_id": str(titles[0].id)},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "not_unlocked"


@pytest.mark.asyncio
async def test_equip_and_clear_equipped(client, db, unique_email):
    await _seed_titles(
        db,
        [{"slug": "auto_unlock", "name": "Auto", "condition_kind": "signup"}],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/me", headers=_auth(access))
    pending = r.json()["pending_title_unlocks"]
    assert len(pending) == 1
    title_id = pending[0]["id"]

    r = await client.patch(
        "/api/v1/titles/equipped",
        headers=_auth(access),
        json={"title_id": title_id},
    )
    assert r.status_code == 200
    assert r.json()["equipped_title"]["slug"] == "auto_unlock"

    r = await client.patch(
        "/api/v1/titles/equipped",
        headers=_auth(access),
        json={"title_id": None},
    )
    assert r.status_code == 200
    assert r.json()["equipped_title"] is None


@pytest.mark.asyncio
async def test_acknowledge_clears_from_pending(client, db, unique_email):
    await _seed_titles(
        db,
        [{"slug": "auto_unlock", "name": "Auto", "condition_kind": "signup"}],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/me", headers=_auth(access))
    pending = r.json()["pending_title_unlocks"]
    assert len(pending) == 1
    title_id = pending[0]["id"]

    r = await client.post(
        f"/api/v1/titles/{title_id}/acknowledge", headers=_auth(access)
    )
    assert r.status_code == 204

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.json()["pending_title_unlocks"] == []


@pytest.mark.asyncio
async def test_acknowledge_unknown_title_returns_404(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.post(
        f"/api/v1/titles/{uuid.uuid4()}/acknowledge",
        headers=_auth(access),
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_pending_unlocks_capped_at_five(client, db, unique_email):
    await _seed_titles(
        db,
        [
            {
                "slug": f"signup_dup_{i}",
                "name": f"Signup {i}",
                "condition_kind": "signup",
            }
            for i in range(8)
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/me", headers=_auth(access))
    pending = r.json()["pending_title_unlocks"]
    assert len(pending) == 5


@pytest.mark.asyncio
async def test_secret_titles_hidden_until_unlocked(client, db, unique_email):
    await _seed_titles(
        db,
        [
            {
                "slug": "secret_locked",
                "name": "Hidden",
                "category": "secret",
                "condition_kind": "lifetime_water_ml",
                "condition_params": {"threshold": 999999},
                "is_secret": True,
            },
            {
                "slug": "secret_open",
                "name": "Revealed",
                "category": "secret",
                "condition_kind": "signup",
                "is_secret": True,
            },
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get(
        "/api/v1/titles?category=secret", headers=_auth(access)
    )
    assert r.status_code == 200
    slugs = {row["slug"] for row in r.json()}
    assert "secret_open" in slugs
    assert "secret_locked" not in slugs


@pytest.mark.asyncio
async def test_categories_summary(client, db, unique_email):
    await _seed_titles(
        db,
        [
            {"slug": "a", "name": "A", "category": "alpha", "condition_kind": "signup"},
            {"slug": "b", "name": "B", "category": "alpha", "condition_kind": "signup"},
            {
                "slug": "c",
                "name": "C",
                "category": "beta",
                "condition_kind": "lifetime_water_ml",
                "condition_params": {"threshold": 999999},
            },
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/titles/categories", headers=_auth(access))
    assert r.status_code == 200
    by_cat = {row["category"]: row for row in r.json()}
    assert by_cat["alpha"]["total"] == 2
    assert by_cat["alpha"]["unlocked"] == 2
    assert by_cat["beta"]["total"] == 1
    assert by_cat["beta"]["unlocked"] == 0


@pytest.mark.asyncio
async def test_scan_user_directly_unlocks_lifetime_water(
    client, db, unique_email
):
    """Service-level test that scan_user actually inserts user_titles rows."""
    titles = await _seed_titles(
        db,
        [
            {
                "slug": "w_500",
                "name": "500ml",
                "condition_kind": "lifetime_water_ml",
                "condition_params": {"threshold": 500},
            }
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)

    user = (
        await db.execute(select(User).where(User.id == data["user_id"]))
    ).scalar_one()

    db.add(
        WaterEntry(
            user_id=user.id,
            ml=600,
            source="pwa",
            occurred_at=utcnow(),
        )
    )
    user.titles_last_scan_at = None
    await db.commit()

    newly = await title_service.scan_user(db, user)
    await db.commit()
    assert any(t.slug == "w_500" for t in newly)

    rows = (
        await db.execute(
            select(UserTitle).where(
                UserTitle.user_id == user.id,
                UserTitle.title_id == titles[0].id,
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_pending_unlocks_ordered_rarest_first(client, db, unique_email):
    """When several titles unlock at once, the popup queue surfaces the
    rarest first (legendary -> common)."""
    await _seed_titles(
        db,
        [
            {"slug": "c_common", "name": "C", "rarity": "common", "condition_kind": "signup"},
            {"slug": "e_epic", "name": "E", "rarity": "epic", "condition_kind": "signup"},
            {"slug": "u_uncommon", "name": "U", "rarity": "uncommon", "condition_kind": "signup"},
            {"slug": "l_legendary", "name": "L", "rarity": "legendary", "condition_kind": "signup"},
            {"slug": "r_rare", "name": "R", "rarity": "rare", "condition_kind": "signup"},
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200
    rarities = [t["rarity"] for t in r.json()["pending_title_unlocks"]]
    assert rarities == ["legendary", "epic", "rare", "uncommon", "common"]


@pytest.mark.asyncio
async def test_logging_water_surfaces_unlock_on_next_me(client, db, unique_email):
    """Crossing a threshold via the normal POST flow should surface the unlock
    on the very next /me — no 24h wait, no manual cursor reset."""
    await _seed_titles(
        db,
        [
            {
                "slug": "water_1000",
                "name": "First Litre",
                "condition_kind": "lifetime_water_ml",
                "condition_params": {"threshold": 1000},
            }
        ],
    )
    await db.commit()
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]

    # Signup already ran a scan and stamped the freshness cursor; without the
    # write-path re-scan flag this title would stay hidden until the cursor
    # went stale (24h).
    for _ in range(4):
        r = await client.post(
            "/api/v1/water",
            headers=_auth(access),
            json={"ml": 300, "source": "pwa"},
        )
        assert r.status_code == 201, r.text

    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200
    slugs = [t["slug"] for t in r.json()["pending_title_unlocks"]]
    assert "water_1000" in slugs
