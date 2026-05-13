# API reference

All routes are under `/api/v1`. JSON only.

- **User routes**: `Authorization: Bearer <access_jwt>`. Access tokens expire after 15 minutes; refresh via `/auth/refresh`.
- **HA routes**: `X-WQ-Token: wq_ha_...`. Scope-gated. Issued from the UI (Settings → Tokens), shown exactly once.

Live OpenAPI docs at `/docs` (Swagger) and `/openapi.json`.

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

`MeOut`: `{ id, email, display_name, role, xp_total, level, timezone, show_weight_card, weight_unit, must_change_password }`.

`MePatchIn`: `{ show_weight_card?, weight_unit? }` (where `weight_unit` is `"kg"` or `"lb"`).

## Water

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/water/today?date=YYYY-MM-DD` | — | Today by default. Returns `{ date, total_ml, goal_ml, percent, entries[] }`. |
| POST | `/water` | `{ ml, client_id?, occurred_at? }` | Returns `{ entry, total_ml, goal_ml, xp_delta, goal_met }`. |
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
| GET | `/activity/today?date=YYYY-MM-DD` | — | Returns `{ date, total_minutes, goal_minutes, percent, entries[] }`. |
| POST | `/activity` | `{ minutes, client_id?, occurred_at?, exercise_type? }` | Returns `ActivityAddOut`. |
| DELETE | `/activity/{id}` | — | 204. |
| PATCH | `/activity/goal` | `{ target_minutes }` | Returns `{ target_minutes }`. |
| GET | `/activity/presets` | — | `ActivityPresetOut[]`. |
| POST | `/activity/presets` | `ActivityPresetIn` | 201. |
| PATCH | `/activity/presets/{id}` | `ActivityPresetIn` | Updated row. |
| DELETE | `/activity/presets/{id}` | — | 204. |

`ActivityPreset`: `{ id, label, minutes, exercise_type, icon_kind, icon_key, sort_order }`. `exercise_type` is free-text (`Walking`, `Running`, etc.); presets pre-tag their entries with it when used as a quick-add.

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

Events emitted: `water.goal_met`, `activity.goal_met`.

## Home Assistant–facing

Header: `X-WQ-Token: wq_ha_...`. Rate-limited.

| Method | Path | Scope | Body | Returns |
|---|---|---|---|---|
| POST | `/ha/water/add` | `water:write` | `{ ml, client_id? }` | `WaterAddOut` |
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
