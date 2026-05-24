from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.weight_entry import WeightEntry
from app.models.weight_target import WeightTarget
from app.schemas.weight import WeightEntryPatch
from app.services.time_utils import utcnow

# EWMA smoothing constant per the Hacker's Diet (John Walker). A new reading
# contributes ~10% to the trend; daily noise (water, food, sodium) gets
# averaged out over ~2 weeks but real change still propagates.
TREND_SMOOTHING_K: Decimal = Decimal("0.1")

# Below this many readings the trend is too noisy to surface as a "trend",
# so the summary endpoint returns trend_ready=False and the UI suppresses
# the trend headline.
TREND_MIN_ENTRIES: int = 5

# Window over which the dashboard reports "trend now vs trend then" so the
# user sees movement on a horizon that matters, not yesterday's water weight.
TREND_LOOKBACK_DAYS: int = 14

# Treat |trend delta| smaller than this as "stable" — within typical noise
# floor for the smoothed series. ~0.2 kg ≈ 0.44 lb.
TREND_STABLE_THRESHOLD_KG: Decimal = Decimal("0.2")


async def add(
    db: AsyncSession,
    *,
    user: User,
    weight_kg: Decimal,
    occurred_at: datetime | None = None,
    note: str | None = None,
) -> WeightEntry:
    entry = WeightEntry(
        user_id=user.id,
        weight_kg=weight_kg,
        occurred_at=occurred_at or utcnow(),
        note=note,
    )
    db.add(entry)
    await db.flush()
    return entry


async def latest(db: AsyncSession, *, user: User) -> WeightEntry | None:
    return (
        await db.execute(
            select(WeightEntry)
            .where(WeightEntry.user_id == user.id)
            .order_by(WeightEntry.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def closest_before(
    db: AsyncSession, *, user: User, anchor: datetime, max_lookback_days: int = 60
) -> WeightEntry | None:
    """Find the entry whose occurred_at is the latest within [anchor - max_lookback_days,
    anchor - 1 day). Used for the "delta vs last week" card line."""
    floor = anchor - timedelta(days=max_lookback_days)
    ceiling = anchor - timedelta(days=1)
    return (
        await db.execute(
            select(WeightEntry)
            .where(
                WeightEntry.user_id == user.id,
                WeightEntry.occurred_at >= floor,
                WeightEntry.occurred_at < ceiling,
            )
            .order_by(WeightEntry.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_history(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[WeightEntry]:
    return list(
        (
            await db.execute(
                select(WeightEntry)
                .where(WeightEntry.user_id == user.id)
                .order_by(WeightEntry.occurred_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def update_entry(
    db: AsyncSession,
    *,
    user: User,
    entry_id: int,
    patch: WeightEntryPatch,
) -> WeightEntry | None:
    """Apply a partial update to a weight entry. Returns None when not found."""
    row = (
        await db.execute(
            select(WeightEntry).where(
                WeightEntry.id == entry_id, WeightEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    data = patch.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "note" and isinstance(value, str):
            stripped = value.strip()
            setattr(row, field, stripped or None)
        else:
            setattr(row, field, value)
    await db.flush()
    return row


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = (
        await db.execute(
            select(WeightEntry).where(
                WeightEntry.id == entry_id, WeightEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True


# --- weight targets ---------------------------------------------------------

async def add_target(
    db: AsyncSession,
    *,
    user: User,
    target_kg: Decimal | None,
    effective_at: datetime | None = None,
) -> WeightTarget:
    row = WeightTarget(
        user_id=user.id,
        target_kg=target_kg,
        effective_at=effective_at or utcnow(),
    )
    db.add(row)
    await db.flush()
    return row


async def current_target(db: AsyncSession, *, user: User) -> WeightTarget | None:
    return (
        await db.execute(
            select(WeightTarget)
            .where(WeightTarget.user_id == user.id)
            .order_by(WeightTarget.effective_at.desc(), WeightTarget.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_targets(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[WeightTarget]:
    return list(
        (
            await db.execute(
                select(WeightTarget)
                .where(WeightTarget.user_id == user.id)
                .order_by(WeightTarget.effective_at.desc(), WeightTarget.id.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


def compute_ewma_trend(
    entries: list[WeightEntry], k: Decimal = TREND_SMOOTHING_K
) -> list[tuple[datetime, Decimal]]:
    """Hacker's Diet exponentially-weighted moving average.

    Input MUST be ordered oldest -> newest. Output is one (occurred_at, trend_kg)
    tuple per input entry, seeded from the first reading.
    """
    if not entries:
        return []
    trend: Decimal = Decimal(entries[0].weight_kg)
    out: list[tuple[datetime, Decimal]] = [(entries[0].occurred_at, trend)]
    for e in entries[1:]:
        trend = trend + k * (Decimal(e.weight_kg) - trend)
        out.append((e.occurred_at, trend))
    return out


def trend_delta(
    trend_series: list[tuple[datetime, Decimal]],
    *,
    lookback_days: int = TREND_LOOKBACK_DAYS,
) -> Decimal | None:
    """Latest trend minus the trend point at-or-before `lookback_days` ago.

    Returns None when the series doesn't yet span the lookback window — we
    don't want to claim "down 2 lb over 2 weeks" from a 3-day-old log.
    """
    if len(trend_series) < 2:
        return None
    latest_at, latest_kg = trend_series[-1]
    cutoff = latest_at - timedelta(days=lookback_days)
    prior_kg: Decimal | None = None
    for at, kg in trend_series:
        if at <= cutoff:
            prior_kg = kg
        else:
            break
    if prior_kg is None:
        return None
    return (latest_kg - prior_kg).quantize(Decimal("0.01"))


async def starting_weight_for_target(
    db: AsyncSession, *, user: User, target: WeightTarget | None
) -> Decimal | None:
    """First weight logged on or after the current target's effective_at.

    Used to render "X% of the way from start to target" progress framing
    instead of an open-ended "down N lb to go" countdown. Returns None when
    no target is set or no readings exist since the target was set.
    """
    if target is None or target.target_kg is None:
        return None
    row = (
        await db.execute(
            select(WeightEntry)
            .where(
                WeightEntry.user_id == user.id,
                WeightEntry.occurred_at >= target.effective_at,
            )
            .order_by(WeightEntry.occurred_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return Decimal(row.weight_kg) if row is not None else None


async def delete_target(db: AsyncSession, *, user: User, target_id: int) -> bool:
    row = (
        await db.execute(
            select(WeightTarget).where(
                WeightTarget.id == target_id, WeightTarget.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True
