from __future__ import annotations

from app.services.xp_service import _level_for_xp


def test_level_curve_monotonic():
    last = 1
    for xp in range(0, 5000, 50):
        lvl = _level_for_xp(xp)
        assert lvl >= last
        last = lvl


def test_level_thresholds():
    # cum xp for level n: 100 * n * (n-1) / 2
    assert _level_for_xp(0) == 1
    assert _level_for_xp(99) == 1
    assert _level_for_xp(100) == 2  # threshold for level 2: 100 * 1 * 2 / 2 = 100
    assert _level_for_xp(299) == 2
    assert _level_for_xp(300) == 3  # threshold for level 3: 100 * 2 * 3 / 2 = 300
