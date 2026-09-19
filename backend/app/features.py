"""Registry of user-toggleable features.

Each metric/tracker in the app has a feature key. A user can enable or disable
any of them; a disabled feature is hidden everywhere (dashboard card, top-nav
link, and settings entry). Per-user overrides live in the ``user_feature_prefs``
table — absence of a row means "use the default here". This module is the single
source of truth for the toggle set and their defaults.

New trackers append their FeatureDef here as they land.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FeatureDef:
    key: str
    label: str
    default_enabled: bool = True


# Order defines display order in Settings → Trackers.
FEATURES: tuple[FeatureDef, ...] = (
    FeatureDef("water", "Water"),
    FeatureDef("food", "Food"),
    FeatureDef("activity", "Activity"),
    FeatureDef("steps", "Steps"),
    FeatureDef("sleep", "Sleep"),
    FeatureDef("habits", "Habits"),
    FeatureDef("weight", "Weight"),
    FeatureDef("blood_pressure", "Blood pressure"),
    FeatureDef("mood", "Mood"),
    FeatureDef("period", "Period"),
    # Off by default: a sexual-activity log is not something to surface in
    # someone's app without them asking for it. Opt in under
    # Settings -> Trackers.
    FeatureDef("intimacy", "Sexual activity", default_enabled=False),
    FeatureDef("pain", "Pain & symptoms"),
    FeatureDef("reflux", "Acid reflux"),
    FeatureDef("medications", "Medications"),
    FeatureDef("tiny_wins", "Tiny wins"),
    FeatureDef("journal", "Journal"),
)

FEATURE_KEYS: frozenset[str] = frozenset(f.key for f in FEATURES)


def default_features() -> dict[str, bool]:
    """A fresh map of every feature key to its default enabled state."""
    return {f.key: f.default_enabled for f in FEATURES}
