"""Title unlock evaluation, equip, and acknowledgement.

Design notes:
- Catalog is global, soft-archived, never deleted. Per-user state lives in
  `user_titles`.
- Unlock detection is **lazy**: `scan_user` is called from `GET /me` when the
  user's `titles_last_scan_at` is stale, and from `bootstrap_user_assets`
  when a user is provisioned.
- One aggregate query per `condition_kind` regardless of catalog size — see
  `_evaluate_kind`. At 2,500 titles spread across ~15 kinds the scan is ~15
  queries total.
- Opt-out filtering happens in Python after candidate fetch (cheaper than
  conditional WHERE clauses, and only one extra column on each row).
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_entry import ActivityEntry
from app.models.blood_pressure_entry import BloodPressureEntry
from app.models.food_entry import FoodEntry
from app.models.habit_checkin import HabitCheckin
from app.models.session import Session
from app.models.streak import Streak
from app.models.title import Title
from app.models.user import User
from app.models.user_title import UserTitle
from app.models.water_entry import WaterEntry
from app.models.weight_entry import WeightEntry
from app.models.xp_event import XpEvent
from app.services.time_utils import utcnow

SCAN_STALE_AFTER = timedelta(hours=24)
PENDING_UNLOCKS_LIMIT = 5


async def _lifetime_water_ml(db: AsyncSession, user: User) -> int:
    stmt = select(func.coalesce(func.sum(WaterEntry.ml), 0)).where(
        WaterEntry.user_id == user.id
    )
    return int((await db.execute(stmt)).scalar_one())


async def _lifetime_active_minutes(db: AsyncSession, user: User) -> int:
    stmt = select(func.coalesce(func.sum(ActivityEntry.minutes), 0)).where(
        ActivityEntry.user_id == user.id
    )
    return int((await db.execute(stmt)).scalar_one())


async def _entry_count(db: AsyncSession, user: User, model: Any) -> int:
    stmt = select(func.count()).select_from(model).where(model.user_id == user.id)
    return int((await db.execute(stmt)).scalar_one())


async def _streak_value(
    db: AsyncSession, user: User, metric: str, field: str
) -> int:
    stmt = select(Streak).where(Streak.user_id == user.id, Streak.metric == metric)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        return 0
    return int(getattr(row, field))


async def _distinct_local_days(
    db: AsyncSession, user: User, column: Any
) -> int:
    """COUNT(DISTINCT date(column AT TIME ZONE user.tz))."""
    local_date = func.date(func.timezone(user.timezone, column))
    stmt = select(func.count(func.distinct(local_date)))
    return int((await db.execute(stmt)).scalar_one())


async def _login_days(db: AsyncSession, user: User) -> int:
    local_date = func.date(func.timezone(user.timezone, Session.created_at))
    stmt = (
        select(func.count(func.distinct(local_date)))
        .where(Session.user_id == user.id)
    )
    return int((await db.execute(stmt)).scalar_one())


async def _active_days(db: AsyncSession, user: User) -> int:
    local_date = func.date(func.timezone(user.timezone, XpEvent.created_at))
    stmt = (
        select(func.count(func.distinct(local_date)))
        .where(XpEvent.user_id == user.id)
    )
    return int((await db.execute(stmt)).scalar_one())


async def _exercise_type_minutes(
    db: AsyncSession, user: User
) -> dict[str, int]:
    stmt = (
        select(
            ActivityEntry.exercise_type,
            func.coalesce(func.sum(ActivityEntry.minutes), 0),
        )
        .where(
            ActivityEntry.user_id == user.id,
            ActivityEntry.exercise_type.is_not(None),
        )
        .group_by(ActivityEntry.exercise_type)
    )
    rows = (await db.execute(stmt)).all()
    return {row[0]: int(row[1]) for row in rows}


async def _evaluate_kind(
    db: AsyncSession, user: User, kind: str, candidates: list[Title]
) -> list[Title]:
    """Return the subset of `candidates` (all sharing `condition_kind == kind`)
    that the user currently qualifies for."""

    def threshold_for(t: Title) -> int:
        return int((t.condition_params or {}).get("threshold", 0))

    if kind == "signup":
        return list(candidates)

    if kind == "level":
        return [t for t in candidates if user.level >= threshold_for(t)]

    if kind == "xp_total":
        return [t for t in candidates if user.xp_total >= threshold_for(t)]

    if kind == "lifetime_water_ml":
        value = await _lifetime_water_ml(db, user)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "lifetime_active_minutes":
        value = await _lifetime_active_minutes(db, user)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "water_entry_count":
        value = await _entry_count(db, user, WaterEntry)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "activity_entry_count":
        value = await _entry_count(db, user, ActivityEntry)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "food_entry_count":
        value = await _entry_count(db, user, FoodEntry)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "weight_logs_count":
        value = await _entry_count(db, user, WeightEntry)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "bp_logs_count":
        value = await _entry_count(db, user, BloodPressureEntry)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "habit_checkin_count":
        value = await _entry_count(db, user, HabitCheckin)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "streak_water_days_current":
        value = await _streak_value(db, user, "water_ml", "current_len")
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "streak_water_days_longest":
        value = await _streak_value(db, user, "water_ml", "longest_len")
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "streak_activity_days_current":
        value = await _streak_value(db, user, "active_minutes", "current_len")
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "streak_activity_days_longest":
        value = await _streak_value(db, user, "active_minutes", "longest_len")
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "login_days":
        value = await _login_days(db, user)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "active_days":
        value = await _active_days(db, user)
        return [t for t in candidates if value >= threshold_for(t)]

    if kind == "exercise_type_minutes":
        by_type = await _exercise_type_minutes(db, user)
        result: list[Title] = []
        for t in candidates:
            params = t.condition_params or {}
            ex_type = params.get("exercise_type")
            minutes = int(params.get("minutes", 0))
            if ex_type and by_type.get(ex_type, 0) >= minutes:
                result.append(t)
        return result

    # Unknown kinds are skipped silently — a deploy can introduce new kinds
    # that older backends won't recognise; better to no-op than crash.
    return []


def _allowed_by_opt_out(title: Title, user: User) -> bool:
    return not (
        (title.opt_out_group == "weight_loss" and user.weight_titles_opt_out)
        or (title.opt_out_group == "bp" and user.bp_titles_opt_out)
    )


async def scan_user(db: AsyncSession, user: User) -> list[Title]:
    """Evaluate every non-archived, non-opted-out, not-already-unlocked title
    against the user's current state. Insert `user_titles` rows for matches.
    Updates `user.titles_last_scan_at`. Returns the newly-unlocked titles.

    Safe to call with an empty catalog (returns []).
    """
    already_unlocked = set(
        (
            await db.execute(
                select(UserTitle.title_id).where(UserTitle.user_id == user.id)
            )
        )
        .scalars()
        .all()
    )

    candidates_q = await db.execute(
        select(Title).where(Title.archived_at.is_(None))
    )
    candidates = [
        t
        for t in candidates_q.scalars().all()
        if t.id not in already_unlocked and _allowed_by_opt_out(t, user)
    ]

    by_kind: dict[str, list[Title]] = defaultdict(list)
    for t in candidates:
        by_kind[t.condition_kind].append(t)

    newly_unlocked: list[Title] = []
    now = utcnow()
    for kind, kind_candidates in by_kind.items():
        matched = await _evaluate_kind(db, user, kind, kind_candidates)
        for t in matched:
            db.add(
                UserTitle(
                    user_id=user.id,
                    title_id=t.id,
                    unlocked_at=now,
                )
            )
            newly_unlocked.append(t)

    user.titles_last_scan_at = now
    await db.flush()
    return newly_unlocked


async def maybe_scan(db: AsyncSession, user: User) -> list[Title]:
    """Run `scan_user` only if the user's last scan is missing or stale."""
    last = user.titles_last_scan_at
    if last is not None and (utcnow() - last) < SCAN_STALE_AFTER:
        return []
    return await scan_user(db, user)


