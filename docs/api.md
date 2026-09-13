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

`MeOut`: `{ id, email, display_name, role, xp_total, level, timezone, show_weight_card, show_bp_card, weight_unit, must_change_password, disabled, equipped_title, title_hidden, weight_titles_opt_out, bp_titles_opt_out, show_bp_category, pending_title_unlocks }`. `disabled` is meaningful on `/admin/users` listings; it's always `false` on `/me` (a disabled user can't authenticate to call it).

`MePatchIn`: `{ show_weight_card?, show_bp_card?, weight_unit?, title_hidden?, weight_titles_opt_out?, bp_titles_opt_out?, show_bp_category? }` (where `weight_unit` is `"kg"` or `"lb"`).

`equipped_title` (nullable) and entries in `pending_title_unlocks` are `TitleSummary` shapes: `{ id, slug, name, rarity, category }`.

`GET /me` triggers a lazy title eligibility scan when `titles_last_scan_at` is older than 24h (or never set). Newly-unlocked titles surface in `pending_title_unlocks` (capped at 5 at a time) and remain there until acknowledged via `POST /titles/{id}/acknowledge`.

## Titles

The title catalog is shipped as code (synced from `app/data/titles_catalog.json` at FastAPI startup) and unlocked per-user when conditions are met. New unlocks are detected lazily on `GET /me` when the user's `titles_last_scan_at` is missing or older than 24h, and on user creation via `bootstrap_user_assets`. The scan groups titles by `condition_kind` and runs one aggregate query per kind regardless of catalog size.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/titles/categories` | — | `CategorySummary[]` |
| GET | `/titles?category=&limit=&offset=` | — | `TitleOut[]` |
| GET | `/titles/unlocked?limit=` | — | `TitleOut[]` ordered by unlock time desc |
| POST | `/titles/{title_id}/acknowledge` | — | 204 (dismisses the pending-unlock animation) |
| PATCH | `/titles/equipped` | `{ title_id }` (null clears) | `MeOut`; 400 if the user hasn't unlocked the title |

`TitleOut`: `{ id, slug, name, description, category, rarity, is_secret, sort_order, unlocked, unlocked_at, acknowledged_at }`.

`CategorySummary`: `{ category, total, unlocked }`. `total` excludes archived rows, titles in groups the user has opted out of, and secret titles the user hasn't unlocked.

Catalog browse omits secret titles the user hasn't unlocked and titles in opted-out groups (`weight_loss`, `bp`).

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

Every path in this section is mounted under **two** prefixes: the original `/activity/*` and an alias `/move/*` that serves the identical handlers. Ad/privacy blockers (uBlock, Brave, etc.) match the word "activity" in a URL and silently kill `POST /api/v1/activity` with `ERR_BLOCKED_BY_CLIENT`, so the PWA calls `/move/*` instead. `/activity/*` is retained for API-token / external consumers. The table lists the canonical `/activity` paths; prepend `/move` instead of `/activity` for the alias (e.g. `POST /api/v1/move`, `GET /api/v1/move/today`, `GET /api/v1/move/presets`).

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

## Steps

Steps are stored as append-only **deltas**, not as a running total — the daily figure is a SUM over the user's local day. The Home Assistant pull worker converts its cumulative sensor into deltas before insert; a manual log adds a delta the same way ("add 3,000 steps", not "the day is now 3,000").

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/steps/today?date=YYYY-MM-DD` | — | `{ date, total, goal, percent, entries[] }`. Each entry: `{ id, count, source, occurred_at, client_id }`. |
| POST | `/steps` | `{ count, client_id?, occurred_at? }` | 201, `StepsAddOut`. Writes `source='pwa'`. `count` is 1..200,000. |
| DELETE | `/steps/{id}` | — | 204, 404 if it isn't yours. |
| PATCH | `/steps/goal` | `{ target_steps }` | Returns `{ target_steps }`. 1..200,000. |

XP: `floor(count / 500)` per entry, capped at 20/day, plus the one-shot +50 when the daily goal is crossed. Default goal 8,000/day (`DEFAULT_STEPS_PER_DAY`), editable via `PATCH /steps/goal` (Settings → Steps goal).

`(user_id, client_id)` is unique, so a retried POST returns the existing row with `xp_delta: 0`.

Goal, XP and the `steps.daily_goal_met` event follow the day the entry's `occurred_at` lands on, so back-filling an older day reports that day's total rather than today's. Streaks are only extended when the entry belongs to today — back-filling must not rewrite streak history.

## Sleep

One row per session; `ended_at` is what "last night" is keyed on. A session belongs to the day it *ended*.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/sleep/last?date=YYYY-MM-DD` | — | `{ entry, goal_minutes }`. Without `date`, the most recent session whenever it was. With `date`, the latest session that ended that local day, or `entry: null`. |
| GET | `/sleep/recent?limit=N` | — | `SleepEntryOut[]`, newest first (default 14, max 60). |
| POST | `/sleep` | `{ started_at, ended_at, quality_score?, client_id? }` | 201, `SleepAddOut`. Writes `source='pwa'`. |
| DELETE | `/sleep/{id}` | — | 204, 404 if it isn't yours. |
| PATCH | `/sleep/goal` | `{ target_minutes }` | Returns `{ target_minutes }`. 1..1440. |

