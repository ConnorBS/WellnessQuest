from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar

from pydantic import BaseModel

from app.providers.base import Registry


class FoodItem(BaseModel):
    source: str
    source_id: str
    name: str
    brand: str | None = None
    serving_g: float | None = None
    serving_label: str | None = None
    kcal_per_100g: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None


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
