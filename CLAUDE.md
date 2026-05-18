# Notes for AI agents

Quick orientation for Claude / agent sessions so we don't re-derive deployment
context every time.

## Where this actually runs

Production is **Unraid**, not `docker compose`. The compose stack in this repo
(`docker-compose.yml`) is for local laptop dev only — it bundles its own
Postgres with `wq:wq@postgres:5432/wellnessquest` defaults. None of those
values exist on the operator's Unraid box.

On Unraid:

- WellnessQuest runs as a **single container** from `ghcr.io/connorbs/wellnessquest:<tag>` (template at `unraid/wellnessquest.xml`).
- Postgres is a **separate, operator-owned container** (Community Apps `postgres:16`, name varies — `postgresql16` is typical). The operator picks `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` themselves.
- WellnessQuest's `DATABASE_URL` env var points at that postgres. The user/db/host are whatever the operator chose, **not** the `wq` / `wellnessquest` shown in the compose file or runbook examples.

When suggesting diagnostics or recovery commands, treat `POSTGRES_USER` and
`POSTGRES_DB` as unknowns to be looked up from the operator's postgres container
(Unraid UI → click container → Edit → POSTGRES_USER / POSTGRES_DB fields).
Don't assume `wq` / `wellnessquest`.

## The operator's primary interface is mobile

Long shell pipelines, multi-step `find | xargs` chains, and "open three
terminals" workflows are awkward. Prefer:

1. **Unraid container console** (tap container icon → `>_`) for psql work — it
   drops you straight into a shell inside that container. No `docker exec`
   needed, no `docker compose` needed.
2. **Single-line `psql -c "..."`** invocations the operator can paste once,
   over multi-statement heredocs.
3. **Unraid web terminal** (top-right `>_` in the WebUI) for `docker exec`
   one-liners against named containers when you do need host-level access.

`docker compose ...` commands do not work on the Unraid host — there's no
`docker-compose.yml` in their cwd. Don't suggest them.

## When the setup page appears unexpectedly

If the operator reports "I'm being shown the welcome / create-admin page", do
**not** instruct them to fill it in until you've confirmed which of these is
true:

1. The DB is genuinely fresh (rows = 0 everywhere) — setup form is correct.
2. Users exist but the admin row has `disabled_at` set — reactivate, no setup needed.
3. User-data tables (`water_entries`, `food_entries`, etc.) have rows but `users` is empty — orphaned data; need a recovery flow that re-creates an admin without nuking the existing rows.

Filling in the setup form in scenario 2 or 3 leads to a new admin with a new
`user_id` whose dashboard appears empty — even though the data is still in the
DB linked to the old user.