`ended_at` must be after `started_at` (422 otherwise) and no more than 10 minutes into the future (`400 future_time`). Duration is derived, never sent, and clamped to 24h. XP is flat per session, plus the +50 goal bonus when the session meets the goal (default 420 min, editable via `PATCH /sleep/goal` — Settings → Sleep goal, which takes hours + minutes and converts).

`(user_id, client_id)` is unique, so a retried POST returns the existing row with `xp_delta: 0`.

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

## Medications

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/medications?status=active\|past\|all` | — | Default `all`. Active first (by `sort_order`), then past most-recently-ended first. |
| GET | `/medications/options` | — | `{ forms, dose_units, change_kinds }` — the picker vocabularies, served so the UI can't drift from the DB CHECK constraints. |
| GET | `/medications/history?limit=N` | — | Every change across every medication, newest first (default 50, max 500). Each row is a `MedicationChange` plus `medication_name`. |
| POST | `/medications` | `MedicationIn` | 201. Also writes the opening `started` change row from the dose fields. |
| GET | `/medications/{id}` | — | `MedicationDetailOut` — the medication plus its `changes`, newest first. |
| PATCH | `/medications/{id}` | `MedicationPatch` | Identity fields only (`name`, `form`, `reason`, `prescriber`, `notes`, `started_on`). Appends nothing to the timeline. |
| DELETE | `/medications/{id}` | — | 204. Hard delete, cascades the timeline — for typos. Use `/stop` to retire a medication you actually took. |
| POST | `/medications/{id}/changes` | `MedicationChangeIn` | 201, returns the full detail. `kind` ∈ `dose_change`, `schedule_change`, `paused`, `note`. |
| DELETE | `/medications/{id}/changes/{change_id}` | — | 204. `400 cannot_delete_started` for the opening row. |
| POST | `/medications/{id}/stop` | `{ ended_on?, reason? }` | Sets `ended_on` (moves it to the past list) and appends a `stopped` row. `400 already_stopped`. |
| POST | `/medications/{id}/resume` | `{ effective_on?, note? }` | Clears `ended_on` and appends a `resumed` row; the `stopped` row stays. `400 not_stopped`. |
| POST | `/medications/reorder` | `{ ids: [int, …] }` | 204. Sets `sort_order` to the index in the array; unknown ids ignored. |

`MedicationIn`: `{ name, form?, reason?, prescriber?, notes?, started_on?, dose_amount?, dose_unit?, frequency? }`. `started_on` defaults to the user's local today.

`MedicationOut`: `{ id, name, form, reason, prescriber, notes, started_on, ended_on, stopped_reason, sort_order, active, dose_amount, dose_unit, frequency, change_count }`.

`MedicationChange`: `{ id, medication_id, kind, effective_on, dose_amount, dose_unit, frequency, note }`.

`medication_changes` is the append-only timeline, same spirit as the weight/BP target tables. **The current dose and schedule are not stored** — they're folded from the timeline in date order (`medication_service.fold_current`), each row carrying only what changed and nulls meaning "unchanged, carry forward". So a backdated row never overwrites a newer one.

`active` is exactly `ended_on IS NULL`. A stopped medication keeps its last known dose so the past list still shows what it was.

Dates are the user's local calendar dates and **may not be in the future** — `started_on`, `effective_on`, and `ended_on` all return `400 future_date`. Other 400 codes: `invalid_form`, `invalid_kind`, `ended_before_started`, `already_stopped`, `not_stopped`, `cannot_delete_started`.

Medications grant no XP and emit no webhook events, and nothing is seeded on user creation.

## Journal

Free-text notes about a day — what happened, what was worth remembering. Several notes per day are expected.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/journal?date=YYYY-MM-DD` | — | The notes filed under that day, **oldest first** (the order they were written). Defaults to the user's local today. |
| GET | `/journal/recent?limit=N` | — | Notes across every day, newest day first (default 50, max 365). |
| GET | `/journal/summary?date=YYYY-MM-DD` | — | `{ entry_date, count, latest }` for one day — what the dashboard card renders. |
| POST | `/journal` | `{ entry_date?, body }` | 201. `entry_date` defaults to the user's local today. |
| PATCH | `/journal/{id}` | `{ entry_date?, body? }` | Only the supplied fields change; nulls are ignored (a note has nothing that can be cleared). |
| DELETE | `/journal/{id}` | — | 204. Hard delete. |

