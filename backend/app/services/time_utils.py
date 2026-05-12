from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    return datetime.now(tz=UTC)


def day_for_user(user_timezone: str, instant: datetime | None = None) -> date:
    """Return the calendar date in the user's timezone for `instant` (defaults to now)."""
    if instant is None:
        instant = utcnow()
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=UTC)
    return instant.astimezone(ZoneInfo(user_timezone)).date()


def day_bounds_for_user(user_timezone: str, day: date) -> tuple[datetime, datetime]:
    """Return UTC (start, end_exclusive) covering the user's local `day`."""
    tz = ZoneInfo(user_timezone)
    start_local = datetime(day.year, day.month, day.day, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(UTC), end_local.astimezone(UTC)
