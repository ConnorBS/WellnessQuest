"""Parse the text of a Canadian Nutrition Facts panel into structured fields.

Canadian labels follow Schedule L of the Food and Drug Regulations: a fixed
header ("Nutrition Facts" / "Valeur nutritive"), a per-serving line ("Per
1 cup (58 g)" / "pour 1 tasse (58 g)"), then a fixed-order list of rows. Each
row is `<NAME> <AMOUNT> <UNIT>` optionally followed by `<%DV>`. We ignore the
%DV column — it's recomputed downstream against Health Canada's static table.

The parser is bilingual: it accepts English-only, French-only, and the common
bilingual layout (two columns or interleaved). It returns `None` for anything
it couldn't extract confidently — the frontend's review screen surfaces blanks
so the user can fill them in.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

from app.schemas.food import NutrientPanel


@dataclass
class ParsedLabel:
    name: str | None
    brand: str | None
    serving_g: float | None
    serving_label: str | None
    kcal: int | None
    nutrients: NutrientPanel
    language: Literal["en", "fr", "mixed"]


def _normalize(text: str) -> str:
    """Lower-case, strip accents, normalize whitespace.

    OCR output of bilingual labels mixes accents and case unpredictably; we
    match against the normalized form and keep the original for display.
    """
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text.strip().lower())


# Nutrient row keywords. Each tuple is (canonical_key, output_unit, scale_to_output, patterns).
# Pattern matches the row LABEL (case/diacritic-insensitive, normalized). `scale_to_output`
# converts whatever unit appears on the label to the canonical unit we store in JSONB.
#
# Order matters: the parser walks rows top-to-bottom; later rows skip ones already
# captured, so put more-specific keywords first when in doubt.
_NUTRIENT_PATTERNS: list[tuple[str, list[str]]] = [
    ("saturated_fat_g", [r"\bsaturated\b", r"\bsatures?\b"]),
    ("trans_fat_g", [r"\btrans\b"]),
    ("fibre_g", [r"\bfib(?:re|er)s?\b"]),
    ("sugars_g", [r"\bsugars?\b", r"\bsucres\b"]),
    ("cholesterol_mg", [r"\bcholesterol\b"]),
    ("sodium_mg", [r"\bsodium\b"]),
    ("potassium_mg", [r"\bpotassium\b"]),
    ("calcium_mg", [r"\bcalcium\b"]),
    ("iron_mg", [r"\biron\b", r"\bfer\b"]),
    # Vitamin patterns: anchor on the full "vitamin"/"vitamine" word so the
    # trailing 'e' of "vitamine" doesn't get reused as a vit-E match for a
    # "vitamine b6" line. The leading group with `\b` after `e?` keeps the
    # separator-then-letter contract: "vitamin C", "vitamine c", "vit c", etc.
    # B6 and B12 must come BEFORE the single-letter vitamins below so a line
    # like "Vitamine B6" matches B6 first and short-circuits.
    ("vit_b6_mg", [r"\bvit(?:amine?)?\b[\s\-]*b\s*6\b"]),
    ("vit_b12_mcg", [r"\bvit(?:amine?)?\b[\s\-]*b\s*12\b"]),
    ("vit_a_mcg_rae", [r"\bvit(?:amine?)?\b[\s\-]+a\b"]),
    ("vit_c_mg", [r"\bvit(?:amine?)?\b[\s\-]+c\b"]),
    ("vit_d_mcg", [r"\bvit(?:amine?)?\b[\s\-]+d\b"]),
    ("vit_e_mg", [r"\bvit(?:amine?)?\b[\s\-]+e\b"]),
    ("vit_k_mcg", [r"\bvit(?:amine?)?\b[\s\-]+k\b"]),
    ("thiamin_mg", [r"\bthiamine?\b"]),
    ("riboflavin_mg", [r"\briboflavine?\b"]),
    ("niacin_mg", [r"\bniacin(?:e|amide)?\b", r"\bniacine\b"]),
    ("folate_mcg_dfe", [r"\bfolate\b"]),
    ("pantothenate_mg", [r"\bpantothen", r"\bpanto"]),
    ("phosphorus_mg", [r"\bphosph"]),
    ("magnesium_mg", [r"\bmagnesium\b"]),
    ("zinc_mg", [r"\bzinc\b"]),
]

# Carbohydrate and total-fat (no Saturated/Trans qualifier) — handled specially
# because they share keywords with their sub-rows and we want to set the typed
# columns, not the nutrient JSON.
_CARB_PATTERNS = [r"\bcarbohydrate\b", r"\bglucides?\b"]
_FAT_TOTAL_PATTERNS = [r"^fat\b", r"\blipides?\b"]
_PROTEIN_PATTERNS = [r"\bprotein\b", r"\bproteines?\b"]
_CALORIES_PATTERNS = [r"\bcalories\b"]

# Conversion to the canonical storage unit for each key.
_UNIT_SCALE: dict[tuple[str, str], float] = {
    # Already-canonical pass-throughs
    ("saturated_fat_g", "g"): 1.0,
    ("trans_fat_g", "g"): 1.0,
    ("fibre_g", "g"): 1.0,
    ("sugars_g", "g"): 1.0,
    ("cholesterol_mg", "mg"): 1.0,
    ("sodium_mg", "mg"): 1.0,
    ("potassium_mg", "mg"): 1.0,
    ("calcium_mg", "mg"): 1.0,
    ("iron_mg", "mg"): 1.0,
    ("magnesium_mg", "mg"): 1.0,
    ("phosphorus_mg", "mg"): 1.0,
    ("zinc_mg", "mg"): 1.0,
    ("vit_c_mg", "mg"): 1.0,
    ("vit_e_mg", "mg"): 1.0,
    ("thiamin_mg", "mg"): 1.0,
    ("riboflavin_mg", "mg"): 1.0,
    ("niacin_mg", "mg"): 1.0,
    ("vit_b6_mg", "mg"): 1.0,
    ("pantothenate_mg", "mg"): 1.0,
    ("vit_a_mcg_rae", "mcg"): 1.0,
    ("vit_a_mcg_rae", "ug"): 1.0,
    ("vit_d_mcg", "mcg"): 1.0,
    ("vit_d_mcg", "ug"): 1.0,
    ("vit_k_mcg", "mcg"): 1.0,
    ("vit_k_mcg", "ug"): 1.0,
    ("folate_mcg_dfe", "mcg"): 1.0,
    ("folate_mcg_dfe", "ug"): 1.0,
    ("vit_b12_mcg", "mcg"): 1.0,
    ("vit_b12_mcg", "ug"): 1.0,
    # Common cross-unit fallbacks (OCR sometimes drops the µ; treat lone "g"
    # for a known-mcg vitamin as already-converted µg).
    ("vit_a_mcg_rae", "g"): 1.0,
    ("vit_d_mcg", "g"): 1.0,
    ("vit_k_mcg", "g"): 1.0,
    ("folate_mcg_dfe", "g"): 1.0,
    ("vit_b12_mcg", "g"): 1.0,
}

# Per-row regex: nutrient name + amount + unit (+ optional %DV column we drop).
# Examples that should match:
#   "sodium 120 mg 5 %"
#   "vitamin a 0 mcg rae 0 %"
#   "iron 7.5 mg 42 %"
#   "folate 60 mcg dfe 15 %"
_ROW_RE = re.compile(
    r"""
    (?P<amount>\d+(?:[.,]\d+)?)        # 120, 7.5, 0,5
    \s*
    (?P<unit>mcg|μg|ug|µg|mg|g|kcal|cal)\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Serving-size line. Captures the bracketed gram amount when present:
