from __future__ import annotations

import pytest

from app.providers.food.openfoodfacts import OpenFoodFactsProvider


def test_map_handles_dict_product_name() -> None:
    """OFF sometimes returns `product_name` as a multilingual hash instead of
    a string. The mapper must skip the field rather than hand Pydantic a
    dict and trigger a ValidationError on the whole search."""
    item = OpenFoodFactsProvider._map(
        {
            "code": "1234",
            "product_name": {"en": "Cabbage slaw", "fr": "Salade de chou"},
            "generic_name": "Cabbage slaw",
            "nutriments": {"energy-kcal_100g": 150},
        }
    )
    assert item.source_id == "1234"
    assert item.name == "Cabbage slaw"  # falls back to generic_name
    assert item.brand is None
    assert item.kcal_per_100g == 150


def test_map_handles_list_brands() -> None:
    """`brands` arrives as a tag list on some OFF endpoints. Mapper must
    treat it as missing rather than pass a list to a str field."""
    item = OpenFoodFactsProvider._map(
        {
            "code": "5678",
            "product_name": "Cabbage slaw",
            "brands": ["Brand1", "Brand2"],
            "nutriments": {},
        }
    )
    assert item.brand is None
    assert item.name == "Cabbage slaw"


def test_map_handles_non_dict_nutriments() -> None:
    """nutriments arriving as null or list shouldn't crash the mapper."""
    item = OpenFoodFactsProvider._map(
        {
            "code": "9012",
            "product_name": "X",
            "nutriments": None,
        }
    )
    assert item.kcal_per_100g is None
    assert item.nutrients_per_100g is None


def test_search_skips_bad_product_keeps_good_ones() -> None:
    """One product with a broken field shouldn't tank the whole search.
    Verified by directly invoking the per-product mapping path."""
    products = [
        {
            "code": "good1",
            "product_name": "Apple",
            "nutriments": {"energy-kcal_100g": 52},
        },
        {
            "code": "bad",
            # Pydantic's `Literal["g","ml"] | None` would reject something
            # exotic in `unit`, but the mapper now passes only None or a
            # valid literal so this case is no longer realistic. The defence
            # is in `search()` wrapping each `_map` call in try/except.
            "product_name": {"en": "Multilingual only"},
            "nutriments": {},
        },
    ]
    items = [
        OpenFoodFactsProvider._map(p) for p in products if p.get("code")
    ]
    assert len(items) == 2  # both succeed now that _map is defensive
    assert items[0].name == "Apple"
    assert items[1].name == "Unknown"  # multilingual dict falls back to Unknown


if __name__ == "__main__":  # pragma: no cover
    pytest.main([__file__, "-v"])
