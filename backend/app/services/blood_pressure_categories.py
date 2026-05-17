"""AHA 2017 blood pressure classification.

Kept in Python only as a parity safeguard so the test suite can lock the rules
against future drift. The API does NOT return category on entries — the
frontend computes it at render time (see ``frontend/src/lib/bp.ts``).
"""

from __future__ import annotations

from enum import StrEnum


class BPCategory(StrEnum):
    NORMAL = "normal"
    ELEVATED = "elevated"
    STAGE_1 = "stage_1"
    STAGE_2 = "stage_2"
    CRISIS = "crisis"


def classify(systolic: int, diastolic: int) -> BPCategory:
    if systolic >= 180 or diastolic >= 120:
        return BPCategory.CRISIS
    if systolic >= 140 or diastolic >= 90:
        return BPCategory.STAGE_2
    if systolic >= 130 or diastolic >= 80:
        return BPCategory.STAGE_1
    if 120 <= systolic <= 129 and diastolic < 80:
        return BPCategory.ELEVATED
    return BPCategory.NORMAL
