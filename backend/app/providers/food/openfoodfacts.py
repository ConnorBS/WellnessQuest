from __future__ import annotations

from typing import Any

import httpx
from pydantic import BaseModel

from app.providers.food.base import FoodItem, FoodProvider, food_providers


class OpenFoodFactsConfig(BaseModel):
    base_url: str = "https://world.openfoodfacts.org"
    user_agent: str = "WellnessQuest/0.1 (+https://github.com/connorbs/wellnessquest)"


@food_providers.register
class OpenFoodFactsProvider(FoodProvider):
    kind = "openfoodfacts"
    label = "Open Food Facts"
    config_schema = OpenFoodFactsConfig

    async def search(self, query: str, limit: int = 20) -> list[FoodItem]:
        # action=process + search_simple=1 are required for the legacy cgi search to
        # actually execute the query rather than return the search form HTML.
        params = {
            "action": "process",
            "search_simple": 1,
            "search_terms": query,
            "json": 1,
            "page_size": min(limit, 50),
            "fields": "code,product_name,generic_name,brands,serving_quantity,nutriments",
        }
        async with httpx.AsyncClient(
            headers={"User-Agent": self.config["user_agent"]}, timeout=8.0
        ) as client:
            resp = await client.get(f"{self.config['base_url']}/cgi/search.pl", params=params)
            resp.raise_for_status()
            data = resp.json()
        return [self._map(p) for p in data.get("products", []) if p.get("code")]

    async def by_barcode(self, code: str) -> FoodItem | None:
        url = f"{self.config['base_url']}/api/v2/product/{code}.json"
        async with httpx.AsyncClient(
            headers={"User-Agent": self.config["user_agent"]}, timeout=8.0
        ) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
        if data.get("status") != 1:
            return None
        return self._map(data["product"])

    @staticmethod
    def _map(p: dict[str, Any]) -> FoodItem:
        nutr = p.get("nutriments", {}) or {}

        def _opt_f(key: str) -> float | None:
            v = nutr.get(key)
            try:
                return float(v) if v is not None else None
            except (TypeError, ValueError):
                return None

        def _opt_top_f(key: str) -> float | None:
            v = p.get(key)
            try:
                return float(v) if v is not None else None
            except (TypeError, ValueError):
                return None

        return FoodItem(
            source="openfoodfacts",
            source_id=str(p.get("code", "")),
            name=p.get("product_name") or p.get("generic_name") or "Unknown",
            brand=p.get("brands"),
            serving_g=_opt_top_f("serving_quantity"),
            kcal_per_100g=_opt_f("energy-kcal_100g"),
            protein_g=_opt_f("proteins_100g"),
            carbs_g=_opt_f("carbohydrates_100g"),
            fat_g=_opt_f("fat_100g"),
        )


