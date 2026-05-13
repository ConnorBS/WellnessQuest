from __future__ import annotations

import asyncio
import re
from typing import Any, Literal

import httpx
from pydantic import BaseModel

from app.providers.food.base import FoodItem, FoodProvider, food_providers
from app.telemetry.logger import get_logger

log = get_logger(__name__)


class OpenFoodFactsConfig(BaseModel):
    base_url: str = "https://world.openfoodfacts.org"
    # Search-a-licious is OFF's purpose-built full-text search service; it sits on
    # different infra than the legacy /cgi/search.pl and is far less prone to 5xx.
    search_url: str = "https://search.openfoodfacts.org/search"
    user_agent: str = "WellnessQuest/0.1 (+https://github.com/connorbs/wellnessquest)"


# Each product detail we care about, regardless of which OFF endpoint we hit.
_FIELDS = (
    "code,product_name,generic_name,brands,"
    "serving_size,serving_quantity,serving_quantity_unit,"
    "product_quantity_unit,quantity,"
    "nutriments"
)


@food_providers.register
class OpenFoodFactsProvider(FoodProvider):
    kind = "openfoodfacts"
    label = "Open Food Facts"
    config_schema = OpenFoodFactsConfig

    async def search(self, query: str, limit: int = 20) -> list[FoodItem]:
        """Search OFF. Try the legacy cgi endpoint first; on persistent 5xx,
        fall back to Search-a-licious. Each step retries once on transient 5xx.
        """
        headers = {"User-Agent": self.config["user_agent"]}
        async with httpx.AsyncClient(headers=headers, timeout=8.0) as client:
            try:
                products = await self._cgi_search(client, query, limit)
            except httpx.HTTPStatusError as exc:
                # 4xx is a real failure (bad request) — don't retry/fall back.
                if exc.response.status_code < 500:
                    raise
                log.warning(
                    "off_cgi_unavailable",
                    status=exc.response.status_code,
                    query=query,
                )
                products = await self._sal_search(client, query, limit)
        return [self._map(p) for p in products if p.get("code")]

    async def _cgi_search(
        self, client: httpx.AsyncClient, query: str, limit: int
    ) -> list[dict[str, Any]]:
        # action=process + search_simple=1 are required for the legacy cgi search to
        # actually execute the query rather than return the search form HTML.
        params: dict[str, str | int] = {
            "action": "process",
            "search_simple": 1,
            "search_terms": query,
            "json": 1,
            "page_size": min(limit, 50),
            "fields": _FIELDS,
        }
        data = await _get_json_with_retry(
            client,
            f"{self.config['base_url']}/cgi/search.pl",
            params=params,
        )
        prods = data.get("products")
        return list(prods) if isinstance(prods, list) else []

    async def _sal_search(
        self, client: httpx.AsyncClient, query: str, limit: int
    ) -> list[dict[str, Any]]:
        params: dict[str, str | int] = {
            "q": query,
            "page_size": min(limit, 50),
            "fields": _FIELDS,
        }
        data = await _get_json_with_retry(
            client,
            self.config["search_url"],
            params=params,
        )
        hits = data.get("hits")
        return list(hits) if isinstance(hits, list) else []

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

        serving_size = p.get("serving_size")
        kcal_g = _opt_f("energy-kcal_100g")
        kcal_ml = _opt_f("energy-kcal_100ml")
        unit = _detect_unit(p, has_ml_nutriments=kcal_ml is not None)
        return FoodItem(
            source="openfoodfacts",
            source_id=str(p.get("code", "")),
            name=p.get("product_name") or p.get("generic_name") or "Unknown",
            brand=p.get("brands"),
            serving_g=_opt_top_f("serving_quantity"),
            serving_label=(
                serving_size.strip()
                if isinstance(serving_size, str) and serving_size.strip()
                else None
            ),
            unit=unit,
            kcal_per_100g=kcal_g,
            protein_per_100g=_opt_f("proteins_100g"),
            carbs_per_100g=_opt_f("carbohydrates_100g"),
            fat_per_100g=_opt_f("fat_100g"),
            kcal_per_100ml=kcal_ml,
            protein_per_100ml=_opt_f("proteins_100ml"),
            carbs_per_100ml=_opt_f("carbohydrates_100ml"),
            fat_per_100ml=_opt_f("fat_100ml"),
        )


def _detect_unit(
    p: dict[str, Any], *, has_ml_nutriments: bool
) -> Literal["g", "ml"] | None:
    """Decide the product's natural measurement unit.

    Priority:
      1. serving_quantity_unit ("g" / "ml") — explicit from OFF
      2. product_quantity_unit — package-level unit, also explicit
      3. per-100ml nutriments present — strong signal it's a liquid
      4. "ml" / "L" appearing in the serving_size label
    Returns None when we genuinely can't tell, so the frontend can fall back
    to a safe default rather than guess wrong.
    """
    for key in ("serving_quantity_unit", "product_quantity_unit"):
        raw = p.get(key)
        if isinstance(raw, str):
            lowered = raw.strip().lower()
            if lowered in ("g", "kg"):
                return "g"
            if lowered in ("ml", "l", "cl"):
                return "ml"
    if has_ml_nutriments:
        return "ml"
    label = p.get("serving_size")
    if isinstance(label, str) and re.search(r"\b(ml|cl|l)\b", label.lower()):
        return "ml"
    if isinstance(label, str) and re.search(r"\b(g|kg|oz|lb)\b", label.lower()):
        return "g"
    return None


async def _get_json_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, str | int],
    attempts: int = 2,
    backoff_s: float = 0.6,
) -> dict[str, Any]:
    """GET + .json(), retrying once on transient 5xx. Raises HTTPStatusError on
    persistent 5xx so the caller can decide whether to fall back."""
    last_exc: httpx.HTTPStatusError | None = None
    for i in range(attempts):
        resp = await client.get(url, params=params)
        if 500 <= resp.status_code < 600:
            last_exc = httpx.HTTPStatusError(
                f"OFF {resp.status_code}", request=resp.request, response=resp
            )
            if i + 1 < attempts:
                await asyncio.sleep(backoff_s * (i + 1))
                continue
        resp.raise_for_status()
        return dict(resp.json())
    assert last_exc is not None  # noqa: S101
    raise last_exc
