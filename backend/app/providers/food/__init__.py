from app.providers.food.base import FoodItem, FoodProvider, food_providers
from app.providers.food import openfoodfacts  # noqa: F401  -- register

__all__ = ["FoodItem", "FoodProvider", "food_providers"]
