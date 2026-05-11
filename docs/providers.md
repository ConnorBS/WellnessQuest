# Adding providers and integrations

WellnessQuest separates external systems into two registries:

- **Providers** (`backend/app/providers/`): read-side data sources. Example: food databases.
- **Integrations** (`backend/app/integrations/`): write/notify-side channels. Example: Home Assistant outbound webhook.

Both share the same registry shape (`app/providers/base.Registry`) and the same lifecycle: importing the package registers all implementations via decorators.

## Add a new food provider

```python
# backend/app/providers/food/nutritionix.py
from pydantic import BaseModel
from app.providers.food.base import FoodItem, FoodProvider, food_providers

class NutritionixConfig(BaseModel):
    app_id: str
    app_key: str

@food_providers.register
class NutritionixProvider(FoodProvider):
    kind = "nutritionix"
    label = "Nutritionix"
    config_schema = NutritionixConfig

    async def search(self, query: str, limit: int = 20) -> list[FoodItem]:
        ...

    async def by_barcode(self, code: str) -> FoodItem | None:
        ...
```

Then add `from app.providers.food import nutritionix` to `backend/app/providers/food/__init__.py` so the decorator runs at import time. That's it — the kind appears in `food_providers.kinds()` and admin UI listings.

## Add a new outbound channel

```python
# backend/app/integrations/ntfy/outbound.py
from pydantic import BaseModel
from app.integrations.base import IntegrationChannel, channels

class NtfyConfig(BaseModel):
    base_url: str
    topic: str

@channels.register
class NtfyChannel(IntegrationChannel):
    kind = "ntfy"
    label = "ntfy.sh"
    config_schema = NtfyConfig

    async def emit(self, event, payload):
        ...
```

Import it from `backend/app/integrations/__init__.py` and it shows up under `GET /api/v1/integrations/kinds`. The admin UI will render the form from `NtfyConfig`.

## Conventions

- `kind` is the persistent ID stored in the `integrations.kind` column. Pick a stable snake_case slug.
- Configuration goes in `config` (plaintext JSONB). Anything sensitive (API keys, OAuth tokens) goes in `secrets` (Fernet-encrypted in a follow-up; today it's plain JSON — do not put real production secrets here yet).
- All async I/O should use `httpx.AsyncClient` with a `timeout=` keyword. Default timeout: 5–8 s.
- Return `tuple[int, str]` from `IntegrationChannel.emit`: `(status_code, response_body)`. The webhook dispatcher persists both for diagnostics.
