# Architecture

WellnessQuest is a monorepo with three runtime services plus a reverse proxy and a backup sidecar, all orchestrated by docker-compose.

```
phones / browsers ──┐
                    │      ┌─────────────────────────────┐
Home Assistant ─────┼────► │  Caddy (LAN HTTPS, internal CA)
                    │      └─────────────┬───────────────┘
                    │                    │
                    │            ┌───────┴────────┐
                    │            │                │
                    │       frontend           backend (FastAPI)
                    │       (Next.js)               │
                    │            │                  │
                    │            └─── /api/v1/* ────┘
                    │                                  │
                    │                              Postgres 16
                    │                                  │
                    └── outbound webhooks ◄────────────┘  (webhook_dispatcher
                                                             background task)
```

## Backend (FastAPI)

Module layout under `backend/app/`:

- `main.py` — app factory, middleware (CORS, RequestContext), lifespan that starts the webhook dispatcher.
- `api/v1/` — routers. Routers are thin: validate input, call a service, return a schema.
- `services/` — own transactions and emit XP / telemetry / webhook events through `services.events.emit`.
- `providers/` — read-side abstractions (food data; future weight scales). Decorator-populated registries.
- `integrations/` — write/notify-side abstractions (Home Assistant; future ntfy, Discord). Same registry shape.
- `auth/` — split between user session JWT (`jwt.py`) and long-lived HA API tokens (`api_tokens.py`).
- `telemetry/` — request middleware, structured logger, and recorder helpers (`audit`, `capture_error`).
- `db/` — declarative base with deterministic naming convention; async session factory.
- `models/` — one module per table.

### Invariants (enforced by review / soon by the reviewer agent)

- Routers do not contain raw SQL; everything goes through services or model `select(...)` statements.
- Every router uses `Depends(current_user)` or `Depends(current_ha_token(scope))`.
- HA endpoints are scope-gated and live under `/api/v1/ha/...`.
- User and HA auth use **different** headers (`Authorization` vs `X-WQ-Token`) so a leaked HA token cannot be replayed against user endpoints.
- All "today" math uses `services.time_utils.day_for_user(user, instant)`. Never `datetime.now()` of server local time inside services.

## Frontend (Next.js 15 App Router, PWA)

- App Router under `src/app/`. `(app)` group is auth-guarded.
- TanStack Query for data; `lib/api.ts` wraps fetch with JWT and refresh-on-401.
- `public/sw.js` is a hand-rolled service worker: app-shell precache, network-first for `/api/v1/**` GETs, and an IndexedDB-backed Background Sync queue for `POST /api/v1/water`. The server enforces idempotency via the `(user_id, client_id)` unique constraint.

## Database

Postgres 16. Single database, single role. Multi-tenant via `user_id` FK on every row. Naming convention is locked in `app/db/base.py` so Alembic autogenerate produces deterministic index/FK names — important for agent-authored migrations.

Tables of consequence (slice 1):

- `users`, `sessions`, `api_tokens`, `invites`
- `water_entries`, `goals`, `streaks`, `xp_events`
- `audit_log`, `error_log`
- `integrations`, `webhook_subscriptions`, `webhook_deliveries`

Extension path: `weight_entries`, `habit_completions`, `food_entries`, `exercise_sessions`, `quests`, `quest_progress`. `xp_events`, `goals`, `streaks`, `audit_log`, `error_log`, `integrations`, `webhook_subscriptions` are already metric-agnostic.

## Events & webhooks

Services call `events.emit(user_id, event_name, payload)`. The webhook dispatcher is subscribed; it enumerates active `webhook_subscriptions` and inserts `webhook_deliveries` rows. A background loop drains the queue with exponential backoff (up to 5 attempts), all visible in the `webhook_deliveries` table.

## Pluggable provider / integration pattern

`providers.base.Registry` is a thin decorator-populated map of `kind -> class`. Both `providers.food.base.food_providers` and `integrations.base.channels` use it.

Add a new integration:

1. Create `app/integrations/<kind>/{__init__.py, schemas.py, outbound.py}`.
2. Implement `IntegrationChannel` with a `kind`, `label`, `config_schema`, and async `emit(event, payload)`.
3. Import the package from `app/integrations/__init__.py`.
4. Done — `/api/v1/integrations/kinds` now lists it and the config form drives off `config_schema`.

Add a new food provider: same pattern under `app/providers/food/<kind>.py`.

## Logging / audit / errors

- One funnel for audit (`telemetry.recorder.audit`) and one for errors (`telemetry.recorder.capture_error`). Future Sentry/Loki shipping is a single-file change.
- Every request gets an `x-request-id`; unhandled exceptions return `{detail, error_id, request_id}` and write an `error_log` row.
- The frontend can POST `/api/v1/telemetry/events` with batched client-side errors; they land in `error_log` with `source='frontend'`.
