# API reference

All routes are under `/api/v1`. JSON only.

- **User routes**: `Authorization: Bearer <access_jwt>`. Access tokens expire after 15 minutes; refresh via `/auth/refresh`.
- **HA routes**: `X-WQ-Token: wq_ha_...`. Scope-gated. Issued from the UI (Settings → Tokens), shown exactly once.

Live OpenAPI docs at `/docs` (Swagger) and `/openapi.json`.

Entry-shape values that recur below:

- `source` (on water/food/activity entries) is `'pwa' | 'ha' | 'manual'`. Web app writes `'pwa'`; the Home Assistant adapter under `/ha/...` writes `'ha'` (water only — no HA write endpoint exists for food or activity); `'manual'` is reserved for direct DB inserts.
- `icon_kind` (on every preset and on habits) is `'builtin' | 'upload' | 'none'`. `'builtin'` keys into the Material Design Icons catalog; `'upload'` keys into `/uploads/{id}`.

## Setup

Public, gated by "no active admin exists". Once the first admin is created the
create endpoint returns 409 — additional users go through the authenticated
admin API below.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/setup/status` | — | `{ setup_required: bool }` |
| POST | `/setup/admin` | `{ email, password, display_name, timezone? }` | `{ user, tokens }` |

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `TokenPair` |
| POST | `/auth/refresh` | `{ refresh_token }` | `TokenPair` (rotated) |
| POST | `/auth/logout` | `{ refresh_token }` | 204 |
| POST | `/auth/change-password` | `{ current_password, new_password }` | `TokenPair` (rotated; other sessions revoked) |

`TokenPair`: `{ access_token, refresh_token, access_expires_at, token_type }`.

## Me / preferences

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/me` | — | `MeOut` |
| PATCH | `/me` | `MePatchIn` | `MeOut` |

`MeOut`: `{ id, email, display_name, role, xp_total, level, timezone, show_weight_card, show_bp_card, weight_unit, must_change_password, disabled }`. `disabled` is meaningful on `/admin/users` listings; it's always `false` on `/me` (a disabled user can't authenticate to call it).

`MePatchIn`: `{ show_weight_card?, show_bp_card?, weight_unit? }` (where `weight_unit` is `"kg"` or `"lb"`).

## Water

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/water/today?date=YYYY-MM-DD` | — | Today by default. Returns `{ date, total_ml, goal_ml, percent, entries[] }`. Each entry: `{ id, ml, source, occurred_at, client_id, name }`. |
| GET | `/water/recent?limit=N` | — | Most-recently-logged distinct named entries (default 8, max 20). Returns `[{ name, ml, last_logged_at }, …]` for the quick-log modal's name dropdown. |
| POST | `/water` | `{ ml, client_id?, occurred_at?, name? }` | Returns `{ entry, total_ml, goal_ml, xp_delta, goal_met }`. `name` is an optional free-form label up to 60 chars (e.g. "Bottle", "Coffee"). |
| DELETE | `/water/{id}` | — | 204. |
| PATCH | `/water/goal` | `{ target_ml }` | Returns `{ target_ml }`. Updates the active water_ml/day goal. |
| GET | `/water/presets` | — | `WaterPresetOut[]`. |
| POST | `/water/presets` | `WaterPresetIn` | 201. |
| PATCH | `/water/presets/{id}` | `WaterPresetIn` | Updated row. |
| DELETE | `/water/presets/{id}` | — | 204. |

`WaterPreset`: `{ id, label, volume_ml, icon_kind, icon_key, sort_order }`. `icon_kind` is `"builtin" | "upload" | "none"`.

Idempotency on POST `/water`: when `client_id` is provided, the same `(user_id, client_id)` pair is unique. Re-POSTing the same `client_id` returns the existing row with `xp_delta: 0`.

## Activity

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/activity/today?date=YYYY-MM-DD` | — | Returns `{ date, total_minutes, goal_minutes, percent, entries[] }`. Each entry: `{ id, minutes, source, occurred_at, client_id, exercise_type, name }`. |
| GET | `/activity/recent?limit=N` | — | Recently-logged entries that have a name or exercise_type (default 12, max 30). Returns `[{ name, exercise_type, minutes, last_logged_at }, …]`. The quick-log modal builds two separate dropdowns from this — one of distinct names, one of distinct exercise types. |
| POST | `/activity` | `{ minutes, client_id?, occurred_at?, exercise_type?, name? }` | Returns `ActivityAddOut`. `name` is a free-form label (≤ 60 chars); `exercise_type` is the categorical tag. |
| DELETE | `/activity/{id}` | — | 204. |
| PATCH | `/activity/goal` | `{ target_minutes }` | Returns `{ target_minutes }`. |
| GET | `/activity/presets` | — | `ActivityPresetOut[]`. |
| POST | `/activity/presets` | `ActivityPresetIn` | 201. |
| PATCH | `/activity/presets/{id}` | `ActivityPresetIn` | Updated row. |
| DELETE | `/activity/presets/{id}` | — | 204. |

