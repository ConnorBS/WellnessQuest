from __future__ import annotations

from datetime import date, datetime, timezone

from app.services.time_utils import day_bounds_for_user, day_for_user


def test_day_for_user_uses_local_zone():
    # 03:30 UTC on 2026-03-08 = 22:30 on 2026-03-07 in America/New_York
    instant = datetime(2026, 3, 8, 3, 30, tzinfo=timezone.utc)
    assert day_for_user("America/New_York", instant) == date(2026, 3, 7)
    assert day_for_user("UTC", instant) == date(2026, 3, 8)


def test_day_bounds_around_dst_spring_forward():
    # DST in the US: 2026-03-08 -- the local "day" is 23 hours long, not 24.
    start, end = day_bounds_for_user("America/New_York", date(2026, 3, 8))
    delta = end - start
    assert delta.total_seconds() == 23 * 3600


def test_day_bounds_fall_back():
    # DST end 2026-11-01 -- 25-hour local day.
    start, end = day_bounds_for_user("America/New_York", date(2026, 11, 1))
    assert (end - start).total_seconds() == 25 * 3600
