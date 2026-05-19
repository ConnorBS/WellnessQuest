"""Generate `backend/app/data/titles_catalog.json` from curated content
plus a rank-progression backfill so every ladder lands at a consistent
size.

Run from `backend/`:

    python -m scripts.generate_titles

The output JSON is committed to the repo and synced into the database by
the FastAPI lifespan hook on startup. This script never runs in prod —
the only artifact prod consumes is the JSON file.

Design:

A user should unlock roughly **one title per day** after the onboarding
batch, not a flurry at every milestone. Two earlier failures we're
fixing here:

1. **Multiple titles per same threshold.** The previous build had eight
   walking titles fire in the first 80 minutes of walking and four
   active-days titles fire on day 3. Curated content alone had 11 titles
   at active_days=365 and 9 at active_days=100.

2. **Boring auto-generated names.** Generated tier ladders produced
   labels like "Two Reads", "Level 2", and "Veteran of the Walking" —
   not titles you'd want to wear. Curated names ("Marvin's Mood",
   "Walking Carpet", "Blue Pill") are the standard now.

Fix shape:

- Each ladder has a **cap** (e.g. active_days = 25, exercise per type = 12).
  Curated content fills the ladder up to the cap; if curated exceeds the
  cap, the surplus is dropped from this build (kept in `curated_titles.py`
  for a future bigger ladder — soft-archived in the DB on next sync).
- If curated is **under** the cap, we top up with a rank-progression
  backfill ("Apprentice Hydrator", "Master Streaker") using
  `RANK_NAMES`. Names are character-y enough to wear; the rank ladder
  is the same across categories so it reads as progression.
- After assembly, we **redistribute thresholds on a log scale** within
  each ladder. Descriptions are regenerated to match the new threshold.
  This guarantees one title per threshold and spreads them across
  years.

Content rules (must be respected here and in `curated_titles.py`):

- No belittling. No promoting unhealthy living.
- No politics / religion / history references — fictional, cultural,
  current only.
- Avoid verbatim trademarked phrases / song lyrics; paraphrase.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from scripts.curated_titles import CURATED_ENTRIES

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Guild-rank progression — reused everywhere a ladder needs more entries
# than curated provides. Index N is the Nth-rank tier. Extended to 60 so
# most ladders fit one full pass without recycling.
RANK_NAMES = [
    # Foundations (0-9)
    "Newbie", "Sophomore", "Junior", "Cadet", "Recruit",
    "Initiate", "Apprentice", "Acolyte", "Journeyman", "Adept",
    # Skilled (10-19)
    "Skilled", "Trained", "Veteran", "Senior", "Specialist",
    "Expert", "Master", "Grandmaster", "Champion", "Elite",
    # Honored (20-29)
    "Heroic", "Honored", "Distinguished", "Renowned", "Storied",
    "Legendary", "Mythic", "Ascendant", "Transcendent", "Eternal",
    # Cosmic (30-39)
    "Cosmic", "Stellar", "Galactic", "Celestial", "Divine",
    "Primordial", "Immortal", "Boundless", "Apex", "Paragon",
    # Beyond (40-49)
    "Aeonic", "Empyrean", "Astral", "Sovereign", "Imperial",
    "Regnant", "Supreme", "Ultimate", "Omega", "Singular",
    # Outer realm (50-59)
    "Eldritch", "Mythical", "Fabled", "Ancient", "Primal",
    "Hallowed", "Anointed", "Crowned", "Enshrined", "Apotheotic",
]
RANK_PHASE_SIZE = len(RANK_NAMES)

# Each ladder has a target size. Curated fills the ladder up to this
# number; backfill makes up the difference. Curated past the cap is
# dropped from this build (kept in `curated_titles.py` for a future
# bigger ladder — soft-archived in the DB on next sync).
#
# Targets are sized so the full catalog hits ~3,000 titles, pacing out
# to roughly 2 unlocks/day over four years for a typical user
# (accounting for the fact that a user only progresses through a
# handful of exercise types, not all 25).
LADDER_TARGETS: dict[str, int] = {
    "active_days": 160,
    "login_days": 150,
    "lifetime_water_ml": 100,
    "lifetime_active_minutes": 100,
    "streak_water_days_current": 100,
    "streak_water_days_longest": 80,
    "streak_activity_days_current": 100,
    "streak_activity_days_longest": 80,
    "water_entry_count": 100,
    "activity_entry_count": 100,
    "food_entry_count": 100,
    "habit_checkin_count": 150,
    "weight_logs_count": 50,
    "bp_logs_count": 50,
    "level": 100,
    "xp_total": 80,
}
EXERCISE_TYPE_TARGET = 55

# Maps each tracked condition_kind to the category its ladder lives in.
# Used to materialize ladders that have zero curated content (e.g.
# weight_logs_count starts with no curated rows but the ladder still
# needs to exist).
LADDER_CATEGORY: dict[str, str] = {
    "active_days": "active_days",
    "login_days": "login_days",
    "lifetime_water_ml": "lifetime_water",
    "lifetime_active_minutes": "lifetime_activity",
    "streak_water_days_current": "streak_water",
    "streak_water_days_longest": "streak_water",
    "streak_activity_days_current": "streak_activity",
    "streak_activity_days_longest": "streak_activity",
    "water_entry_count": "entry_count",
    "activity_entry_count": "entry_count",
    "food_entry_count": "entry_count",
    "habit_checkin_count": "habit",
    "weight_logs_count": "weight_milestone",
    "bp_logs_count": "bp_milestone",
    "level": "level",
    "xp_total": "level",
}

# Per-ladder noun phases used in backfill names. Slot `k` uses
# `nouns[k // RANK_PHASE_SIZE]` so a 150-title ladder cycles cleanly
# through 60 ranks × 3 nouns ("Newbie Day-Walker" → "Apotheotic
# Day-Walker" → "Newbie Time-Strider" → …). Each list needs enough
# entries to cover the ladder's target divided by RANK_PHASE_SIZE,
# rounded up.
LADDER_NOUNS: dict[str, list[str]] = {
    "active_days": ["Day-Walker", "Time-Strider", "Eon-Marker"],
    "login_days": ["Returner", "Loyal Caller", "Eternal Visitor"],
    "lifetime_water_ml": ["Hydration Sage", "Tide-Caller", "Ocean's Heir"],
    "lifetime_active_minutes": ["Iron Mover", "Endurance Adept", "Tireless Titan"],
    "streak_water_days_current": ["Hydrator", "Wave-Rider", "Tidewalker"],
    "streak_water_days_longest": ["Aquanaut", "Deep-Diver", "Tide Lord"],
    "streak_activity_days_current": ["Streaker", "Pace-Setter", "Eternal Engine"],
    "streak_activity_days_longest": ["Marathoner", "Iron Strider", "Forever Mover"],
    "water_entry_count": ["Aqua-Logger", "Drop-Counter", "River-Recorder"],
    "activity_entry_count": ["Sweat-Logger", "Move-Counter", "Effort Archivist"],
    "food_entry_count": ["Meal Tracker", "Calorie Scribe", "Sustenance Sage"],
    "habit_checkin_count": ["Habit-Keeper", "Ritual-Maker", "Daily Devoter"],
    "weight_logs_count": ["Scale-Keeper", "Mass-Marker"],
    "bp_logs_count": ["Pressure-Reader", "Pulse-Keeper"],
    "level": ["Adventurer", "Wayfarer", "Pathfinder"],
    "xp_total": ["XP Hoarder", "Point Plunderer"],
}

# Exercise types we ship backfill for, even when no curated content
# exists. Free-text exercises outside this list won't get titles — that
# matches the current condition_kind semantics where exercise_type is a
# fixed string lookup.
EXERCISE_NOUN: dict[str, str] = {
    "Walking": "Stroller",
    "Running": "Runner",
    "Cycling": "Cyclist",
    "Cardio": "Cardio Knight",
    "Stretching": "Stretcher",
    "Strength": "Lifter",
    "Yoga": "Yogi",
    "Pilates": "Core-Forger",
    "Swimming": "Swimmer",
    "HIIT": "Interval Hero",
    "Rowing": "Rower",
    "Climbing": "Climber",
    "Hiking": "Trailblazer",
    "Dance": "Dancer",
    "Boxing": "Boxer",
    "Martial Arts": "Martial Artist",
    "Skating": "Skater",
    "Skiing": "Skier",
    "Surfing": "Surfer",
    "Tennis": "Tennis Ace",
    "Soccer": "Soccer Pro",
    "Basketball": "Hooper",
    "Volleyball": "Spiker",
    "Gardening": "Gardener",
    "Cleaning": "Tidy Titan",
}

# Each ladder has a (lo, hi) log-scale threshold range. Picked so the
# bottom tier fires after a real engagement (not on first session) and
# the top tier lives in the long tail past year 4 — a typical user
# clears ~60-70% of each ladder in four years, leaving the rest for
# power users.
LADDER_RANGE: dict[str, tuple[int, int]] = {
    "active_days": (1, 30_000),
    "login_days": (1, 30_000),
    "lifetime_water_ml": (500, 1_000_000_000),
    "lifetime_active_minutes": (30, 10_000_000),
    "streak_water_days_current": (1, 10_000),
    "streak_water_days_longest": (1, 10_000),
    "streak_activity_days_current": (1, 10_000),
    "streak_activity_days_longest": (1, 10_000),
    "water_entry_count": (5, 500_000),
    "activity_entry_count": (5, 500_000),
    "food_entry_count": (5, 500_000),
    "habit_checkin_count": (5, 500_000),
    "weight_logs_count": (5, 20_000),
    "bp_logs_count": (5, 20_000),
    "level": (3, 100),
    "xp_total": (500, 100_000_000),
    "exercise_type_minutes": (15, 200_000),
}

DESCRIPTION_TEMPLATES: dict[str, str] = {
    "active_days": "Log something on {threshold:,} distinct days.",
    "login_days": "Sign in on {threshold:,} distinct days.",
    "lifetime_water_ml": "Log {threshold:,} ml of water in total.",
    "lifetime_active_minutes": "Log {threshold:,} minutes of activity in total.",
    "streak_water_days_current": "Hold a water-goal streak of {threshold:,} consecutive days.",
    "streak_water_days_longest": "Reach a longest water streak of {threshold:,} days.",
    "streak_activity_days_current": "Hold an activity-goal streak of {threshold:,} consecutive days.",
    "streak_activity_days_longest": "Reach a longest activity streak of {threshold:,} days.",
    "water_entry_count": "Record {threshold:,} water entries.",
    "activity_entry_count": "Record {threshold:,} activity entries.",
    "food_entry_count": "Record {threshold:,} food entries.",
    "habit_checkin_count": "Complete {threshold:,} habit check-ins.",
    "weight_logs_count": "Log {threshold:,} weight entries.",
    "bp_logs_count": "Log {threshold:,} blood pressure readings.",
    "level": "Reach level {threshold}.",
    "xp_total": "Accumulate {threshold:,} XP total.",
    "exercise_type_minutes": "Log {minutes:,} minutes of {exercise_type}.",
}

OPT_OUT_GROUP_FOR_KIND: dict[str, str] = {
    "weight_logs_count": "weight_loss",
    "bp_logs_count": "bp",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _rarity_for_index(i: int, n: int) -> str:
    if n <= 1:
        return "common"
    pct = (i + 1) / n
    if pct >= 0.96:
        return "legendary"
    if pct >= 0.82:
        return "epic"
    if pct >= 0.58:
        return "rare"
    if pct >= 0.32:
        return "uncommon"
    return "common"


def _ladder_key(t: dict[str, Any]) -> tuple[str, str, str]:
    """Group titles into the ladder they compete on. Exercise-type titles
    are per (category, kind, exercise_type) — each exercise gets its own
    independent ladder. Everything else is per (category, kind)."""
    params = t.get("condition_params") or {}
    if t["condition_kind"] == "exercise_type_minutes":
        return (t["category"], t["condition_kind"], str(params.get("exercise_type", "")))
    return (t["category"], t["condition_kind"], "")


def _original_threshold(t: dict[str, Any]) -> int:
    params = t.get("condition_params") or {}
    if "minutes" in params:
        return int(params.get("minutes", 0))
    return int(params.get("threshold", 0))


def _log_spread(n: int, lo: int, hi: int) -> list[int]:
    """Logarithmically space n integers from lo..hi (inclusive). Strictly
    increasing — collapses on small ranges by bumping each value to
    `prev + 1` to avoid threshold collisions."""
    if n <= 0:
        return []
    if n == 1:
        return [lo]
    if hi <= lo:
        return [lo + i for i in range(n)]
    ratio = (hi / lo) ** (1 / (n - 1))
    out = [int(round(lo * (ratio ** i))) for i in range(n)]
    for i in range(1, len(out)):
        if out[i] <= out[i - 1]:
            out[i] = out[i - 1] + 1
    return out


# ---------------------------------------------------------------------------
# Backfill
# ---------------------------------------------------------------------------


def _make_backfill_row(
    *,
    slug: str,
    name: str,
    category: str,
    condition_kind: str,
    rank_index: int,
    total: int,
    exercise_type: str | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"threshold": 0}
    if exercise_type is not None:
        params = {"exercise_type": exercise_type, "minutes": 0}
    return {
        "slug": slug,
        "name": name,
        "description": "",  # filled by _redistribute
        "category": category,
        "rarity": _rarity_for_index(rank_index, total),
        "condition_kind": condition_kind,
        "condition_params": params,
        "opt_out_group": OPT_OUT_GROUP_FOR_KIND.get(condition_kind),
        "is_secret": False,
        "sort_order": rank_index,
    }


def _name_for_slot(slot: int, nouns: list[str]) -> str:
    """Compose a backfill name from rank + noun phase. Slot `k` uses
    `RANK_NAMES[k % RANK_PHASE_SIZE]` paired with `nouns[k // RANK_PHASE_SIZE]`,
    so each (rank, noun) combination is unique. Long ladders cycle
    cleanly: 0-59 use noun[0], 60-119 use noun[1], etc."""
    rank = RANK_NAMES[slot % RANK_PHASE_SIZE]
    phase = slot // RANK_PHASE_SIZE
    if phase >= len(nouns):
        # Defensive fallback — config error; cap at the last noun and
        # tag with the phase index so duplicates are visible.
        return f"{rank} {nouns[-1]} {phase + 1}"
    return f"{rank} {nouns[phase]}"


def _backfill_ladder(
    *,
    category: str,
    condition_kind: str,
    start_index: int,
    target: int,
    nouns: list[str],
    slug_prefix: str,
    used_slugs: set[str],
    exercise_type: str | None = None,
) -> list[dict[str, Any]]:
    """Generate rank-progression rows from `start_index` up to `target`.
    `start_index` is how many curated titles already occupy the bottom of
    the ladder — the backfill picks ranks from there so the curator's
    iconic low-tier titles aren't overlapped by "Newbie X" labels."""
    rows: list[dict[str, Any]] = []
    for i in range(start_index, target):
        name = _name_for_slot(i, nouns)
        slug = f"{slug_prefix}_bf_{i}"
        # Defensive: avoid slug collisions in pathological cases (e.g.
        # someone hand-wrote a curated slug matching our format).
        attempt = 0
        original_slug = slug
        while slug in used_slugs:
            attempt += 1
            slug = f"{original_slug}_{attempt}"
        used_slugs.add(slug)
        rows.append(
            _make_backfill_row(
                slug=slug,
                name=name,
                category=category,
                condition_kind=condition_kind,
                rank_index=i,
                total=target,
                exercise_type=exercise_type,
            )
        )
    return rows