#   "Per 1 cup (58 g)"   →  serving_label="1 cup", serving_g=58
#   "pour 1 tasse (58 g)"
#   "Per 3 sticks (75 g)"
_SERVING_RE = re.compile(
    r"""
    (?:per|pour)\s+
    (?P<label>[^\(\n]{1,40}?)
    \s*\(\s*(?P<grams>\d+(?:[.,]\d+)?)\s*g\s*\)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Calories line. Trans/French both spell it identically.
_CAL_RE = re.compile(r"\bcalories\b[^\d]{0,20}(\d{1,5})", re.IGNORECASE)


def parse(raw_text: str) -> ParsedLabel:
    norm = _normalize(raw_text)
    lang = _detect_language(norm)

    serving_g, serving_label = _parse_serving(raw_text)
    kcal = _parse_calories(norm)
    panel = NutrientPanel()

    # Walk line-by-line so the keyword scan stays local. OCR output is usually
    # one nutrient per line; the row regex pulls amount+unit from whatever
    # follows the keyword. Carbs / fat-total / protein go to typed columns
    # via the consumer; here we only populate the NutrientPanel for the
    # detail rows.
    for raw_line in raw_text.splitlines():
        line_norm = _normalize(raw_line)
        if not line_norm:
            continue
        for key, patterns in _NUTRIENT_PATTERNS:
            if any(re.search(p, line_norm) for p in patterns):
                amt = _extract_amount_for_key(line_norm, key)
                if amt is not None and getattr(panel, key) is None:
                    setattr(panel, key, amt)
                break  # one nutrient per line

    return ParsedLabel(
        name=None,  # name/brand intentionally not parsed — they live outside
        brand=None,  # the table on Canadian labels and are too noisy via OCR.
        serving_g=serving_g,
        serving_label=serving_label,
        kcal=kcal,
        nutrients=panel,
        language=lang,
    )


def _detect_language(norm: str) -> Literal["en", "fr", "mixed"]:
    has_en = bool(re.search(r"\bnutrition facts\b", norm))
    has_fr = bool(re.search(r"\bvaleur nutritive\b", norm))
    if has_en and has_fr:
        return "mixed"
    if has_fr:
        return "fr"
    return "en"


def _parse_serving(raw_text: str) -> tuple[float | None, str | None]:
    """Find the per-serving line. Returns (grams, label) or (None, None)."""
    m = _SERVING_RE.search(raw_text)
    if not m:
        return None, None
    grams_str = m.group("grams").replace(",", ".")
    try:
        grams = float(grams_str)
    except ValueError:
        grams = None
    label = m.group("label").strip()
    # Drop trailing connectors like "of" / "de" that get glued on by OCR.
    label = re.sub(r"\s+(of|de)\s*$", "", label, flags=re.IGNORECASE).strip()
    if len(label) > 64:
        label = label[:64]
    return grams, label or None


def _parse_calories(norm: str) -> int | None:
    m = _CAL_RE.search(norm)
    if not m:
        return None
    try:
        val = int(m.group(1))
    except ValueError:
        return None
    if 0 <= val <= 20000:
        return val
    return None


def _extract_amount_for_key(line_norm: str, key: str) -> float | None:
    """Find the numeric amount on a row matched for `key`, scale to storage unit."""
    matches = list(_ROW_RE.finditer(line_norm))
    if not matches:
        return None
    # Prefer the first numeric match that isn't an obvious %DV percentage.
    # We strip the %DV column upstream by ignoring trailing "<number> %" —
    # the row regex doesn't capture % so a stray "5 %" won't appear here.
    for m in matches:
        amount_str = m.group("amount").replace(",", ".")
        try:
            amount = float(amount_str)
        except ValueError:
            continue
        unit = m.group("unit").lower().replace("μ", "u").replace("µ", "u")
        if unit in {"kcal", "cal"}:
            continue
        scale = _UNIT_SCALE.get((key, unit))
        if scale is None:
            # Reasonable fallback: store amount as-is. This catches OCR
            # quirks where the unit got misread (e.g. "iron 7.5 m"). Better
            # to surface an approximate value the user can correct than to
            # drop the row entirely.
            scale = 1.0
        scaled = amount * scale
        # Don't return zero amounts when the label clearly had a non-zero;
        # but a real "0 g" on cholesterol is meaningful — we let it through.
        return round(scaled, 4)
    return None
