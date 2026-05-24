from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.auth.passwords import hash_password
from app.models.user import User
from app.services import weight_service
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


def _mk_entry(*, at: datetime, kg: str):
    # compute_ewma_trend only reads .occurred_at and .weight_kg; a duck-typed
    # namespace avoids fighting SQLAlchemy's column descriptors in unit tests.
    return SimpleNamespace(occurred_at=at, weight_kg=Decimal(kg))


def test_ewma_trend_constant_series_stays_flat():
    base = datetime(2026, 1, 1, tzinfo=UTC)
    entries = [_mk_entry(at=base + timedelta(days=i), kg="80.00") for i in range(10)]
    series = weight_service.compute_ewma_trend(entries)
    assert len(series) == 10
    for _, trend in series:
        assert trend == Decimal("80.00")


def test_ewma_trend_step_response_converges():
    base = datetime(2026, 1, 1, tzinfo=UTC)
    # Step from 100kg to 110kg; with k=0.1 the trend approaches 110 but
    # doesn't snap to it (that's the point — smoothing).
    entries = [_mk_entry(at=base, kg="100.00")]
    for i in range(1, 30):
        entries.append(_mk_entry(at=base + timedelta(days=i), kg="110.00"))
    series = weight_service.compute_ewma_trend(entries)
    # After one step the trend has only moved ~10% of the gap.
    assert Decimal("100.5") < series[1][1] < Decimal("101.5")
    # After ~30 steps the trend has nearly converged.
    assert series[-1][1] > Decimal("109.5")
    assert series[-1][1] < Decimal("110.0")


def test_trend_delta_returns_none_when_window_too_short():
    base = datetime(2026, 1, 1, tzinfo=UTC)
    entries = [_mk_entry(at=base + timedelta(days=i), kg="80.00") for i in range(3)]
    series = weight_service.compute_ewma_trend(entries)
    assert weight_service.trend_delta(series, lookback_days=14) is None


def test_trend_delta_compares_trend_not_raw_points():
    base = datetime(2026, 1, 1, tzinfo=UTC)
    # Noisy series oscillating ±2 kg around a downward trend.
    weights = ["100.0", "102.0", "98.0", "99.5", "100.5", "97.0", "98.5",
               "96.0", "97.5", "95.0", "96.5", "94.0", "95.5", "93.0",
               "94.5", "92.0", "93.5", "91.0", "92.5", "90.0"]
    entries = [
        _mk_entry(at=base + timedelta(days=i), kg=w) for i, w in enumerate(weights)
    ]
    series = weight_service.compute_ewma_trend(entries)
    delta = weight_service.trend_delta(series, lookback_days=14)
    # Last raw is 90.0, raw 14 days back is 96.0 -> raw delta -6.0. Trend
    # smooths the noise so trend delta should be present and negative but
    # well within the noise envelope.
    assert delta is not None
    assert delta < Decimal("0")


@pytest.mark.asyncio
async def test_weight_summary_trend_ready_with_enough_history(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    base = datetime(2026, 1, 1, tzinfo=UTC)
    # Log 10 entries spanning 12 days — enough for trend_ready=True.
    for i in range(10):
        r = await client.post(
            "/api/v1/weight",
            headers=_auth(access),
            json={
                "weight_kg": str(Decimal("80.0") + Decimal(str(i * 0.2))),
                "occurred_at": (base + timedelta(days=i * 1.3)).isoformat(),
            },
        )
        assert r.status_code == 201

    r = await client.get("/api/v1/weight/summary", headers=_auth(access))
    assert r.status_code == 200
    body = r.json()
    assert body["trend_ready"] is True
    assert body["trend_kg"] is not None
    # The newest raw point is the highest, but the smoothed trend lags
    # behind it — sanity check that the trend isn't just the raw latest.
    assert Decimal(body["trend_kg"]) < Decimal(body["latest"]["weight_kg"])


@pytest.mark.asyncio
async def test_weight_summary_trend_not_ready_when_sparse(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.post(
        "/api/v1/weight",
        headers=_auth(access),
        json={"weight_kg": "80.0"},
    )
    assert r.status_code == 201

    r = await client.get("/api/v1/weight/summary", headers=_auth(access))
    assert r.status_code == 200
    body = r.json()
    assert body["trend_ready"] is False
    assert body["trend_delta_kg"] is None


@pytest.mark.asyncio
async def test_weight_trend_endpoint_returns_series(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for i in range(5):
        await client.post(
            "/api/v1/weight",
            headers=_auth(access),
            json={
                "weight_kg": str(Decimal("80.0") + Decimal(str(i * 0.5))),
                "occurred_at": (base + timedelta(days=i)).isoformat(),
            },
        )

    r = await client.get("/api/v1/weight/trend?limit=90", headers=_auth(access))
    assert r.status_code == 200
    body = r.json()
    assert len(body["points"]) == 5
    # Points come back oldest-first with both raw and trend values.
    assert "weight_kg" in body["points"][0]
    assert "trend_kg" in body["points"][0]
    assert Decimal(body["points"][0]["trend_kg"]) == Decimal(
        body["points"][0]["weight_kg"]
    )


@pytest.mark.asyncio
async def test_me_show_raw_weight_delta_default_false(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.get("/api/v1/me", headers=_auth(access))
    assert r.status_code == 200
    assert r.json()["show_raw_weight_delta"] is False


@pytest.mark.asyncio
async def test_me_patch_show_raw_weight_delta(client, db, unique_email):
    data = await _signup(client, db, unique_email)
    access = data["tokens"]["access_token"]
    r = await client.patch(
        "/api/v1/me",
        headers=_auth(access),
        json={"show_raw_weight_delta": True},
    )
    assert r.status_code == 200
    assert r.json()["show_raw_weight_delta"] is True
