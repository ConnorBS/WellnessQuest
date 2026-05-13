# Architecture

WellnessQuest is a monorepo that builds to a **single unified Docker image**. FastAPI serves both the REST API at `/api/v1/*` and the statically-exported Next.js PWA at `/`. The user brings their own Postgres 16+.

```
phones / browsers ──┐
                    │
Home Assistant ─────┼──────► ghcr.io/connorbs/wellnessquest container
                    │              │
                    │              ├── FastAPI (uvicorn)
                    │              │     ├── /api/v1/* (REST + HA adapter)
                    │              │     └── / (static Next.js bundle)
                    │              │
                    │              └── /app/data (uploaded preset icons)
                    │                          │
                    │                          ▼
                    │                    user-supplied Postgres 16+
                    │
                    └── outbound webhooks ◄────────  (webhook_dispatcher
                                                       background task)
```

## Modules

Five trackers, each following the same shape:

| Module | Tables | Service | Router prefix |
|---|---|---|---|
| Water | `water_entries`, `water_presets`, `goals` (metric=`water_ml`) | `water_service` | `/api/v1/water`, `/api/v1/water/presets` |
| Food | `food_entries`, `food_presets`, `goals` (metric=`food_kcal`, ceiling) | `food_service` | `/api/v1/food`, `/api/v1/food/presets`, `/api/v1/food/search` |
| Activity | `activity_entries`, `activity_presets`, `goals` (metric=`active_minutes`) | `activity_service` | `/api/v1/activity`, `/api/v1/activity/presets` |
| Habits | `habits`, `habit_checkins` | `habit_service` | `/api/v1/habits` |
| Weight | `weight_entries`, `weight_targets` | `weight_service` | `/api/v1/weight` |

The food module differs from water/activity in two ways: the daily goal is a
**ceiling** (compliant = total ≤ target), and entries can carry optional macro
breakdowns (`protein_g`, `carbs_g`, `fat_g`) and a `meal_type` tag for grouping.
Search-as-you-type is backed by the Open Food Facts provider; selected hits are
logged at user-chosen gram amounts (the frontend does the per-100g math).
Streaks are not wired for `food_kcal` yet — ceiling compliance can only be
evaluated at end-of-day, so the streak service would need a separate path.

Shared across all four:

- `Goal` model is metric-keyed (`water_ml`, `active_minutes`) — water and activity reuse it; habits have their own cadence model; weight uses the versioned `weight_targets` table.
- `XpEvent`, `Streak`, `WebhookSubscription` are all metric-tagged.
- `UploadFile` + `uploads_service` handle user-uploaded preset/habit icons.
- The Material Design Icons catalog (`@mdi/js`) is a lazy-loaded chunk in the frontend; icon resolution is one `<MdiIcon name="…">` component.

## Backend (FastAPI)

Module layout under `backend/app/`:

- `main.py` — app factory, middleware (CORS, RequestContext), lifespan that starts the webhook dispatcher, `StaticFiles` mount that serves the Next.js bundle at `/`.
- `api/v1/` — routers. Thin: validate input, call a service, return a schema.
- `services/` — own transactions; emit XP / telemetry / webhook events through `services.events.emit`.
- `providers/` — read-side abstractions (food data; future weight scales).
- `integrations/` — write/notify-side abstractions (Home Assistant; future ntfy, Discord).
- `auth/` — user session JWT (`jwt.py`) and long-lived HA API tokens (`api_tokens.py`).
- `telemetry/` — request middleware, structured logger, recorder helpers (`audit`, `capture_error`).
- `db/` — declarative base with deterministic naming convention; async session factory.
- `models/` — one module per table.

### Invariants

- Routers do not contain raw SQL; everything goes through services or model `select(...)` statements.
- Every router uses `Depends(current_user)` or `Depends(current_ha_token(scope))`.
- HA endpoints are scope-gated and live under `/api/v1/ha/...`.
- User and HA auth use **different** headers (`Authorization` vs `X-WQ-Token`) so a leaked HA token cannot be replayed against user endpoints.
- All "today" math uses `services.time_utils.day_for_user(timezone, instant)`. Never `datetime.now()` of server local time inside services.

## Frontend (Next.js 15 App Router, PWA)

- App Router under `src/app/`. `(app)` group is auth-guarded.
- TanStack Query for data; `lib/api.ts` wraps fetch with JWT and refresh-on-401.
- `DayProvider` (`lib/day-context.tsx`) gives every page a `viewedDay` + `goToPrev/Next/Today`. Horizontal swipe + arrow buttons navigate days; the right arrow is hard-disabled at today.
- Data hooks include the viewed day in their React Query key so per-day caches stay separate.
- `public/sw.js` is a hand-rolled service worker: app-shell precache, network-first for `/api/v1/**` GETs, IndexedDB-backed Background Sync queue for `POST /api/v1/water`. The server enforces idempotency via the `(user_id, client_id)` unique constraint. (Service worker registration requires a secure context — only active when served over HTTPS or `localhost`.)

## Database

Postgres 16+. Single database, single role. Multi-tenant via `user_id` FK on every row. Naming convention is locked in `app/db/base.py` so Alembic autogenerate produces deterministic index/FK names.

Current tables:

- **Identity**: `users`, `sessions`, `api_tokens` (the first admin is created via the public `/api/v1/setup/admin` flow when the DB has no admin yet; additional users come from `/api/v1/admin/users`)
- **Water**: `water_entries`, `water_presets`
- **Food**: `food_entries`, `food_presets`
- **Activity**: `activity_entries`, `activity_presets`
- **Habits**: `habits`, `habit_checkins`
- **Weight**: `weight_entries`, `weight_targets`
- **Cross-cutting**: `goals`, `streaks`, `xp_events`, `upload_files`
- **Operations**: `audit_log`, `error_log`
- **Outbound**: `integrations`, `webhook_subscriptions`, `webhook_deliveries`

Migration chain is linear: `0001_initial` → `0002_water_presets_uploads` → `0003_activity` → `0004_habits` → `0005_habit_monthly` → `0006_weight_and_user_prefs` → `0007_weight_target` → `0008_activity_exercise_type` → `0009_weight_targets` → `0010_food` → `0011_water_entry_name` → `0012_activity_entry_name` → `0013_user_management` (drops `invites`, adds `users.must_change_password`). Migrations run on container start before uvicorn boots.

Extension path: `exercise_sessions`, `quests`, `quest_progress`. Most cross-cutting tables already accept arbitrary metric keys.

## Events & webhooks

Services call `events.emit(user_id, event_name, payload)`. The webhook dispatcher is subscribed; it enumerates active `webhook_subscriptions` and inserts `webhook_deliveries` rows. A background loop drains the queue with exponential backoff (up to 5 attempts), all visible in the `webhook_deliveries` table.

Events emitted today: `water.goal_met`, `activity.goal_met`, `food.target_exceeded`. Habits don't emit yet.

## Logging / audit / errors

- One funnel for audit (`telemetry.recorder.audit`) and one for errors (`telemetry.recorder.capture_error`).
- Every request gets an `x-request-id`; unhandled exceptions return `{detail, error_id, request_id}` and write an `error_log` row.
- The frontend can POST `/api/v1/telemetry/events` with batched client-side errors; they land in `error_log` with `source='frontend'`.

## Deployment shape

Production target is a **single container** on Unraid pulling from GHCR. The `docker-compose.yml` in the repo runs a multi-service dev stack (Postgres + frontend + backend with hot reload) for local development; it's not the production deployment path. See [`unraid.md`](unraid.md).
