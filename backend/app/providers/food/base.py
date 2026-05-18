from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar, Literal

from pydantic import BaseModel

from app.providers.base import Registry


class FoodItem(BaseModel):
    source: str
    source_id: str
    name: str
    brand: str | None = None
    serving_g: float | None = None
    serving_label: str | None = None
    # "g" or "ml" if the data backs it; None when we genuinely don't know.
    # Beverages should report "ml" so the frontend offers volumetric units.
    unit: Literal["g", "ml"] | None = None
    # Per-100g nutriments (mass basis).
    kcal_per_100g: float | None = None
    protein_per_100g: float | None = None
    carbs_per_100g: float | None = None
    fat_per_100g: float | None = None
    # Per-100ml nutriments (volume basis). Populated for liquids when the
    # provider exposes them; lets us avoid density assumptions.
    kcal_per_100ml: float | None = None
    protein_per_100ml: float | None = None
    carbs_per_100ml: float | None = None
    fat_per_100ml: float | None = None
    # Extended Canadian Nutrition Facts panel, per-100g mass basis. Keys are
    # a subset of schemas.food.ALLOWED_NUTRIENT_KEYS. Sparse — providers
    # rarely fill every field, especially vitamins.
    nutrients_per_100g: dict[str, float] | None = None


class FoodProvider(ABC):
    kind: ClassVar[str]
    label: ClassVar[str]
    config_schema: ClassVar[type[BaseModel]]

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = self.config_schema.model_validate(config).model_dump()

    @abstractmethod
    async def search(self, query: str, limit: int = 20) -> list[FoodItem]: ...

    @abstractmethod
    async def by_barcode(self, code: str) -> FoodItem | None: ...


food_providers: Registry[FoodProvider] = Registry()
