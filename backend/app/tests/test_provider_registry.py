from __future__ import annotations

import pytest

from app.integrations.base import channels
from app.providers.food.base import food_providers
from app.providers.food.openfoodfacts import OpenFoodFactsProvider


def test_food_provider_registered():
    kinds = food_providers.kinds()
    assert "openfoodfacts" in kinds
    cls = food_providers.get("openfoodfacts")
    assert cls.label == "Open Food Facts"


def test_ha_channel_registered():
    kinds = channels.kinds()
    assert "home_assistant" in kinds
    cls = channels.get("home_assistant")
    assert cls.label == "Home Assistant"


def test_unknown_kind_raises():
    with pytest.raises(LookupError):
        food_providers.get("nope")
    with pytest.raises(LookupError):
        channels.get("nope")


def test_off_detects_liquid_unit_from_serving_quantity_unit():
    p = {
        "code": "111",
        "product_name": "Milk",
        "serving_quantity": 240,
        "serving_quantity_unit": "ml",
        "nutriments": {
            "energy-kcal_100g": 35,
            "energy-kcal_100ml": 36,
            "proteins_100ml": 3.5,
        },
    }
    item = OpenFoodFactsProvider._map(p)
    assert item.unit == "ml"
    assert item.kcal_per_100ml == 36.0
    assert item.protein_per_100ml == 3.5
    # Per-100g still passed through when present, for fallback display.
    assert item.kcal_per_100g == 35.0


def test_off_detects_solid_when_no_ml_signal():
    p = {
        "code": "222",
        "product_name": "Yogurt",
        "serving_quantity_unit": "g",
        "nutriments": {"energy-kcal_100g": 100, "proteins_100g": 10},
    }
    item = OpenFoodFactsProvider._map(p)
    assert item.unit == "g"
    assert item.kcal_per_100g == 100.0
    assert item.kcal_per_100ml is None


def test_off_falls_back_to_label_when_unit_missing():
    p = {
        "code": "333",
        "product_name": "Beer",
        "serving_size": "330 ml",
        "nutriments": {"energy-kcal_100ml": 40},
    }
    item = OpenFoodFactsProvider._map(p)
    # Inferred from per-100ml nutriments AND serving_size label.
    assert item.unit == "ml"


def test_off_unit_unknown_when_no_signals():
    item = OpenFoodFactsProvider._map({"code": "444", "product_name": "Mystery"})
    assert item.unit is None