`JournalEntryOut`: `{ id, entry_date, body, created_at, updated_at }`.

`entry_date` is the day the note is *about* (the user's local calendar date) and is what the day switcher filters on; `created_at` only orders notes within that day. Back-dating is therefore just picking an earlier `entry_date` — and it may not be in the future (`400 future_date`, on both POST and PATCH). `body` is 1–4000 chars, trimmed on write; empty or oversized bodies are `422`.

A note is unedited exactly while `updated_at == created_at` (both are the insert transaction's `now()`), which is what the UI's "edited" marker keys off.

Journal entries grant no XP, emit no webhook events, have no streaks, and nothing is seeded on user creation. Audit rows record the date and body length, never the note itself.

## Sexual activity (paths say `intimacy`)

The sexual-activity log that lives inside the period section. Paths, the table
and the feature key all say `intimacy` rather than `sex` for the same reason
activity is aliased to `/move`: ad, privacy and DNS filters match the word in a
URL and kill the request with no useful error.

Gated on the `intimacy` feature key, which is the one tracker that is **off by
default** — it only appears once the user turns it on under Settings → Trackers.
The API itself is not gated; the toggle is a UI concern, like every other
feature key.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/period/intimacy?days=N` | — | Entries within the window, newest first (default 180, max 730). |
| GET | `/period/intimacy/day?date=YYYY-MM-DD` | — | One day's entries, **oldest first** (the order they were logged). Defaults to the user's local today. |
| GET | `/period/intimacy/summary?days=N` | — | `{ days, count, last_entry_date }` — counts only, nothing about what was logged. |
| POST | `/period/intimacy` | `{ entry_date?, kind?, protection?, tags?, note? }` | 201. Everything is optional: defaults are the user's local today, `partnered`, `unspecified`, `[]`, `null`. |
| PATCH | `/period/intimacy/{id}` | any subset of the above | Only supplied fields change. An explicit `note: null` clears the note — the only field that can be emptied. |
| DELETE | `/period/intimacy/{id}` | — | 204. Hard delete. |

`IntimacyEntryOut`: `{ id, entry_date, kind, protection, tags, note, created_at, updated_at }`.

- `kind`: `partnered | solo`. `solo` covers masturbation — Clue and Flo keep it in the same log.
- `protection`: `protected | unprotected | withdrawal | unspecified`. `unspecified` means "logged it, didn't say" and is deliberately distinct from `unprotected`.
- `tags`: any of `orgasm`, `no_orgasm`, `high_drive`, `low_drive`, `painful`, `toys`, `fantasies`, `bleeding`. Deduped and sorted on write.
- `note`: ≤500 chars, trimmed; empty becomes `null`.

Unlike `period_entries` (one upserted row per date, because a day has one flow)
this is a plain log: **several entries per day are allowed**, ordered by
`created_at` within the day. `entry_date` is the user's local calendar date and
may not be in the future (`400 future_date`, on POST and PATCH). Unknown `kind`,
`protection` or tag values are `422`.

No XP, no webhook events, no streaks, nothing seeded on user creation. Audit rows
carry the `entry_date` and nothing else — kind, protection, tags and the note
never reach the audit log.

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
| POST | `/ha/steps/add` | `steps:write` | `{ count, client_id?, occurred_at? }` | `StepsAddOut` |
| GET | `/ha/steps/today` | `steps:read` | — | `StepsTodayOut` (entries omitted) |
| POST | `/ha/sleep/add` | `sleep:write` | `{ started_at, ended_at, quality_score?, client_id? }` | `SleepAddOut` |
| GET | `/ha/sleep/last` | `sleep:read` | — | `SleepLastOut` |
| GET | `/ha/me/stats` | `me:read` | — | `{ xp_total, level, streaks, water_today, steps_today, sleep_last_night, … }` |

These write `source='ha'`. The user-facing `POST /steps` and `POST /sleep` above are the manual equivalents and write `source='pwa'` — Home Assistant is one way to fill these in, not the only one.

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
