from __future__ import annotations

import pytest

from app.parsers.canadian_nutrition_facts import parse

# Fixture text strings simulate clean OCR output of the four real labels the
# user attached. They cover the full mandatory panel, French / English /
# bilingual variants, and the B-vitamin disambiguation we had a bug with.
OATMEAL_CRISP_EN = """Nutrition Facts
Per 1 cup (58 g)
Calories 230
Fat 4 g
  Saturated 0.5 g
  + Trans 0 g
Carbohydrate 46 g
  Fibre 5 g
  Sugars 13 g
Protein 6 g
Cholesterol 0 mg
Sodium 120 mg
Potassium 200 mg
Calcium 40 mg
Iron 7.5 mg
Vitamin A 0 mcg
Vitamin D 0 mcg
Thiamin 0.1 mg
Riboflavin 0.1 mg
Niacin 3 mg
Vitamin B6 0.35 mg
Folate 60 mcg DFE
Vitamin B12 0 mcg
Pantothenate 0.9 mg
Phosphorus 175 mg
Magnesium 60 mg
Zinc 1 mg
"""

OATMEAL_CRISP_FR = """Valeur nutritive
pour 1 tasse (58 g)
Calories 230
Lipides 4 g
  saturés 0,5 g
  + trans 0 g
Glucides 46 g
  Fibres 5 g
  Sucres 13 g
Protéines 6 g
Cholestérol 0 mg
Sodium 120 mg
Potassium 200 mg
Calcium 40 mg
Fer 7,5 mg
Vitamine A 0 µg
Vitamine D 0 µg
Thiamine 0,1 mg
Riboflavine 0,1 mg
Niacine 3 mg
Vitamine B6 0,35 mg
Folate 60 µg ÉFA
Vitamine B12 0 µg
Pantothénate 0,9 mg
Phosphore 175 mg
Magnésium 60 mg
Zinc 1 mg
"""

HIGH_LINER_FISH_STICKS = """Nutrition Facts
Per 3 sticks (75 g)
Calories 160
Fat 9 g
  Saturated 0.5 g
  + Trans 0 g
  Polyunsaturated 2.5 g
  Monounsaturated 5 g
Carbohydrate 11 g
  Fibre 0 g
  Sugars 0 g
Protein 9 g
Cholesterol 25 mg
Sodium 280 mg
Potassium 150 mg
Calcium 20 mg
Iron 0.5 mg
"""

YVES_PLANT_BASED = """Nutrition Facts
Per 1 piece (100 g)
Calories 180
Fat 2.5 g
  Saturated 1 g
  + Trans 0 g
Carbohydrate 36 g
  Fibre 0 g
  Sugars 2 g
Protein 4 g
Cholesterol 0 mg
Sodium 330 mg
Potassium 0 mg
Calcium 0 mg
Iron 0 mg
"""


def test_parses_oatmeal_crisp_english():
    r = parse(OATMEAL_CRISP_EN)
    assert r.serving_g == 58.0
    assert r.serving_label == "1 cup"
    assert r.kcal == 230
    assert r.language == "en"
    n = r.nutrients
    assert n.saturated_fat_g == 0.5
    assert n.trans_fat_g == 0.0
    assert n.fibre_g == 5.0
    assert n.sugars_g == 13.0
    assert n.cholesterol_mg == 0.0
    assert n.sodium_mg == 120.0
    assert n.potassium_mg == 200.0
    assert n.calcium_mg == 40.0
    assert n.iron_mg == 7.5
    assert n.thiamin_mg == 0.1
    assert n.riboflavin_mg == 0.1
    assert n.niacin_mg == 3.0
    # The B-vitamin disambiguation bug — "Vitamin B6 0.35 mg" must not get
    # consumed by the vit_e_mg pattern via 'e' in 'vitamine'/'vitamin'.
    assert n.vit_b6_mg == 0.35
    assert n.vit_e_mg is None
    assert n.folate_mcg_dfe == 60.0
    assert n.vit_b12_mcg == 0.0
    assert n.pantothenate_mg == 0.9
    assert n.phosphorus_mg == 175.0
    assert n.magnesium_mg == 60.0
    assert n.zinc_mg == 1.0


def test_parses_oatmeal_crisp_french():
    r = parse(OATMEAL_CRISP_FR)
    assert r.serving_g == 58.0
    assert r.serving_label == "1 tasse"
    assert r.kcal == 230
    assert r.language == "fr"
    # French uses commas as decimal separators — verify the parser handles them.
    assert r.nutrients.iron_mg == 7.5
    assert r.nutrients.saturated_fat_g == 0.5
    assert r.nutrients.vit_b6_mg == 0.35
    assert r.nutrients.vit_e_mg is None


def test_parses_high_liner_fish_sticks():
    r = parse(HIGH_LINER_FISH_STICKS)
    assert r.serving_g == 75.0
    assert r.serving_label == "3 sticks"
    assert r.kcal == 160
    n = r.nutrients
    assert n.cholesterol_mg == 25.0
    assert n.sodium_mg == 280.0
    assert n.potassium_mg == 150.0
    assert n.iron_mg == 0.5
    # No vitamin lines on this label — those keys must stay None.
    assert n.vit_d_mcg is None
    assert n.vit_b12_mcg is None


def test_parses_yves_plant_based():
    r = parse(YVES_PLANT_BASED)
    assert r.serving_g == 100.0
    assert r.serving_label == "1 piece"
    assert r.kcal == 180
    n = r.nutrients
    assert n.saturated_fat_g == 1.0
    assert n.trans_fat_g == 0.0
    assert n.sodium_mg == 330.0


def test_handles_empty_text():
    r = parse("")
    assert r.serving_g is None
    assert r.serving_label is None
    assert r.kcal is None
    assert r.nutrients.sodium_mg is None


def test_handles_partial_text():
    """OCR sometimes fails on most of the panel. The parser should still
    surface whatever it could extract rather than dropping the whole result."""
    r = parse("Per 2 servings (40 g)\nCalories 100\nSodium 50 mg\n")
    assert r.serving_g == 40.0
    assert r.serving_label == "2 servings"
    assert r.kcal == 100
    assert r.nutrients.sodium_mg == 50.0
    assert r.nutrients.iron_mg is None


@pytest.mark.parametrize(
    ("text", "expected_grams"),
    [
        ("Per 1 cup (250 mL)", None),  # mL serving — not a gram match
        ("Per 1 piece (12g)", 12.0),  # no space before unit
    ],
)
def test_serving_size_edge_cases(text, expected_grams):
    r = parse(text + "\nCalories 100\n")
    assert r.serving_g == expected_grams


def test_kcal_must_be_realistic():
    """Garbage 6-digit OCR numbers shouldn't become calorie values."""
    r = parse("Calories 999999\n")
    assert r.kcal is None