The diagnostic queries and one-liner fixes for each scenario live in
[`docs/unraid.md` → Diagnostics & recovery](docs/unraid.md#diagnostics--recovery).
Point the operator there rather than re-deriving the commands.

## Postgres storage-path footgun on Unraid

If scenario 1 (genuinely empty DB) shows up after a reboot or template edit,
the cause is almost always the postgres container being pointed at a
**phantom path under `/mnt/<pool>/...`** that doesn't resolve to a real pool
(pool was renamed, template copied from an older Unraid version, or pool
failed to mount on boot). Docker silently creates the directory empty,
postgres runs its first-boot init, you get an empty DB with the configured
user/db but zero rows.

Suggest `/mnt/user/appdata/...` over `/mnt/<pool>/appdata/...` for postgres
storage paths — the user share survives pool renames. Full write-up + a User
Scripts backup recipe lives in
[`docs/unraid.md` → Diagnostics & recovery](docs/unraid.md#why-this-happens-and-how-to-prevent-it).

## Auth flow recap

- Tokens live in `localStorage` (remember-me on, default) or `sessionStorage` (off). See `frontend/src/lib/auth.ts`. `setTokens(tokens, persistent)` writes to one and clears the other so the choice is reflected on disk; `getAccessToken` / `getRefreshToken` read from either.
- Access token TTL: 15 min default (`ACCESS_TOKEN_TTL_SECONDS`). Refresh token TTL: 30 days default (`REFRESH_TOKEN_TTL_SECONDS`). Both are env-overridable.
- **Refresh is rotation-based and deduplicated.** Backend revokes the old refresh row on every successful `/auth/refresh`, so concurrent callers must not each fire their own refresh — the runner-up would be left holding a revoked token and clear the freshly-issued ones. `frontend/src/lib/api.ts` serializes through a single in-flight promise (`inflightRefresh`); don't bypass it.
- **The protected layout (`frontend/src/app/(app)/layout.tsx`) gates rendering on `useMe()` succeeding**, not on `isLoggedIn()` alone. An expired-but-still-stored access token passes `isLoggedIn()`, so a presence-only gate would render the empty shell and then leave the user staring at it if refresh failed. The layout returns `null` until `/me` returns and redirects to `/login` on any `/me` error.
- React Query is configured (`frontend/src/lib/queryClient.ts`) to **not retry 4xx responses**. Retrying a 401 just delays the redirect by an extra failed refresh.
- The setup page (`frontend/src/app/setup/page.tsx`) hits `/setup/status` first and only renders the form if `setup_required` is true; if a recovered user lands there with `setup_required=false`, it redirects them to `/login` so they can sign in normally.

## Where things live

- Backend FastAPI app: `backend/app/`
  - Auth & setup endpoints: `backend/app/api/v1/auth.py`, `backend/app/api/v1/setup.py`
  - Models: `backend/app/models/`
  - Per-user defaults seeded on user creation: `backend/app/services/user_bootstrap.py`
- Frontend Next.js (App Router) PWA: `frontend/src/app/`
- Unraid template: `unraid/wellnessquest.xml`
- Operator docs: `docs/unraid.md`, `docs/runbook.md`

## Feature semantics that bite

Rules and quirks that aren't in `docs/api.md` and that agents otherwise have to
re-derive by reading the services. If you're touching one of these areas, this
is the canonical "easy to get wrong" reference.

### `source` field on entries

`water_entries.source`, `food_entries.source`, and `activity_entries.source` all
carry the same enum (column comment lives in the models). Values:

- `'pwa'` — written by the web app (`POST /api/v1/water|food|activity`). UI shows this label next to each entry in the day list (e.g. `12:00 · pwa`).
- `'ha'` — written by Home Assistant via `POST /api/v1/ha/water/add`. **Only water has an HA write endpoint** — activity and food entries cannot have `source='ha'` today.
- `'manual'` — reserved for direct DB inserts / future admin tooling. No code path currently writes it; treat it as "this row predates the source field" if you ever see it in the wild.

There's no UI to filter or relabel by source; the frontend just renders the raw string.

### XP & leveling (`backend/app/services/xp_service.py`)

Per-entry XP with per-metric daily caps in the user's local day:

| Trigger | Amount | Daily cap |
|---|---|---|
| `water_entry` | `floor(ml / 100)` | 20 |
| `activity_entry` | `minutes` (1:1) | 30 |
| `food_entry` | 1 per log (not kcal-weighted, on purpose — would reward over-eating) | 5 |
| `goal_met:<metric>` | +50, one-shot on the crossing entry | n/a |

Level curve: `100 * level * (level + 1) / 2` cumulative to enter the next
level. L1=0, L2=100, L3=300, L4=600, L5=1000.

**Weight, BP, and habits do not grant XP**. If a user reports "I logged my
weight and got nothing", that's expected, not a bug.

### Goal-met events fire exactly once per crossing

In `water_service.add` / `activity_service.add` / `food_service.add`, the event
fires only when `was_met=false AND now_met=true` (or `was_exceeded=false AND
now_exceeded=true` for food). Subsequent entries the same day don't refire.
Deleting an entry that pulls the total back below the goal does NOT "uncross"
— there's no `goal_unmet` event.

The three events that exist are:

- `water.goal_met` — payload `{ goal_ml, total_ml, date }`
- `activity.goal_met` — payload `{ goal_minutes, total_minutes, date }`
- `food.target_exceeded` — payload `{ target_kcal, total_kcal, date }`

These are the **only** events the webhook dispatcher sees. Habits, weight, BP
emit nothing. If a feature request needs a habit/weight/BP webhook, the event
needs to be added in the service layer first.

### Streaks (`backend/app/services/streak_service.py`)

Only `water_ml` and `active_minutes` have streaks. The function is
idempotent within a day; extends by 1 if `last_hit_date == today - 1`, resets
to 1 on any gap, no-op if already counted today. Doesn't decrement on entry
delete.

### Habits

Four cadence kinds, enforced by DB CHECK constraints:

- `daily`
- `weekly` (`weekly_target` 1..7)
- `monthly` (`monthly_target` 1..31)
- `interval` (`interval_days` 2..365)

Status is computed at request time (not stored): `done | ok | due_today | overdue`.

**Interval anchor gotcha**: a brand-new interval habit with no checkins anchors
its "due" math to `habit.created_at`, not to "yesterday" — so a fresh "every
30 days" habit isn't marked due-today on day 0. See
`_status_for` in `habit_service.py` for the rest of the state machine
(weekly/monthly status flips to `due_today` only when the deficit can't be
made up in the remaining days).

Delete is **soft via `archived_at`**; the list endpoint filters archived rows
by default. There's no current API to unarchive — would need a new endpoint.

Reorder is not in-place: `POST /habits/reorder` overwrites `sort_order` with
the index in the array; unknown IDs are silently ignored.

Toggle accepts past `date=` query params; future dates return `400 future_date`.

### Weight & blood pressure targets are append-only history

Both `weight_targets` and `blood_pressure_targets` are versioned audit trails,
not single rows. "Current target" = row with the latest `effective_at`. NULL
`target_kg` (weight) or both targets NULL (BP) means "explicit no-target as
of effective_at" — distinct from "no row at all" (never set).

The BP target CHECK requires `target_systolic > target_diastolic` and
both-null-or-both-set. Editing target history in-place would defeat the
audit-trail design — new edits should always insert a new row.

Weight is stored canonical kg (`Numeric(6,2)`); `user.weight_unit` (`'kg'` or
`'lb'`) is display-only and converted in the frontend.

BP categorization (`normal | elevated | stage_1 | stage_2 | crisis`, AHA 2017)
is **frontend-computed** at render time in `frontend/src/lib/bp.ts`. The
backend keeps `services/blood_pressure_categories.py` only as a parity test
fixture; the API never returns category.

### Idempotency contract

Water (`UniqueConstraint("user_id", "client_id", name="user_client")`) and food
(`name="food_user_client"`) both enforce idempotency. Re-POSTing the same
`client_id` returns the existing row with `xp_delta: 0` — the service uses a
SAVEPOINT (`db.begin_nested`) to catch the `IntegrityError` without rolling
back the outer transaction.

**Activity has no such constraint** — duplicate `client_id` POSTs to
`/activity` create duplicate rows today.

The service worker generates a `client_id = crypto.randomUUID()` before
queueing offline POSTs so retries dedupe.

### Service worker (`frontend/public/sw.js`)

- Caches: `wq-shell-v1` (app shell precache for `/`, `/dashboard`, `/water`, `/login`, manifest), `wq-api-v1` (network-first for `/api/v1/**` GETs with stale fallback).
- **Only `POST /api/v1/water` is offline-queueable.** Activity, food, habits, weight, BP are not. If an offline-logging feature request comes in for one of those, the SW needs new branches in `fetch` and `drainQueue`.
- Offline POST returns synthetic `202 Accepted` with header `x-wq-queued: 1` and a body containing `entry: { id: -1, source: 'pwa', ... }`. **UI code must tolerate `id === -1`** (it's used in `useAddWater` to swap in the real entry once sync completes).
- Drained on Background Sync (`tag = "wq-water-sync"`) or explicit `navigator.serviceWorker.controller.postMessage("wq-drain")`. Background Sync isn't supported in all browsers; the postMessage fallback is what most platforms actually hit.
- Only registers in secure contexts (HTTPS or `localhost`).

### Default user bootstrap (`backend/app/services/user_bootstrap.py`)

`bootstrap_user_assets` runs on `POST /setup/admin` (first admin) and `POST
/admin/users` (every subsequent user). It seeds:

- Water goal: `DEFAULT_WATER_ML_PER_DAY` (in `goal_service`)
- Activity goal: `DEFAULT_ACTIVE_MINUTES_PER_DAY`
- 3 water presets: Small cup 125ml, Tall cup 250ml, Bottle 500ml
- 3 activity presets: Stretch 5min, Walk 15min, Cardio 30min
- 3 example habits: "Read 10 minutes" (daily), "Workout" (weekly, target 3), "Take vitamins" (interval, every 2 days)

**Does NOT seed**: food goal (auto-created on first `/food` access via
`goal_service.get_or_create_default_food`), food presets, weight target, BP
target. A user who never visits Food/Weight/BP will never have those defaults
materialised.

### Admin guardrails

`backend/app/api/v1/admin.py` enforces last-admin protection on **role
change, disable, and delete** — any op that would leave zero
`role='admin' AND disabled_at IS NULL` users returns `400 last_admin`.

Refresh sessions are mass-revoked on:
- `DELETE /admin/users/{id}` (soft-disable)
- `PATCH /admin/users/{id}` with `disabled=true`
- `POST /admin/users/{id}/reset-password`
- `POST /auth/change-password`

`POST /auth/logout` only revokes the supplied refresh session, not all of them.

`POST /admin/users` and `POST /admin/users/{id}/reset-password` both set
`must_change_password=true`; cleared on `/auth/change-password`. The frontend
forces the change-password flow when `MeOut.must_change_password` is true.

### Webhook delivery (`backend/app/services/webhook_dispatcher.py`)

- `MAX_ATTEMPTS = 5`, `BASE_BACKOFF_SECONDS = 30`, exponential `30 * 2^(attempt-1)`: 30s, 60s, 120s, 240s, 480s.
- Dispatcher drains up to 25 due deliveries every 5s.
- Dead-letter row: `next_retry_at IS NULL AND delivered_at IS NULL`. Nothing automatically retries dead letters; needs a manual nudge.
- Non-2xx responses count as failures (retried); transport errors also retry. Unknown channel `kind` dead-letters immediately without retry.
