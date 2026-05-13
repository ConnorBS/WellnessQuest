from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_entry import FoodEntry
from app.models.user import User
from app.services import events, goal_service, xp_service
from app.services.time_utils import day_bounds_for_user, day_for_user, utcnow


class FoodAddResult:
    __slots__ = (
        "entry",
        "total_kcal",
        "target_kcal",
        "xp_delta",
        "over_target",
        "newly_exceeded",
    )

    def __init__(
        self,
        *,
        entry: FoodEntry,
        total_kcal: int,
        target_kcal: int,
        xp_delta: int,
        over_target: bool,
        newly_exceeded: bool,
    ) -> None:
        self.entry = entry
        self.total_kcal = total_kcal
        self.target_kcal = target_kcal
        self.xp_delta = xp_delta
        self.over_target = over_target
        self.newly_exceeded = newly_exceeded


async def total_today(db: AsyncSession, *, user: User, for_date: date | None = None) -> int:
    day = for_date or day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = select(func.coalesce(func.sum(FoodEntry.kcal), 0)).where(
        FoodEntry.user_id == user.id,
        FoodEntry.occurred_at >= start,
        FoodEntry.occurred_at < end,
    )
    return int((await db.execute(stmt)).scalar_one())


async def macro_totals(
    db: AsyncSession, *, user: User, for_date: date | None = None
) -> tuple[Decimal, Decimal, Decimal]:
    day = for_date or day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = select(
        func.coalesce(func.sum(FoodEntry.protein_g), 0),
        func.coalesce(func.sum(FoodEntry.carbs_g), 0),
        func.coalesce(func.sum(FoodEntry.fat_g), 0),
    ).where(
        FoodEntry.user_id == user.id,
        FoodEntry.occurred_at >= start,
        FoodEntry.occurred_at < end,
    )
    row = (await db.execute(stmt)).one()
    return Decimal(row[0]), Decimal(row[1]), Decimal(row[2])


async def list_today(
    db: AsyncSession, *, user: User, for_date: date | None = None
) -> list[FoodEntry]:
    day = for_date or day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = (
        select(FoodEntry)
        .where(
            FoodEntry.user_id == user.id,
            FoodEntry.occurred_at >= start,
            FoodEntry.occurred_at < end,
        )
        .order_by(FoodEntry.occurred_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def add(
    db: AsyncSession,
    *,
    user: User,
    name: str,
    kcal: int,
    source: str,
    client_id: str | None,
    occurred_at: datetime | None,
    brand: str | None = None,
    protein_g: Decimal | None = None,
    carbs_g: Decimal | None = None,
    fat_g: Decimal | None = None,
    meal_type: str | None = None,
    provider: str | None = None,
    provider_id: str | None = None,
) -> FoodAddResult:
    today = day_for_user(user.timezone)
    before_total = await total_today(db, user=user)
    goal = await goal_service.get_or_create_default_food(db, user_id=user.id)
    target_kcal = int(goal.target)
    was_over = before_total > target_kcal

    entry = FoodEntry(
        user_id=user.id,
        name=name.strip(),
        brand=(brand.strip() or None) if brand else None,
        kcal=kcal,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        meal_type=meal_type,
        source=source,
        provider=provider,
        provider_id=provider_id,
        occurred_at=occurred_at or utcnow(),
        client_id=client_id,
    )
    try:
        async with db.begin_nested():
            db.add(entry)
            await db.flush()
    except IntegrityError:
        return await _get_by_client_id(
            db, user=user, client_id=client_id, target_kcal=target_kcal
        )

    xp_delta = await xp_service.grant_for_food(db, user=user, kcal=kcal, ref_id=entry.id)

    new_total = before_total + kcal
    now_over = new_total > target_kcal
    newly_exceeded = now_over and not was_over

    await db.flush()

    if newly_exceeded:
        await events.emit(
            user.id,
            "food.target_exceeded",
            {
                "target_kcal": target_kcal,
                "total_kcal": new_total,
                "date": today.isoformat(),
            },
        )

    return FoodAddResult(
        entry=entry,
        total_kcal=new_total,
        target_kcal=target_kcal,
        xp_delta=xp_delta,
        over_target=now_over,
        newly_exceeded=newly_exceeded,
    )


async def _get_by_client_id(
    db: AsyncSession, *, user: User, client_id: str | None, target_kcal: int
) -> FoodAddResult:
    stmt = select(FoodEntry).where(
        FoodEntry.user_id == user.id, FoodEntry.client_id == client_id
    )
    entry = (await db.execute(stmt)).scalar_one()
    total = await total_today(db, user=user)
    return FoodAddResult(
        entry=entry,
        total_kcal=total,
        target_kcal=target_kcal,
        xp_delta=0,
        over_target=total > target_kcal,
        newly_exceeded=False,
    )


async def recent_distinct(
    db: AsyncSession, *, user: User, limit: int = 8
) -> list[FoodEntry]:
    """Return the user's most-recently-logged distinct foods.

    "Distinct" is keyed on (lowercased name, brand) so duplicates of the same
    item don't crowd out variety. The kcal/macros come from the latest entry
    of each name — that's what they actually logged most recently, which is
    what they likely want to re-log with one tap.
    """
    # Pull the most recent ~5x the requested count so dedup has variety to
    # choose from. Caller-side dedup is cheap and avoids a window-function
    # subquery that asyncpg + SQLAlchemy 2.x sometimes struggle to parameterise.
    fetch_limit = max(limit * 5, 20)
    stmt = (
        select(FoodEntry)
        .where(FoodEntry.user_id == user.id)
        .order_by(FoodEntry.occurred_at.desc())
        .limit(fetch_limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    seen: set[tuple[str, str]] = set()
    result: list[FoodEntry] = []
    for row in rows:
        key = (row.name.strip().lower(), (row.brand or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
        if len(result) >= limit:
            break
    return result


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    stmt = select(FoodEntry).where(
        FoodEntry.id == entry_id, FoodEntry.user_id == user.id
    )
    entry = (await db.execute(stmt)).scalar_one_or_none()
    if entry is None:
        return False
    await db.delete(entry)
    return True
