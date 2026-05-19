from __future__ import annotations

import asyncio
import re
from typing import Any, Literal

import httpx
from pydantic import BaseModel, ValidationError

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
        items: list[FoodItem] = []
        for p in products:
            if not p.get("code"):
                continue
            try:
                items.append(self._map(p))
            except ValidationError as exc:
                # One bad product (unexpected field type from OFF) shouldn't
                # tank the whole search. Log and skip so the user still sees
                # the other hits.
                log.warning(
                    "off_map_validation_failed",
                    code=p.get("code"),
                    errors=str(exc),
                )
        return items

    async def _cgi_search(
        self, client: httpx.AsyncClient, query: str, limit: int
    ) -> list[dict[str, Any]]:
        # action=process + search_simple=1 are required for the legacy cgi search to
        # actually execute the query rather than return the search form HTML.
        # `lc=en` picks the English localized name (`product_name_en`) when
        # present and biases ranking; `cc=ca` weights the Canadian product
        # catalogue. Neither is a hard filter — non-English products still
        # appear in the long tail.
        params: dict[str, str | int] = {
            "action": "process",
            "search_simple": 1,
            "search_terms": query,
            "json": 1,
            "page_size": min(limit, 50),
            "fields": _FIELDS,
            "lc": "en",
            "cc": "ca",
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
        # Search-a-licious uses different parameter names than the legacy
        # cgi endpoint — `langs` (plural, ISO-639-1) and `countries_tags`
        # (lowercase country slug) — for the same purpose.
        params: dict[str, str | int] = {
            "q": query,
            "page_size": min(limit, 50),
            "fields": _FIELDS,
            "langs": "en",
            "countries_tags": "canada",
        }
        data = await _get_json_with_retry(
            client,
            self.config["search_url"],
            params=params,
        )
        hits = data.get("hits")
        return list(hits) if isinstance(hits, list) else []

    async def by_barcode(self, code: str) -> FoodItem | None:
        # `lc=en` controls which `product_name_<lang>` localization OFF
        # returns as the primary `product_name`. Bilingual Canadian
        # products (most packaged goods on shelves) return the English
        # name here instead of French.
        url = f"{self.config['base_url']}/api/v2/product/{code}.json"
        async with httpx.AsyncClient(
            headers={"User-Agent": self.config["user_agent"]}, timeout=8.0
        ) as client:
            resp = await client.get(url, params={"lc": "en", "cc": "ca"})
            if resp.status_code != 200:
                return None
            data = resp.json()
        if data.get("status") != 1:
            return None
        return self._map(data["product"])

    @staticmethod
    def _map(p: dict[str, Any]) -> FoodItem:
        nutr_raw = p.get("nutriments")
        nutr: dict[str, Any] = nutr_raw if isinstance(nutr_raw, dict) else {}

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

        def _opt_s(key: str) -> str | None:
            # OFF occasionally returns string fields as a dict (multilingual
            # hash like {"en": "..."}) or a list ("brands" can arrive as a
            # tag array on some endpoints). Reject anything that isn't a
            # non-empty string rather than handing the wrong type to Pydantic.
            v = p.get(key)
            return v.strip() or None if isinstance(v, str) else None

        serving_label_raw = p.get("serving_size")
        serving_label = (
            serving_label_raw.strip() or None
            if isinstance(serving_label_raw, str)
            else None
        )
        kcal_g = _opt_f("energy-kcal_100g")
        kcal_ml = _opt_f("energy-kcal_100ml")
        unit = _detect_unit(p, has_ml_nutriments=kcal_ml is not None)

        # Extended panel from OFF's nutriments dict, when available. OFF uses
        # SI base units everywhere: grams for solids, milligrams for minerals
        # except sodium (g — converted), vitamins typically in mg/µg as
        # appropriate. We normalize to the same key set the rest of the app
        # uses; missing fields are simply omitted from the dict.
        ext: dict[str, float] = {}

        def _put(key: str, val: float | None) -> None:
            if val is not None:
                ext[key] = round(val, 4)

        # Fats — OFF returns saturated and trans in grams.
        _put("saturated_fat_g", _opt_f("saturated-fat_100g"))
        _put("trans_fat_g", _opt_f("trans-fat_100g"))
        # Sugars / fibre — fibre key is "fiber" in OFF (US spelling).
        _put("sugars_g", _opt_f("sugars_100g"))
        _put("fibre_g", _opt_f("fiber_100g"))
        # Cholesterol — OFF stores in grams; convert to mg.
        chol_g = _opt_f("cholesterol_100g")
        _put("cholesterol_mg", chol_g * 1000 if chol_g is not None else None)
        # Sodium — OFF stores in grams; convert to mg.
        sodium_g = _opt_f("sodium_100g")
        _put("sodium_mg", sodium_g * 1000 if sodium_g is not None else None)
        # Potassium / Calcium / Iron — OFF in grams.
        for off_key, our_key in (
            ("potassium_100g", "potassium_mg"),
            ("calcium_100g", "calcium_mg"),
            ("iron_100g", "iron_mg"),
            ("magnesium_100g", "magnesium_mg"),
            ("phosphorus_100g", "phosphorus_mg"),
            ("zinc_100g", "zinc_mg"),
        ):
            raw = _opt_f(off_key)
            _put(our_key, raw * 1000 if raw is not None else None)
        # Vitamins — OFF in grams for vit C / E / niacin / B-vits etc.
        for off_key, our_key, scale in (
            ("vitamin-a_100g", "vit_a_mcg_rae", 1_000_000),
            ("vitamin-c_100g", "vit_c_mg", 1000),
            ("vitamin-d_100g", "vit_d_mcg", 1_000_000),
            ("vitamin-e_100g", "vit_e_mg", 1000),
            ("vitamin-k_100g", "vit_k_mcg", 1_000_000),
            ("vitamin-b1_100g", "thiamin_mg", 1000),
            ("vitamin-b2_100g", "riboflavin_mg", 1000),
            ("vitamin-pp_100g", "niacin_mg", 1000),
            ("vitamin-b6_100g", "vit_b6_mg", 1000),
            ("vitamin-b9_100g", "folate_mcg_dfe", 1_000_000),
            ("vitamin-b12_100g", "vit_b12_mcg", 1_000_000),
            ("pantothenic-acid_100g", "pantothenate_mg", 1000),
        ):
            raw = _opt_f(off_key)
            _put(our_key, raw * scale if raw is not None else None)

        return FoodItem(
            source="openfoodfacts",
            source_id=str(p.get("code", "")),
            name=_opt_s("product_name") or _opt_s("generic_name") or "Unknown",
            brand=_opt_s("brands"),
            serving_g=_opt_top_f("serving_quantity"),
            serving_label=serving_label,
            unit=unit,
            kcal_per_100g=kcal_g,
            protein_per_100g=_opt_f("proteins_100g"),
            carbs_per_100g=_opt_f("carbohydrates_100g"),
            fat_per_100g=_opt_f("fat_100g"),
            kcal_per_100ml=kcal_ml,
            protein_per_100ml=_opt_f("proteins_100ml"),
            carbs_per_100ml=_opt_f("carbohydrates_100ml"),
            fat_per_100ml=_opt_f("fat_100ml"),
            nutrients_per_100g=ext or None,
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
