"""Habit business logic: status calculation and check-in toggle.

The status calc is the heart of this module. Three cadence kinds:

- **daily** — done iff a checkin exists for today (local tz).
- **weekly(N)** — done-for-period iff >= N checkins this Mon-Sun (user tz).
  Status turns amber when the deficit equals remaining days in week, red on
  Sunday or when impossible.
- **interval(K)** — last checkin must be within K-1 days. Amber on day K-1,
  red on day K, red+overdue past K.

Status is computed at request time, not stored.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit
from app.models.habit_checkin import HabitCheckin
from app.models.user import User
from app.schemas.habit import HabitOut, HabitStatusOut, HabitWithStatusOut
from app.services.time_utils import day_for_user


def _to_habit_out(h: Habit) -> HabitOut:
    return HabitOut(
        id=h.id,
        name=h.name,
        icon_kind=h.icon_kind,  # type: ignore[arg-type]
        icon_key=h.icon_key,
        cadence_kind=h.cadence_kind,  # type: ignore[arg-type]
        weekly_target=h.weekly_target,
        interval_days=h.interval_days,
        sort_order=h.sort_order,
    )


def _iso_week_bounds(today: date) -> tuple[date, date]:
    """Returns (monday, sunday) of the ISO week containing `today`."""
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _compute_weekly_streak(checkin_dates: Sequence[date], today: date, target: int) -> int:
    """Count consecutive weeks (back from this week) where >= target checkins."""
    if not checkin_dates:
        return 0
    by_week: dict[date, int] = defaultdict(int)
    for d in checkin_dates:
        monday = d - timedelta(days=d.weekday())
        by_week[monday] += 1
    streak = 0
    monday = today - timedelta(days=today.weekday())
    # current week counts only if already met; otherwise streak measured from prior weeks
    while by_week.get(monday, 0) >= target:
        streak += 1
        monday -= timedelta(days=7)
    return streak


def _compute_daily_streak(checkin_dates: set[date], today: date) -> int:
    streak = 0
    cursor = today
    while cursor in checkin_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _compute_interval_streak(
    checkin_dates: Sequence[date], today: date, every: int
) -> int:
    """How many consecutive successful intervals back from the latest checkin."""
    if not checkin_dates:
        return 0
    sorted_desc = sorted(set(checkin_dates), reverse=True)
    streak = 1
    prev = sorted_desc[0]
    for d in sorted_desc[1:]:
        if (prev - d).days <= every:
            streak += 1
            prev = d
        else:
            break
    # Reset streak to 0 if currently overdue (past the window from the latest)
    if (today - sorted_desc[0]).days > every:
        return 0
    return streak


def _status_for(habit: Habit, today: date, checkin_dates: set[date]) -> HabitStatusOut:
    done_today = today in checkin_dates
    last_checked_on = max(checkin_dates) if checkin_dates else None

    if habit.cadence_kind == "daily":
        return HabitStatusOut(
            status="done" if done_today else "due_today",
            done_today=done_today,
            last_checked_on=last_checked_on,
            period_count=1 if done_today else 0,
            period_target=1,
            period_ends_on=today,
            streak=_compute_daily_streak(checkin_dates, today),
        )

    if habit.cadence_kind == "weekly":
        target = habit.weekly_target or 1
        monday, sunday = _iso_week_bounds(today)
        this_week = {d for d in checkin_dates if monday <= d <= sunday}
        count = len(this_week)
        days_left_in_week = (sunday - today).days  # 0 on Sunday
        needed = target - count

        if count >= target:
            status: str = "done"
        elif needed > days_left_in_week + 1:
            status = "overdue"
        elif needed >= days_left_in_week + 1:
            status = "due_today"
        elif needed >= max(1, days_left_in_week):
            status = "due_today" if days_left_in_week == 0 else "ok"
        else:
            status = "ok"

        if done_today and count < target:
            status = "ok"
        if not done_today and (sunday - today).days == 0 and count < target:
            status = "due_today"

        return HabitStatusOut(
            status=status,  # type: ignore[arg-type]
            done_today=done_today,
            last_checked_on=last_checked_on,
            period_count=count,
            period_target=target,
            period_ends_on=sunday,
            streak=_compute_weekly_streak(sorted(checkin_dates), today, target),
        )

    # interval
    every = habit.interval_days or 2
    if last_checked_on is None:
        return HabitStatusOut(
            status="due_today",
            done_today=False,
            last_checked_on=None,
            days_since_last=None,
            days_until_due=0,
            streak=0,
        )
    days_since = (today - last_checked_on).days
    days_until_due = every - days_since  # 0 means due today; negative = overdue
    if done_today:
        status = "done"
    elif days_until_due <= -1:
        status = "overdue"
    elif days_until_due == 0:
        status = "due_today"
    elif days_until_due == 1:
        status = "due_today"  # tomorrow becomes overdue; nudge today
    else:
        status = "ok"
    return HabitStatusOut(
        status=status,  # type: ignore[arg-type]
        done_today=done_today,
        last_checked_on=last_checked_on,
        days_since_last=days_since,
        days_until_due=days_until_due,
        streak=_compute_interval_streak(sorted(checkin_dates), today, every),
    )


async def list_with_status(
    db: AsyncSession, *, user: User
) -> list[HabitWithStatusOut]:
    today = day_for_user(user.timezone)

    habits = list(
        (
            await db.execute(
                select(Habit)
                .where(Habit.user_id == user.id, Habit.archived_at.is_(None))
                .order_by(Habit.sort_order, Habit.created_at)
            )
        )
        .scalars()
        .all()
    )
    if not habits:
        return []

    habit_ids = [h.id for h in habits]
    # Load enough checkins to evaluate status + a useful streak window.
    horizon = today - timedelta(days=120)
    checkin_rows = list(
        (
            await db.execute(
                select(HabitCheckin.habit_id, HabitCheckin.occurred_on).where(
                    HabitCheckin.habit_id.in_(habit_ids),
                    HabitCheckin.occurred_on >= horizon,
                )
            )
        )
        .all()
    )
    by_habit: dict[uuid.UUID, set[date]] = defaultdict(set)
    for habit_id, occurred_on in checkin_rows:
        by_habit[habit_id].add(occurred_on)

    return [
        HabitWithStatusOut(
            habit=_to_habit_out(h),
            status=_status_for(h, today, by_habit.get(h.id, set())),
        )
        for h in habits
    ]


async def toggle_checkin_today(
    db: AsyncSession, *, user: User, habit: Habit
) -> tuple[bool, HabitWithStatusOut]:
    """Returns (now_done, fresh_status). Tap = toggle today's checkin."""
    today = day_for_user(user.timezone)
    existing = (
        await db.execute(
            select(HabitCheckin).where(
                HabitCheckin.habit_id == habit.id,
                HabitCheckin.occurred_on == today,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        await db.delete(existing)
        now_done = False
    else:
        try:
            db.add(
                HabitCheckin(
                    habit_id=habit.id,
                    user_id=user.id,
                    occurred_on=today,
                )
            )
            await db.flush()
            now_done = True
        except IntegrityError:
            await db.rollback()
            now_done = True  # someone else created it concurrently

    # Recompute status for response
    horizon = today - timedelta(days=120)
    dates = set(
        (
            await db.execute(
                select(HabitCheckin.occurred_on).where(
                    HabitCheckin.habit_id == habit.id,
                    HabitCheckin.occurred_on >= horizon,
                )
            )
        )
        .scalars()
        .all()
    )
    status = _status_for(habit, today, dates)
    return now_done, HabitWithStatusOut(habit=_to_habit_out(habit), status=status)


async def get_owned(
    db: AsyncSession, *, user: User, habit_id: uuid.UUID
) -> Habit | None:
    return (
        await db.execute(
            select(Habit).where(
                Habit.id == habit_id,
                Habit.user_id == user.id,
                Habit.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