`ActivityPreset`: `{ id, label, minutes, exercise_type, icon_kind, icon_key, sort_order }`. `exercise_type` is free-text (`Walking`, `Running`, etc.); presets pre-tag their entries with it when used as a quick-add.

Note: activity does NOT enforce a `(user_id, client_id)` unique constraint today, so retried POSTs with the same `client_id` will create duplicate rows. Water and food do enforce it.

## Food

The food module's daily goal is a **ceiling** (compliant = total ≤ target). XP per food log is a flat +1 (max 5/day) regardless of kcal — it doesn't reward over-eating.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/food/today?date=YYYY-MM-DD` | — | Returns `FoodTodayOut`: `{ date, total_kcal, target_kcal, percent, over_target, remaining_kcal, macros, entries[] }`. `remaining_kcal` can be negative; `percent` can exceed 100 (capped at 999). |
| POST | `/food` | `FoodAddIn` | Returns `{ entry, total_kcal, target_kcal, xp_delta, over_target }`. Triggers `food.target_exceeded` webhook once when the ceiling is crossed. |
| DELETE | `/food/{id}` | — | 204. |
| PATCH | `/food/goal` | `{ target_kcal }` (1..20000) | Returns `{ target_kcal }`. The goal row is auto-created on first read with a default if it doesn't exist yet. |
| GET | `/food/recent?limit=N` | — | Most-recently-logged distinct foods (default 8, max 20). Each: `{ name, brand, kcal, protein_g, carbs_g, fat_g, meal_type, provider, provider_id, last_logged_at }`. |
| GET | `/food/search?q=...&limit=N` | — | Open Food Facts search. `q` ≥2 chars. Returns `{ query, hits[] }`. 502 on upstream failure (rate-limit/transport). |
| GET | `/food/barcode/{code}` | — | Single-product OFF lookup by barcode (`code` 6–14 digits). Returns one `FoodSearchHit`. 400 `bad_barcode`, 404 if OFF has no match. |
| GET | `/food/presets` | — | `FoodPresetOut[]`. |
| POST | `/food/presets` | `FoodPresetIn` | 201. |
| PATCH | `/food/presets/{id}` | `FoodPresetIn` | Updated row. |
| DELETE | `/food/presets/{id}` | — | 204. |

`FoodAddIn`: `{ name, brand?, kcal, protein_g?, carbs_g?, fat_g?, meal_type?, provider?, provider_id?, client_id?, occurred_at? }`. `meal_type` ∈ `"breakfast" | "lunch" | "dinner" | "snack"` (CHECK-enforced). `provider` + `provider_id` are free-form tracing tags (typically `"openfoodfacts"` + the OFF product code) — the server doesn't validate them against any registry.

`FoodEntryOut`: `{ id, name, brand, kcal, protein_g, carbs_g, fat_g, meal_type, source, provider, provider_id, occurred_at, client_id }`. Macros are stored as already-multiplied gram values for the logged portion (not per-100g) — the frontend does the per-serving math at log time.

`FoodSearchHit` carries both `_per_100g` and `_per_100ml` nutriments plus an optional `unit: "g" | "ml"` hint so the picker knows which to use.

Idempotency on POST `/food`: same `(user_id, client_id)` rule as water — re-POSTing the same `client_id` returns the existing row with `xp_delta: 0`.

Food is **not** seeded by `bootstrap_user_assets` — no default goal, no presets. The goal materialises on first GET/PATCH; presets stay empty until the user creates them.

## Habits

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/habits?date=YYYY-MM-DD` | — | List with status computed as of the given date (today by default). |
| POST | `/habits` | `HabitIn` | 201. |
| PATCH | `/habits/{id}` | `HabitIn` | Updated row. |
| DELETE | `/habits/{id}` | — | 204 (soft delete via `archived_at`). |
| POST | `/habits/reorder` | `{ ids: [uuid, …] }` | 204. Sets sort_order to the index in the array. |
| POST | `/habits/{id}/checkins/toggle?date=YYYY-MM-DD` | — | Toggles today's checkin (or the given past date). 400 if the date is in the future. |

`HabitIn`: `{ name, icon_kind, icon_key, cadence_kind, weekly_target?, monthly_target?, interval_days?, sort_order }`.

`cadence_kind`: `"daily"` | `"weekly"` (requires `weekly_target` 1..7) | `"monthly"` (requires `monthly_target` 1..31) | `"interval"` (requires `interval_days` 2..365).

The list endpoint returns `HabitWithStatusOut`: each item has `{ habit, status }` where `status` is `{ status: "done"|"ok"|"due_today"|"overdue", done_today, last_checked_on, period_count?, period_target?, period_ends_on?, days_since_last?, days_until_due?, streak }`.

