"""Generate `backend/app/data/titles_catalog.json` from tiered milestone
definitions + the curated content in `curated_titles.py`.

Run from `backend/`:

    python -m scripts.generate_titles

The output JSON is committed to the repo and synced into the database by
the FastAPI lifespan hook on startup. This script never runs in prod —
the only artifact prod consumes is the JSON file.

Content rules (must be respected by anything added here or in
`curated_titles.py`):

- No belittling. No promoting unhealthy living.
- No politics / religion / history references — keep it fictional, cultural,
  and current.
- Avoid verbatim trademarked phrases or full song lyrics; use evocative
  paraphrases.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.curated_titles import CURATED_ENTRIES


def _rarity_for_index(i: int, n: int) -> str:
    """Map a tier index (0..n-1) to a rarity bucket so the tier ladder feels
    like increasing prestige rather than a flat list."""
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


# --- name banks (mostly straight milestone vibes; some pop culture flavor) ---

WATER_NAMES = [
    "First Sip", "Quick Quench", "Half Cup", "Top of the Glass", "Glass Cleared",
    "First Cup Done", "Thirst Tackled", "Pint Pioneer", "Liquid Lap", "Half Litre Hero",
    "Litre Logged", "Two-Up", "Three's the Charm", "Hydration Habit", "Pint Pro",
    "Five-Liter Foundation", "Pitcher Filler", "Steady Hydrator", "Aqua Apprentice", "Daily Driver",
    "Watering Wing", "Wellspring", "Quench Quartermaster", "Tidal Apprentice", "10L Camel",
    "Aqua-Adept", "Stream Strider", "Brook Walker", "Creek Keeper", "Fountain Friend",
    "20L Hydromancer", "Hydrosmith", "Bottle Knight", "Glass Half Full", "Spring Singer",
    "30L Initiate", "Pool Wader", "Aqueduct Apprentice", "Cistern Captain", "Spring Steward",
    "50L Sage", "Niagara Initiate", "Cascade Cadet", "Hydration Hero", "Drink Driver",
    "75L Devotee", "Wave Walker", "Tide Tracker", "Estuary Explorer", "River Reader",
    "100L Reservoir", "Watershed Warden", "Loch Wanderer", "Lake Lurker", "Cataract Climber",
    "150L Aquanaut", "Stream Sentinel", "Brook Baron", "Creek Conqueror", "Fountain Forger",
    "200L Hydroknight", "Wave Wright", "Tide Tactician", "Surge Strategist", "Current Conductor",
    "300L Tsunami-in-Training", "Wave Worker", "Tide Lord", "Surge Master", "Mariner of Mugs",
    "500L Aquifer", "Hydro-Hero", "Aquatic Ace", "Submarine Sipper", "Deep-Sea Drinker",
    "750L Tsunami Tactician", "Surge Sovereign", "Wave Warden", "Storm Sipper", "Squall Squad",
    "1000L (One Cubic Meter) Camel", "Ton-Pourer", "Reservoir Regent", "Aqua Architect", "Hydrolord",
    "1500L Sea-Strider", "Ocean Apprentice", "Bay Boss", "Gulf Guardian", "Cove Commander",
    "2000L Hydro-Magus", "Tide Touched", "Surge Sealed", "Current Crowned", "Pressure Tamer",
    "3000L Watercaller", "Squall Sage", "Storm Sage", "Drizzle Druid", "Mist Master",
    "5000L Aqua-Avatar", "Hydrosaint", "Liquid Legend", "Sea of Stories", "Bottomless Brigadier",
]

ACTIVITY_NAMES = [
    "First Steps", "Warm-Up", "Five Min Friend", "Ten Min Trekker", "Quarter-Hour Hero",
    "Twenty-Minute Mover", "Half-Hour Honoree", "Forty-Five Famous", "First Hour Done", "Steady Mover",
    "Two-Hour Adept", "Triple Threat", "Four Hours In", "Five-Hour Sprinter", "Half-Day Hustler",
    "10-Hour Athlete", "Workout Wing", "12-Hour Tracker", "Active Apprentice", "Movement Magus",
    "20-Hour Engine", "Quarter-Day Done", "30-Hour Hauler", "Constant Cardio", "Marathon-in-Training",
    "Full Day Active", "60-Hour Sustainer", "Three-Day Mover", "100-Hour Veteran", "Four-Day Drift",
    "150-Hour Heart", "Six-Day Sweeper", "200-Hour Mover", "Eight-Day Engine", "300-Hour Stalwart",
    "12-Day Equivalent", "500-Hour Athlete", "Three-Week Total", "750-Hour Adept", "1000-Hour Hero",
    "Six-Week Total", "1500-Hour Tower", "Two-Month Mover", "2000-Hour Eternal", "Three-Month Engine",
    "Movement Maestro", "Cardio Captain", "Stride Sage", "Step Sovereign", "Pace Patriarch",
    "Active Architect", "Move Marshal", "Pace Pirate", "Action Anchor", "Athleta Ace",
    "Tireless Tracker", "Energy Engineer", "Active Avatar", "Tireless Templar", "Endurance Enthusiast",
    "Stride Strategist", "Movement Mage", "Cardio Cleric", "Pace Pioneer", "Endurance Engineer",
    "Action Archon", "Movement Mystic", "Endurance Elite", "Active Astrolabe", "Tireless Titan",
    "Eternal Engine", "Forever Foot", "Eon Endurer", "Iron Anchor", "Active Almanac",
    "Endurance Eternity", "Tireless Tower", "Active Atlas", "Eternal Ember", "Boundless Body",
    "Active Apex", "Endurance Eclipse", "Forever Forward", "Eternal Engineer", "Boundless Beat",
    "Active Avatar (Higher Plane)", "Eternal Echo", "Endurance Empire", "Cardio Constellation", "Pace Paragon",
    "Endurance Enchanter", "Active Alchemist", "Tireless Theurge", "Boundless Body II", "Active Astral",
    "Endurance Era", "Boundless Beacon", "Active Astronaut", "Tireless Trailblazer", "Endurance Emperor",
    "Active Apotheosis", "Boundless Body III", "Endurance Eclipse II", "Active Aurora", "Tireless Cosmos",
]

LOGIN_DAY_NAMES = [
    "Day One", "Day Two", "Day Three", "Four Day Visitor", "Five Day Streak Hopeful",
    "Six Day Reg", "Seven Day Friend", "Ten Day Tracker", "Two-Week Visitor", "Three Week Returnee",
    "Month Marker", "Six Week Friend", "Two-Month Member", "Three-Month Member", "Hundred Day Hero",
    "Four-Month Member", "Half-Year Mover", "Eight-Month Stalwart", "Three-Hundred-Days Strong", "Year One",
    "Year-and-a-Half", "Two-Year Tracker", "Hundredth Login", "500 Days Strong", "750 Login Sage",
    "Thousand Day Tracker", "Eternal Login", "Forever Friend", "Time Traveler", "Daily Companion",
    "Constant Caller", "Routine Reigner", "Visitor of Vigil", "Loyal Logger", "Reliable Returnee",
    "Steady Showup", "Habitual Hello", "Consistent Companion", "Tracker Titan", "Login Legend",
    "Ledger Lord", "Diary Don", "Reliable Resident", "Constant Compeer", "Logging Local",
    "Frequent Flyer", "Persistent Pilgrim", "Eternal Entrant", "Loyal Lumens", "Returnee Royalty",
    "Member of Memory", "Decade Devotee", "Cycle Sentinel", "Calendar Captain", "Diary Day",
    "Day-Counter", "Habit Holder", "Routine Regent", "Steady Strider", "Constant Compass",
    "Forever Found", "Daily Devotion", "Lifelong Local", "Eternal Echo", "Returnee of Records",
    "Ledger Lord II", "Diary Don II", "Daily Devotion II", "Forever Found II", "Eternal Echo II",
    "Loyal Lumens II", "Day-Counter II", "Habit Holder II", "Routine Regent II", "Steady Strider II",
]

ACTIVE_DAY_NAMES = [
    "First Action", "Two Active Days", "Three Active", "Four Active", "Five Day Achiever",
    "Six Day Doer", "Seven Day Diligent", "Ten Active Days", "Two-Week Doer", "Three-Week Worker",
    "Month of Motion", "Six-Week Worker", "Two-Month Mover", "Hundred Active", "Four-Month Mover",
    "Half-Year Motion", "Eight-Month Action", "Year of Action", "500 Active Days", "Year-and-a-Half Active",
    "Two-Year Mover", "Thousand Days Active", "Forever Active", "Eternal Engine", "Steady Sun",
    "Daily Driver", "Routine Runner", "Habit Hero", "Action Anchor", "Constant Captain",
    "Persistent Pioneer", "Reliable Reveler", "Active Auditor", "Daily Designate", "Routine Regent",
    "Habit Hero II", "Action Anchor II", "Constant Captain II", "Persistent Pioneer II", "Reliable Reveler II",
    "Active Auditor II", "Daily Designate II", "Routine Regent II", "Habit Hero III", "Action Anchor III",
    "Constant Captain III", "Persistent Pioneer III", "Reliable Reveler III", "Active Auditor III", "Routine Regent III",
    "Daily Devotee", "Habit Heart", "Routine Regulator", "Action Architect", "Constant Cleric",
    "Persistent Paladin", "Reliable Ranger", "Active Aegis", "Daily Druid", "Routine Reverent",
    "Habit Herald", "Action Adept", "Constant Cantor", "Persistent Patron", "Reliable Reaver",
    "Active Acolyte", "Daily Daimon", "Routine Reactor", "Habit Hierarch", "Action Apex",
    "Constant Crown", "Persistent Pinnacle", "Reliable Regalia", "Active Avatar", "Daily Diadem",
]


def _make_tiered(
    *,
    slug_prefix: str,
    category: str,
    condition_kind: str,
    thresholds: list[int],
    names: list[str],
    description_template: str,
    opt_out_group: str | None = None,
    sort_offset: int = 0,
) -> list[dict[str, Any]]:
    """Build tiered milestone titles from parallel `thresholds` and `names`.

    Names are recycled (with suffixes) if there are more thresholds than names.
    The total tier count is `min(len(thresholds), len(names))` to keep the
    intent clear — slugs are stable across runs as long as the threshold and
    prefix are unchanged.
    """
    rows: list[dict[str, Any]] = []
    n = len(thresholds)
    for i, threshold in enumerate(thresholds):
        name = names[i] if i < len(names) else f"{names[-1]} +{i - len(names) + 1}"
        rows.append(
            {
                "slug": f"{slug_prefix}_{threshold}",
                "name": name,
                "description": description_template.format(threshold=threshold),
                "category": category,
                "rarity": _rarity_for_index(i, n),
                "condition_kind": condition_kind,
                "condition_params": {"threshold": threshold},
                "opt_out_group": opt_out_group,
                "is_secret": False,
                "sort_order": sort_offset + i,
            }
        )
    return rows


WATER_LIFETIME_THRESHOLDS = [
    250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 6500,
    8000, 10_000, 12_000, 15_000, 18_000, 21_000, 25_000, 30_000, 35_000, 40_000,
    50_000, 60_000, 75_000, 90_000, 100_000, 120_000, 150_000, 175_000, 200_000, 230_000,
    250_000, 300_000, 350_000, 400_000, 450_000, 500_000, 600_000, 700_000, 800_000, 900_000,
    1_000_000, 1_200_000, 1_500_000, 1_800_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 4_500_000,
    5_000_000, 5_500_000, 6_000_000, 6_500_000, 7_000_000, 7_500_000, 8_000_000, 8_500_000, 9_000_000, 9_500_000,
    10_000_000, 11_000_000, 12_500_000, 14_000_000, 15_500_000, 17_000_000, 18_500_000, 20_000_000, 22_000_000, 24_000_000,
    26_000_000, 28_000_000, 30_000_000, 33_000_000, 36_000_000, 40_000_000, 45_000_000, 50_000_000, 55_000_000, 60_000_000,
    65_000_000, 70_000_000, 75_000_000, 80_000_000, 85_000_000, 90_000_000, 95_000_000, 100_000_000, 110_000_000, 125_000_000,
    140_000_000, 160_000_000, 180_000_000, 200_000_000, 225_000_000, 250_000_000, 275_000_000, 300_000_000, 350_000_000, 400_000_000,
]
ACTIVITY_LIFETIME_THRESHOLDS = [
    5, 10, 15, 20, 30, 45, 60, 90, 120, 150,
    180, 240, 300, 360, 420, 480, 600, 720, 840, 1000,
    1200, 1500, 1800, 2100, 2400, 2700, 3000, 3500, 4000, 4500,
    5000, 6000, 7000, 8000, 9000, 10_000, 12_000, 14_000, 16_000, 18_000,
    20_000, 23_000, 26_000, 30_000, 35_000, 40_000, 45_000, 50_000, 55_000, 60_000,
    65_000, 70_000, 75_000, 80_000, 85_000, 90_000, 95_000, 100_000, 110_000, 125_000,
    140_000, 160_000, 180_000, 200_000, 225_000, 250_000, 275_000, 300_000, 325_000, 350_000,
    375_000, 400_000, 425_000, 450_000, 475_000, 500_000, 550_000, 600_000, 650_000, 700_000,
    750_000, 800_000, 850_000, 900_000, 950_000, 1_000_000, 1_100_000, 1_200_000, 1_300_000, 1_400_000,
    1_500_000, 1_700_000, 1_900_000, 2_100_000, 2_300_000, 2_500_000, 2_750_000, 3_000_000, 3_500_000, 4_000_000,
]
LOGIN_DAY_THRESHOLDS = [
    1, 2, 3, 4, 5, 6, 7, 10, 14, 21,
    30, 42, 60, 90, 100, 120, 150, 200, 250, 300,
    365, 450, 500, 550, 600, 650, 730, 800, 900, 1000,
    1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
    2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000,
    3100, 3200, 3300, 3400, 3500, 3650, 3800, 4000, 4200, 4400,
    4600, 4800, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500,
    9000, 9500, 10_000, 12_000, 15_000,
]
ACTIVE_DAY_THRESHOLDS = LOGIN_DAY_THRESHOLDS  # same ladder structure

STREAK_THRESHOLDS = [
    1, 2, 3, 4, 5, 6, 7, 10, 14, 21,
    28, 35, 42, 50, 60, 75, 90, 100, 120, 150,
    180, 210, 240, 270, 300, 330, 365, 400, 450, 500,
    550, 600, 700, 800, 900, 1000, 1100, 1250, 1500, 2000,
]

# Guild-rank progression for the streak ladders. Index N maps to threshold
# STREAK_THRESHOLDS[N], so "Newbie" is day 1 and "Paragon" is day 2000.
# 40 entries — one per threshold; if STREAK_THRESHOLDS grows, _pad_names
# extends with generic tier labels.
STREAK_RANK_NAMES = [
    "Newbie", "Sophomore", "Junior", "Cadet", "Recruit",
    "Initiate", "Apprentice", "Acolyte", "Journeyman", "Adept",
    "Skilled", "Trained", "Veteran", "Senior", "Specialist",
    "Expert", "Master", "Grandmaster", "Champion", "Elite",
    "Heroic", "Honored", "Distinguished", "Renowned", "Storied",
    "Legendary", "Mythic", "Ascendant", "Transcendent", "Eternal",
    "Cosmic", "Stellar", "Galactic", "Celestial", "Divine",
    "Primordial", "Immortal", "Boundless", "Apex", "Paragon",
]

ENTRY_COUNT_THRESHOLDS = [
    1, 2, 3, 5, 7, 10, 15, 20, 25, 30,
    40, 50, 60, 75, 90, 100, 120, 150, 180, 200,
    250, 300, 400, 500, 600, 750, 900, 1000, 1200, 1500,
    1800, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7500, 9000,
    10_000, 12_000, 15_000, 18_000, 20_000, 25_000, 30_000, 40_000, 50_000, 75_000,
    100_000, 125_000, 150_000, 175_000, 200_000, 250_000, 300_000, 400_000, 500_000, 750_000,
]

WEIGHT_LOG_THRESHOLDS = [
    1, 2, 3, 5, 7, 10, 15, 20, 30, 50,
    75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2500,
]
BP_LOG_THRESHOLDS = WEIGHT_LOG_THRESHOLDS

LEVEL_THRESHOLDS = list(range(2, 102))  # 100 levels
XP_THRESHOLDS = [
    50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000,
    4000, 5000, 7500, 10_000, 12_500, 15_000, 20_000, 25_000, 30_000, 40_000,
    50_000, 65_000, 80_000, 100_000, 125_000, 150_000, 200_000, 250_000, 300_000, 400_000,
    500_000, 650_000, 800_000, 1_000_000, 1_250_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000,
    5_000_000, 6_500_000, 8_000_000, 10_000_000, 12_500_000, 15_000_000, 20_000_000, 25_000_000, 30_000_000, 40_000_000,
]

EXERCISE_TYPES = [
    "Walking", "Running", "Cycling", "Cardio", "Stretching",
    "Strength", "Yoga", "Pilates", "Swimming", "HIIT",
    "Rowing", "Climbing", "Hiking", "Dance", "Boxing",
    "Martial Arts", "Skating", "Skiing", "Surfing", "Tennis",
    "Soccer", "Basketball", "Volleyball", "Gardening", "Cleaning",
]
EXERCISE_TYPE_TIERS = [
    5, 10, 15, 20, 30, 45, 60, 90, 120, 180,
    240, 300, 400, 500, 650, 800, 1000, 1250, 1500, 2000,
    2500, 3000, 4000, 5000, 6500, 8000, 10_000, 12_500, 15_000, 20_000,
    25_000, 30_000, 40_000, 50_000, 75_000,
]

GENERIC_NAME_BANK = [
    "Initiate", "Apprentice", "Journeyman", "Adept", "Expert",
    "Veteran", "Master", "Grandmaster", "Sage", "Champion",
    "Hero", "Legend", "Mythic", "Eternal", "Paragon",
    "Pillar", "Sentinel", "Keeper", "Warden", "Custodian",
    "Steward", "Patriarch", "Matriarch", "Avatar", "Apex",
    "Pinnacle", "Apostle", "Acolyte", "Devotee", "Disciple",
    "Marshal", "Captain", "Commander", "General", "Admiral",
    "Knight", "Squire", "Page", "Herald", "Crusader",
    "Wanderer", "Pilgrim", "Voyager", "Explorer", "Navigator",
    "Pioneer", "Trailblazer", "Frontiersman", "Surveyor", "Cartographer",
    "Archmage", "Sorcerer", "Witch", "Warlock", "Enchanter",
    "Druid", "Shaman", "Mystic", "Oracle", "Diviner",
    "Phantom", "Specter", "Wraith", "Shade", "Echo",
    "Ember", "Spark", "Flame", "Cinder", "Blaze",
    "Tide", "Wave", "Surge", "Current", "Eddy",
    "Stone", "Pebble", "Boulder", "Mountain", "Mesa",
    "Cosmic", "Stellar", "Astral", "Celestial", "Lunar",
    "Solar", "Aurora", "Comet", "Nebula", "Galaxy",
    "Quantum", "Photon", "Tachyon", "Plasma", "Singular",
    "Eldritch", "Arcane", "Mythical", "Fabled", "Storied",
    "Endless", "Boundless", "Limitless", "Infinite", "Forever",
]


def _make_exercise_type_titles() -> list[dict[str, Any]]:
    """One title per (exercise_type, tier_minutes). 25 types × 20 tiers = 500."""
    rows: list[dict[str, Any]] = []
    n = len(EXERCISE_TYPE_TIERS)
    for type_idx, ex_type in enumerate(EXERCISE_TYPES):
        for tier_idx, minutes in enumerate(EXERCISE_TYPE_TIERS):
            name = (
                f"{GENERIC_NAME_BANK[(type_idx * 7 + tier_idx) % len(GENERIC_NAME_BANK)]}"
                f" of the {ex_type}"
            )
            rows.append(
                {
                    "slug": f"ex_{ex_type.lower().replace(' ', '_')}_{minutes}",
                    "name": name,
                    "description": f"Log {minutes} minutes of {ex_type}.",
                    "category": "exercise_type",
                    "rarity": _rarity_for_index(tier_idx, n),
                    "condition_kind": "exercise_type_minutes",
                    "condition_params": {"exercise_type": ex_type, "minutes": minutes},
                    "opt_out_group": None,
                    "is_secret": False,
                    "sort_order": type_idx * 100 + tier_idx,
                }
            )
    return rows


def _pad_names(names: list[str], target_len: int) -> list[str]:
    """Repeat the GENERIC_NAME_BANK with a tier suffix to extend a name list."""
    if len(names) >= target_len:
        return names[:target_len]
    out = list(names)
    bank = GENERIC_NAME_BANK
    n_pad = target_len - len(names)
    for i in range(n_pad):
        out.append(f"{bank[i % len(bank)]} Tier {len(names) + i + 1}")
    return out


def build_tiered() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    rows += _make_tiered(
        slug_prefix="water_lifetime",
        category="lifetime_water",
        condition_kind="lifetime_water_ml",
        thresholds=WATER_LIFETIME_THRESHOLDS,
        names=_pad_names(WATER_NAMES, len(WATER_LIFETIME_THRESHOLDS)),
        description_template="Log {threshold:,} ml of water in total.",
    )

    rows += _make_tiered(
        slug_prefix="activity_lifetime",
        category="lifetime_activity",
        condition_kind="lifetime_active_minutes",
        thresholds=ACTIVITY_LIFETIME_THRESHOLDS,
        names=_pad_names(ACTIVITY_NAMES, len(ACTIVITY_LIFETIME_THRESHOLDS)),
        description_template="Log {threshold:,} minutes of activity in total.",
    )

    rows += _make_tiered(
        slug_prefix="login_days",
        category="login_days",
        condition_kind="login_days",
        thresholds=LOGIN_DAY_THRESHOLDS,
        names=_pad_names(LOGIN_DAY_NAMES, len(LOGIN_DAY_THRESHOLDS)),
        description_template="Sign in on {threshold} distinct days.",
    )

    rows += _make_tiered(
        slug_prefix="active_days",
        category="active_days",
        condition_kind="active_days",
        thresholds=ACTIVE_DAY_THRESHOLDS,
        names=_pad_names(ACTIVE_DAY_NAMES, len(ACTIVE_DAY_THRESHOLDS)),
        description_template="Log something on {threshold} distinct days.",
    )

    # Streak ladders use a guild-rank progression instead of literal
    # "Two Day Heat" labels — the popup already shows the threshold via
    # `description`, so the title itself can be evocative rather than
    # literal. Same rank list across all four streak categories; the
    # noun ("Hydrator" / "Aquanaut" / "Streaker" / "Marathoner")
    # disambiguates which streak the rank belongs to.
    streak_ranks = _pad_names(STREAK_RANK_NAMES, len(STREAK_THRESHOLDS))
    rows += _make_tiered(
        slug_prefix="water_streak_current",
        category="streak_water",
        condition_kind="streak_water_days_current",
        thresholds=STREAK_THRESHOLDS,
        names=[f"{r} Hydrator" for r in streak_ranks],
        description_template="Hold a water-goal streak of {threshold} consecutive days.",
    )
    rows += _make_tiered(
        slug_prefix="water_streak_longest",
        category="streak_water",
        condition_kind="streak_water_days_longest",
        thresholds=STREAK_THRESHOLDS,
        names=[f"{r} Aquanaut" for r in streak_ranks],
        description_template="Reach a longest water streak of {threshold} days.",
        sort_offset=200,
    )
    rows += _make_tiered(
        slug_prefix="activity_streak_current",
        category="streak_activity",
        condition_kind="streak_activity_days_current",
        thresholds=STREAK_THRESHOLDS,
        names=[f"{r} Streaker" for r in streak_ranks],
        description_template="Hold an activity-goal streak of {threshold} consecutive days.",
    )
    rows += _make_tiered(
        slug_prefix="activity_streak_longest",
        category="streak_activity",
        condition_kind="streak_activity_days_longest",
        thresholds=STREAK_THRESHOLDS,
        names=[f"{r} Marathoner" for r in streak_ranks],
        description_template="Reach a longest activity streak of {threshold} days.",
        sort_offset=200,
    )

    rows += _make_tiered(
        slug_prefix="water_entries",
        category="entry_count",
        condition_kind="water_entry_count",
        thresholds=ENTRY_COUNT_THRESHOLDS,
        names=_pad_names(
            ["First Log", "Two-fer", "Three-Log", "Hand of Five", "Decade",
             "Twenty Logs", "Fifty Logs", "Hundred Logs"],
            len(ENTRY_COUNT_THRESHOLDS),
        ),
        description_template="Record {threshold:,} water entries.",
        sort_offset=0,
    )
    rows += _make_tiered(
        slug_prefix="activity_entries",
        category="entry_count",
        condition_kind="activity_entry_count",
        thresholds=ENTRY_COUNT_THRESHOLDS,
        names=_pad_names(
            ["First Move", "Pair of Moves", "Three Moves", "Hand of Five Moves", "Decade of Moves"],
            len(ENTRY_COUNT_THRESHOLDS),
        ),
        description_template="Record {threshold:,} activity entries.",
        sort_offset=100,
    )
    rows += _make_tiered(
        slug_prefix="food_entries",
        category="entry_count",
        condition_kind="food_entry_count",
        thresholds=ENTRY_COUNT_THRESHOLDS,
        names=_pad_names(
            ["First Meal Logged", "Two Meals", "Three Meals", "Hand of Five Meals", "Decade of Meals"],
            len(ENTRY_COUNT_THRESHOLDS),
        ),
        description_template="Record {threshold:,} food entries.",
        sort_offset=200,
    )
    rows += _make_tiered(
        slug_prefix="habit_checkins",
        category="habit",
        condition_kind="habit_checkin_count",
        thresholds=ENTRY_COUNT_THRESHOLDS,
        names=_pad_names(
            ["First Habit Done", "Two Habit Days", "Three Habit Days", "Hand of Five Habit Days",
             "Decade of Habit Days"],
            len(ENTRY_COUNT_THRESHOLDS),
        ),
        description_template="Complete {threshold:,} habit check-ins.",
    )

    rows += _make_tiered(
        slug_prefix="weight_logs",
        category="weight_milestone",
        condition_kind="weight_logs_count",
        thresholds=WEIGHT_LOG_THRESHOLDS,
        names=_pad_names(
            ["First Weigh-In", "Two on the Scale", "Three on the Scale", "Hand of Five Weigh-Ins",
             "Decade of Weigh-Ins"],
            len(WEIGHT_LOG_THRESHOLDS),
        ),
        description_template="Log {threshold} weight entries.",
        opt_out_group="weight_loss",
    )
    rows += _make_tiered(
        slug_prefix="bp_logs",
        category="bp_milestone",
        condition_kind="bp_logs_count",
        thresholds=BP_LOG_THRESHOLDS,
        names=_pad_names(
            ["First BP Read", "Two Reads", "Three Reads", "Hand of Five Reads",
             "Decade of Reads"],
            len(BP_LOG_THRESHOLDS),
        ),
        description_template="Log {threshold} blood pressure readings.",
        opt_out_group="bp",
    )

    rows += _make_tiered(
        slug_prefix="level",
        category="level",
        condition_kind="level",
        thresholds=LEVEL_THRESHOLDS,
        names=_pad_names(
            ["Level 2", "Level 3", "Level 4", "Level 5", "Level 6",
             "Level 7", "Level 8", "Level 9", "Level 10", "Level 11"],
            len(LEVEL_THRESHOLDS),
        ),
        description_template="Reach level {threshold}.",
    )
    rows += _make_tiered(
        slug_prefix="xp_total",
        category="level",
        condition_kind="xp_total",
        thresholds=XP_THRESHOLDS,
        names=_pad_names(
            ["First 50 XP", "Hundred XP", "200 XP", "300 XP", "Half-K XP",
             "750 XP", "Kilo-XP", "1.5k XP", "2k XP", "3k XP"],
            len(XP_THRESHOLDS),
        ),
        description_template="Accumulate {threshold:,} XP total.",
        sort_offset=200,
    )

    rows += _make_exercise_type_titles()

    return rows


def main() -> None:
    tiered = build_tiered()
    curated = list(CURATED_ENTRIES)
    all_titles = tiered + curated

    seen_slugs: set[str] = set()
    for t in all_titles:
        if t["slug"] in seen_slugs:
            raise SystemExit(f"duplicate slug: {t['slug']}")
        seen_slugs.add(t["slug"])

    all_titles.sort(key=lambda t: (t["category"], t.get("sort_order", 0), t["slug"]))

    target = 2500
    if len(all_titles) < target:
        raise SystemExit(
            f"Need at least {target} titles, got {len(all_titles)}. "
            "Add more tiers or curated entries."
        )

    out_path = (
        Path(__file__).resolve().parent.parent / "app" / "data" / "titles_catalog.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(all_titles, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(all_titles)} titles to {out_path} "
        f"(tiered={len(tiered)}, curated={len(curated)})"
    )


if __name__ == "__main__":
    main()