# ---------------------------------------------------------------------------
# Redistribute
# ---------------------------------------------------------------------------


def _redistribute(all_titles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Spread each ladder's titles across its log-scale range. Within a
    ladder, the original threshold order is preserved (so the curator's
    intent of "Captain's Log unlocks before Live Long" survives), but
    the actual numbers respaced so titles don't pile up at the bottom.

    Descriptions are regenerated to match the new threshold. Rarity is
    left alone — that's a curator decision tied to the title's name.

    Onboarding and `signup` are exempt; those need to fire on the first
    action, not at some redistributed milestone."""
    by_ladder: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for t in all_titles:
        by_ladder[_ladder_key(t)].append(t)

    out: list[dict[str, Any]] = []
    for (category, kind, ex_type), titles in by_ladder.items():
        if category == "onboarding" or kind == "signup":
            out.extend(titles)
            continue
        if kind not in LADDER_RANGE:
            out.extend(titles)
            continue

        # Curated titles (with real thresholds) take the bottom of the
        # ladder; backfill ranks (threshold=0) sort to the top. The
        # 10^12 sentinel for threshold==0 forces backfill last regardless
        # of how high curated thresholds went.
        titles.sort(
            key=lambda t: (
                _original_threshold(t) if _original_threshold(t) > 0 else 10**12,
                t.get("sort_order", 0),
                t["name"],
            )
        )

        lo, hi = LADDER_RANGE[kind]
        new_thresholds = _log_spread(len(titles), lo, hi)

        for slot, (t, th) in enumerate(zip(titles, new_thresholds, strict=True)):
            new_params = dict(t.get("condition_params") or {})
            if kind == "exercise_type_minutes":
                new_params["minutes"] = th
            else:
                new_params["threshold"] = th
            t["condition_params"] = new_params

            tmpl = DESCRIPTION_TEMPLATES.get(kind)
            if tmpl:
                if kind == "exercise_type_minutes":
                    t["description"] = tmpl.format(
                        minutes=th, exercise_type=ex_type
                    )
                else:
                    t["description"] = tmpl.format(threshold=th)

            t["sort_order"] = slot
        out.extend(titles)
    return out


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def _target_for(category: str, kind: str, ex_type: str) -> int:
    if kind == "exercise_type_minutes":
        return EXERCISE_TYPE_TARGET
    return LADDER_TARGETS.get(kind, 0)


def _slug_prefix_for(category: str, kind: str, ex_type: str) -> str:
    if kind == "exercise_type_minutes":
        return f"ex_{_slug(ex_type)}"
    return f"{category}_{kind}"


def _nouns_for(category: str, kind: str, ex_type: str) -> list[str]:
    if kind == "exercise_type_minutes":
        return [EXERCISE_NOUN.get(ex_type, "Athlete")]
    return LADDER_NOUNS.get(kind, ["Adept"])


def _opt_out_for(kind: str) -> str | None:
    return OPT_OUT_GROUP_FOR_KIND.get(kind)


def build_all() -> list[dict[str, Any]]:
    """Cap each curated ladder to its target, then backfill thinner ladders
    with rank-progression titles. Add full backfill ladders for the
    canonical exercise types that have no curated content, and for any
    ladder declared in LADDER_TARGETS that has zero curated rows."""
    # Group curated by ladder
    by_ladder: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for entry in CURATED_ENTRIES:
        by_ladder[_ladder_key(entry)].append(dict(entry))

    # Make sure every ladder we want to ship exists, even with zero
    # curated content. Otherwise pure-backfill ladders (e.g. weight_logs)
    # never enter the main loop and get silently dropped.
    for kind, category in LADDER_CATEGORY.items():
        by_ladder.setdefault((category, kind, ""), [])

    used_slugs: set[str] = set()
    result: list[dict[str, Any]] = []

    for ladder_key, titles in by_ladder.items():
        category, kind, ex_type = ladder_key

        if category == "onboarding":
            for t in titles:
                used_slugs.add(t["slug"])
                result.append(t)
            continue

        target = _target_for(category, kind, ex_type)
        if target <= 0:
            for t in titles:
                used_slugs.add(t["slug"])
                result.append(t)
            continue

        titles.sort(
            key=lambda t: (
                _original_threshold(t),
                t.get("sort_order", 0),
                t["name"],
            )
        )
        capped = titles[:target]
        for t in capped:
            used_slugs.add(t["slug"])
            result.append(t)

        if len(capped) < target:
            result.extend(
                _backfill_ladder(
                    category=category,
                    condition_kind=kind,
                    start_index=len(capped),
                    target=target,
                    nouns=_nouns_for(category, kind, ex_type),
                    slug_prefix=_slug_prefix_for(category, kind, ex_type),
                    used_slugs=used_slugs,
                    exercise_type=ex_type
                    if kind == "exercise_type_minutes"
                    else None,
                )
            )

    # Add ladders for exercise types with no curated content
    curated_ex_types = {
        ex_type for (cat, kind, ex_type) in by_ladder
        if kind == "exercise_type_minutes" and ex_type
    }
    for ex_type in EXERCISE_NOUN:
        if ex_type in curated_ex_types:
            continue
        result.extend(
            _backfill_ladder(
                category="exercise_type",
                condition_kind="exercise_type_minutes",
                start_index=0,
                target=EXERCISE_TYPE_TARGET,
                nouns=[EXERCISE_NOUN[ex_type]],
                slug_prefix=f"ex_{_slug(ex_type)}",
                used_slugs=used_slugs,
                exercise_type=ex_type,
            )
        )

    return result


def main() -> None:
    all_titles = build_all()

    # Sanity check: no duplicate slugs
    seen: set[str] = set()
    for t in all_titles:
        if t["slug"] in seen:
            raise SystemExit(f"duplicate slug: {t['slug']}")
        seen.add(t["slug"])

    all_titles = _redistribute(all_titles)
    all_titles.sort(
        key=lambda t: (t["category"], t.get("sort_order", 0), t["slug"])
    )

    floor = 300
    if len(all_titles) < floor:
        raise SystemExit(
            f"Catalog dropped below {floor} titles (got {len(all_titles)}). "
            "Check `curated_titles.py` and the LADDER_TARGETS configuration."
        )

    out_path = (
        Path(__file__).resolve().parent.parent / "app" / "data" / "titles_catalog.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(all_titles, indent=2) + "\n", encoding="utf-8")

    curated_count = sum(
        1 for t in all_titles if not t["slug"].rsplit("_bf_", 1)[-1].isdigit()
        or "_bf_" not in t["slug"]
    )
    backfill_count = len(all_titles) - curated_count
    print(
        f"Wrote {len(all_titles)} titles to {out_path} "
        f"(curated≈{curated_count}, backfill≈{backfill_count})"
    )


if __name__ == "__main__":
    main()
