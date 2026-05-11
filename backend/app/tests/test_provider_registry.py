from __future__ import annotations

import pytest

from app.integrations.base import channels
from app.providers.food.base import food_providers


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