async def equipped_title(db: AsyncSession, user: User) -> Title | None:
    if user.equipped_title_id is None:
        return None
    stmt = select(Title).where(Title.id == user.equipped_title_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def pending_unlocks(
    db: AsyncSession, user: User, limit: int = PENDING_UNLOCKS_LIMIT
) -> list[Title]:
    """Titles unlocked but not yet acknowledged by the user, oldest first."""
    stmt = (
        select(Title)
        .join(UserTitle, UserTitle.title_id == Title.id)
        .where(
            UserTitle.user_id == user.id,
            UserTitle.acknowledged_at.is_(None),
        )
        .order_by(UserTitle.unlocked_at.asc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def equip(db: AsyncSession, user: User, title_id: uuid.UUID | None) -> Title | None:
    """Set the user's equipped title (or clear it).

    Validates ownership: raises `ValueError` if the user has not unlocked
    `title_id` (caller should translate to 400/404).
    """
    if title_id is None:
        user.equipped_title_id = None
        await db.flush()
        return None

    stmt = (
        select(Title)
        .join(UserTitle, UserTitle.title_id == Title.id)
        .where(
            UserTitle.user_id == user.id,
            Title.id == title_id,
            Title.archived_at.is_(None),
        )
    )
    title = (await db.execute(stmt)).scalar_one_or_none()
    if title is None:
        raise ValueError("not_unlocked")
    user.equipped_title_id = title.id
    await db.flush()
    return title


async def acknowledge(
    db: AsyncSession, user: User, title_id: uuid.UUID
) -> bool:
    """Mark the user's unlock for `title_id` as seen (dismissing the
    animation). Returns False if the row doesn't exist; idempotent on
    re-acknowledgement (does not change the timestamp)."""
    stmt = select(UserTitle).where(
        UserTitle.user_id == user.id, UserTitle.title_id == title_id
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        return False
    if row.acknowledged_at is None:
        row.acknowledged_at = utcnow()
        await db.flush()
    return True


async def acknowledge_all(db: AsyncSession, user: User) -> int:
    """Mark every still-pending unlock for `user` as seen. Returns the count
    of rows acknowledged. Used by the popup's "Accept all" button when the
    user has a backlog of unlocks (e.g. after a catalog deploy)."""
    stmt = select(UserTitle).where(
        UserTitle.user_id == user.id,
        UserTitle.acknowledged_at.is_(None),
    )
    rows = list((await db.execute(stmt)).scalars().all())
    now = utcnow()
    for row in rows:
        row.acknowledged_at = now
    if rows:
        await db.flush()
    return len(rows)


async def unlocked_count_by_category(
    db: AsyncSession, user: User
) -> dict[str, int]:
    stmt = (
        select(Title.category, func.count())
        .join(UserTitle, UserTitle.title_id == Title.id)
        .where(
            UserTitle.user_id == user.id,
            Title.archived_at.is_(None),
        )
        .group_by(Title.category)
    )
    rows = (await db.execute(stmt)).all()
    return {row[0]: int(row[1]) for row in rows}


async def total_count_by_category(
    db: AsyncSession, user: User
) -> dict[str, int]:
    """Catalog totals per category, after applying the user's opt-outs and
    excluding archived rows. Excludes secret titles the user hasn't unlocked
    (so the count matches what they see in the browse UI)."""
    unlocked_ids = set(
        (
            await db.execute(
                select(UserTitle.title_id).where(UserTitle.user_id == user.id)
            )
        )
        .scalars()
        .all()
    )
    all_titles_q = await db.execute(
        select(Title).where(Title.archived_at.is_(None))
    )
    counts: dict[str, int] = defaultdict(int)
    for t in all_titles_q.scalars().all():
        if not _allowed_by_opt_out(t, user):
            continue
        if t.is_secret and t.id not in unlocked_ids:
            continue
        counts[t.category] += 1
    return dict(counts)