## Weight

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/weight/summary` | — | `{ unit, latest, prior_week, delta_kg, current_target }`. |
| GET | `/weight?limit=N` | — | History of entries, newest first (default 90, max 365). |
| POST | `/weight` | `{ weight_kg, occurred_at?, note? }` | 201. |
| DELETE | `/weight/{id}` | — | 204. |
| GET | `/weight/targets?limit=N` | — | Append-only target history, newest first. |
| GET | `/weight/targets/current` | — | Latest `WeightTargetOut` or `null`. |
| POST | `/weight/targets` | `{ target_kg?, effective_at? }` | 201. `target_kg: null` records "no goal as of effective_at". |
| DELETE | `/weight/targets/{id}` | — | 204. |

`WeightTarget`: `{ id, target_kg, effective_at }`. Each save is a new row — the table is the audit trail. "Current target" = latest row. NULL `target_kg` = explicit clear.

## Blood pressure

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/blood-pressure/summary` | — | `{ latest, current_target }`. |
| GET | `/blood-pressure?limit=N` | — | History newest first (default 90, max 365). Each entry: `{ id, systolic, diastolic, pulse, occurred_at, note }`. |
| POST | `/blood-pressure` | `{ systolic, diastolic, pulse?, occurred_at?, note? }` | 201. Server enforces `systolic > diastolic`, `systolic` in `[1, 299]`, `diastolic` in `[1, 199]`, `pulse` in `[1, 299]` when present. |
| DELETE | `/blood-pressure/{id}` | — | 204. |
| GET | `/blood-pressure/targets?limit=N` | — | Append-only target history, newest first. |
| GET | `/blood-pressure/targets/current` | — | Latest `BloodPressureTargetOut` or `null`. |
| POST | `/blood-pressure/targets` | `{ target_systolic?, target_diastolic?, effective_at? }` | 201. Both fields null records "no goal as of effective_at"; otherwise both required together (sys > dia). |
| DELETE | `/blood-pressure/targets/{id}` | — | 204. |

`BloodPressureTarget`: `{ id, target_systolic, target_diastolic, effective_at }`. Each save is a new row. "Current target" = latest row. Both fields NULL = explicit clear.

Category (Normal / Elevated / Stage 1 / Stage 2 / Crisis) is computed client-side per AHA 2017 thresholds — the API does not include it on entries, so a guideline update never requires a backfill.

## Uploads (custom icons)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/uploads/icons` | multipart `file` | Pillow validates the image, resizes to 512px max, re-encodes as WebP. ≤5 MB. Returns `{ id, filename, content_type, size_bytes, url }`. |
| GET | `/uploads/{id}` | — | Serves the file. **Public** (UUID-keyed, unguessable). |

Uploads land on the host volume mounted at `/app/data/uploads/<user_id>/<upload_id>.webp` inside the container.

## API tokens (HA)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api-tokens` | `{ name, scopes? }` | `{ id, name, scopes, token, created_at }` — `token` shown once |
| GET | `/api-tokens` | — | `[{ id, name, scopes, last_used_at, created_at, revoked_at }]` |
| DELETE | `/api-tokens/{id}` | — | 204 (revokes) |

Allowed scopes: `water:read`, `water:write`.

## Integrations + webhooks

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/integrations/kinds` | — | `{ channels: [{kind, label}] }` |
| POST | `/integrations` | `{ kind, name, config, secrets? }` | `IntegrationOut` |
| GET | `/integrations` | — | `IntegrationOut[]` |
| DELETE | `/integrations/{id}` | — | 204 |
| POST | `/integrations/{id}/webhooks` | `{ event, url }` | `WebhookSubscriptionOut` |
| GET | `/integrations/{id}/webhooks` | — | `WebhookSubscriptionOut[]` |
| DELETE | `/integrations/{id}/webhooks/{sub_id}` | — | 204 |

Events emitted: `water.goal_met`, `activity.goal_met`, `food.target_exceeded`. These are the only three. Each fires once per crossing (see CLAUDE.md → "Goal-met events fire exactly once per crossing"). Habits, weight, and BP do not emit events. Delivery retries: 5 attempts, exponential backoff starting at 30s (`webhook_dispatcher.py`).

## Home Assistant–facing

Header: `X-WQ-Token: wq_ha_...`. Rate-limited.

| Method | Path | Scope | Body | Returns |
|---|---|---|---|---|
| POST | `/ha/water/add` | `water:write` | `{ ml, client_id?, name? }` | `WaterAddOut` |
| GET | `/ha/water/today` | `water:read` | — | `WaterTodayOut` (entries omitted) |
| GET | `/ha/me/stats` | `water:read` | — | `{ xp_total, level, streaks }` |

## Telemetry

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/telemetry/events` | `{ events: [{ level, message, stack?, context }] }` (≤ 100) | `{ accepted }` |

## Admin

Requires `role: admin`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/admin/users` | — | `MeOut[]` |
| POST | `/admin/users` | `{ email, display_name, password, role?, timezone? }` | 201 `MeOut` (new user starts with `must_change_password=true`) |
| PATCH | `/admin/users/{user_id}` | `{ display_name?, role?, disabled? }` | `MeOut` (400 `last_admin` if the change would leave zero active admins) |
| DELETE | `/admin/users/{user_id}` | — | 204 (soft-disable; revokes outstanding refresh sessions; 400 `last_admin` guard) |
| POST | `/admin/users/{user_id}/reset-password` | `{ password }` | 204 (sets `must_change_password=true`, revokes the user's refresh sessions) |

## Meta

- `GET /api/v1/healthz` → `{ status: "ok" }`
