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

## Branches and image tags

- **`main`** is the production branch and the GitHub default. Pushes publish an immutable `:sha-<7>`.
- **`:edge`** is an **integration build**, not a per-branch alias: `.github/workflows/build-edge.yml` checks out `main`, merges every open `claude/*` branch on top, and publishes the result as `ghcr.io/connorbs/wellnessquest:edge`. It rebuilds on push to `main`, push to any `claude/*` branch, and on deletion of any `claude/*` branch — so pushing a feature branch adds it to `:edge` and deleting the branch removes it, no `main` revert needed. If two open `claude/*` branches conflict, the build fails and `:edge` stays pointed at the previous successful integration; close or rebase one of the branches to recover. The Unraid template ships pointing at `:edge`, so the operator's container auto-updates whenever the integration rebuilds.
- **`claude/**`** branches are feature branches. They publish `:preview` (rolling, shared across every feature branch — overwritten on each push) and `:sha-<7>` (immutable), and also trigger an `:edge` rebuild as above. Do **not** suggest `:preview` to the operator for prod — it regresses any time another feature branch is pushed.
- **Tagged releases** (`vX.Y.Z`) publish `:stable` / `:latest` plus `:vX.Y.Z` and `:X.Y` / `:X` aliases. None of these exist yet; cut a tag when you want a frozen channel for self-hosters.
- The repo had `claude/health-tracking-app-27gJW` as its default branch through May 2026 (an artifact of how the project bootstrapped via Claude Code on the web). It's gone now — references in older docs / commit messages are historical.

## Working on a new feature branch

Hard rules earned by an actual cleanup of 16 accumulated `claude/*` branches.
Follow them at branch-creation time, not after the fact — retrofitting any of
these into an open PR is painful and tends to lose work.

### 1. Match the Alembic `down_revision` to current main

Before writing any migration: `git fetch origin main && ls backend/alembic/versions/ | sort | tail -1`. Use that filename's revision id as your new migration's `down_revision`, and pick the next sequential number for your own. Migration numbering is sequential (`0001` → `0019` and counting), so two branches that both fork from an older head will silently both claim the next number and one will have to be renumbered at merge time. If multiple agents are working in parallel, the LAST branch to merge usually pays this cost — but you can avoid the collision entirely by rebasing onto main before opening the PR.

### 2. Don't bundle CI/infra fixes with feature work

If your branch's CI is failing for reasons unrelated to your feature (mypy strict-mode regression, postgres-race in e2e, ruff churn), open a SEPARATE PR for the CI fix and rebase your feature branch on top once it lands. Bundling them produces 11-commit branches where 10 commits are noise that someone has to triage out at merge time. CI fixes are reviewable as their own PRs; features are reviewable as their own PRs. Keep them separate.

### 3. Single-purpose, small PRs

A PR should do one logical thing. The previous HA branch bundled "Fernet encryption + steps table + sleep table + pull worker + dashboard cards + settings UI rewrite + scope expansion" into one commit and had to be split into two PRs at merge time. Before you start coding, ask yourself: can this land as 200–500 lines? If not, find the natural seam and split it before you write line one.

Two healthy splits to keep in mind:

- **Foundation vs. feature**: if you're adding a new metric, the encryption helper / model / migration is one PR; the dashboard card + UI is the next. Each is independently mergeable.
- **Schema vs. behavior**: a new column + backfill is one PR; the code that reads from it is the next. Reduces rollback surface if the behavior is wrong.

### 4. Land within ~24 hours of opening

If a PR sits open for days, main moves forward and the merge surface grows. The cleanup found branches that were 25–52 commits behind main and required real rebase work to land. Aim to open a PR, address feedback, and merge same-day. If you can't, the scope was too big — see rule 3.

### 5. Branches auto-delete on merge

The repo has "Automatically delete head branches" enabled. Don't manually delete during the PR cycle — just let the merge do it. Don't push to a branch after its PR is merged; open a new branch for follow-ups.

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

`water_entries.source`, `food_entries.source`, `activity_entries.source`,
`steps_entries.source` and `sleep_entries.source` all carry the same enum
(column comment lives in the models). Values:

- `'pwa'` — written by the web app (`POST /api/v1/water|food|activity|steps|sleep`). UI shows this label next to each entry in the day list (e.g. `12:00 · pwa`).
- `'ha'` — written by Home Assistant via `POST /api/v1/ha/water/add`, `/ha/steps/add`, `/ha/sleep/add`. **Water, steps and sleep have HA write endpoints; activity and food do not** — they cannot have `source='ha'` today.
- `'ha_pull'` — written by the HA pull worker, which polls entity states rather than being pushed to (steps and sleep only).
- `'manual'` — reserved for direct DB inserts / future admin tooling. No code path currently writes it; treat it as "this row predates the source field" if you ever see it in the wild.

There's no UI to filter or relabel by source; the frontend just renders the raw string.

### XP & leveling (`backend/app/services/xp_service.py`)

Per-entry XP with per-metric daily caps in the user's local day:

| Trigger | Amount | Daily cap |
|---|---|---|
| `water_entry` | `floor(ml / 100)` | 20 |
| `activity_entry` | `minutes` (1:1) | 30 |
| `food_entry` | 1 per log (not kcal-weighted, on purpose — would reward over-eating) | 5 |
| `steps_entry` | `floor(count / 500)` | 20 |
| `sleep_entry` | 10 flat per session (not duration-weighted) | n/a |
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

The events that exist are:

- `water.goal_met` — payload `{ goal_ml, total_ml, date }`
- `activity.goal_met` — payload `{ goal_minutes, total_minutes, date }`
- `food.target_exceeded` — payload `{ target_kcal, total_kcal, date }`
- `steps.daily_goal_met` — payload `{ count, goal, date }`
- `sleep.session_logged` — payload `{ duration_minutes, quality_score, goal_met, goal_minutes, ended_at }`; unlike the others this fires on **every** session, not just on a crossing

These are the **only** events the webhook dispatcher sees. Habits, weight, BP
emit nothing. If a feature request needs a habit/weight/BP webhook, the event
needs to be added in the service layer first.

### Streaks (`backend/app/services/streak_service.py`)

`water_ml`, `active_minutes`, `steps` and `sleep_minutes` have streaks. The
function is idempotent within a day; extends by 1 if `last_hit_date == today -
1`, resets to 1 on any gap, no-op if already counted today. Doesn't decrement
on entry delete.

Back-dated entries never touch streaks: `steps_service.add` and
`sleep_service.add` only call `extend_if_goal_met` when the entry's own day
(steps: `occurred_at`; sleep: `ended_at`) is today. Goal/XP math still follows
the entry's day, so logging steps for last Tuesday reports Tuesday's total —
not today's.

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

### Medications

Two tables: `medications` (identity — name, form, reason, prescriber, notes,
`started_on`, `ended_on`) and `medication_changes` (the append-only timeline).

**The current dose is never stored.** `medication_service.fold_current` replays
a medication's change rows oldest → newest and carries the last non-null value
of each field forward, so each row only records what actually changed and a
backdated row can't clobber a newer one. Don't add cached `current_dose_*`
columns — that's the two-sources-of-truth footgun this design avoids.

`active` is exactly `ended_on IS NULL`; "past medications" is the same table
filtered the other way. `POST /medications/{id}/stop` sets `ended_on` **and**
appends a `stopped` row; `/resume` clears it and appends `resumed`, leaving the
`stopped` row in place — the gap is the history the user came for.

`started` rows are written on create and can't be deleted (`400
cannot_delete_started`); `stopped` / `resumed` are written only by their
endpoints, so `POST /changes` accepts just `dose_change`, `schedule_change`,
`paused`, `note`. All dates are the user's local calendar dates and reject the
future.

`DELETE /medications/{id}` is a **hard** delete (cascades the timeline) — it's
the typo escape hatch, not the way to retire a medication. Medications grant no
XP, emit no events, have no streaks, and nothing is seeded on user creation.

There's no per-dose "did I take it today" logging yet — this module is the
register and its history, not adherence tracking.

The detail view is `/medications/detail?id=N`, **not** `/medications/[id]`:
the Dockerfile builds the frontend with `NEXT_OUTPUT_MODE=export`, and a
dynamic route segment under `output: "export"` fails the build with "missing
generateStaticParams()". A plain `next build` (standalone mode) doesn't catch
it — reproduce CI with `NEXT_OUTPUT_MODE=export pnpm build` before pushing any
new route.

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

**Activity routes are dual-mounted under `/activity` and `/move`** (see
`api/v1/__init__.py`). They're the same handlers; the PWA calls `/move/*`
because ad/privacy blockers match the word "activity" in a URL and kill
`POST /api/v1/activity` with `ERR_BLOCKED_BY_CLIENT`. `/activity/*` stays for
API-token / external consumers. If you add a new activity endpoint, add the
route once (the dual prefix is applied at include time) and it's reachable
under both.

The service worker generates a `client_id = crypto.randomUUID()` before
queueing offline POSTs so retries dedupe.

### Service worker (`frontend/public/sw.js`)

- Caches: `wq-shell-v2` (app shell precache for `/`, `/dashboard`, `/water`, `/login`, manifest), `wq-api-v1` (network-first for `/api/v1/**` GETs with stale fallback). Bump the shell cache name whenever the precache list changes.
- **Only `POST /api/v1/water` is offline-queueable.** Activity, food, habits, weight, BP are not. If an offline-logging feature request comes in for one of those, the SW needs new branches in `fetch` and `drainQueue`.
- Offline POST returns synthetic `202 Accepted` with header `x-wq-queued: 1` and a body containing `entry: { id: -1, source: 'pwa', ... }`. **UI code must tolerate `id === -1`** (it's used in `useAddWater` to swap in the real entry once sync completes).
- Drained on Background Sync (`tag = "wq-water-sync"`) or explicit `navigator.serviceWorker.controller.postMessage("wq-drain")`. Background Sync isn't supported in all browsers; the postMessage fallback is what most platforms actually hit.
- Only registers in secure contexts (HTTPS or `localhost`).

### The "raw JavaScript gibberish instead of a page" report

If the operator says a link — typically a card's "See all" — dumped a wall of
`1:"$Sreact.fragment"` / `static/chunks/...` text into the browser, that's the
static export's RSC payload being rendered as a document. It is **not** a 404,
even though the payload text contains `404: This page could not be found`
(every Next payload embeds the not-found boilerplate).

What happens: the frontend is built with `output: "export"`, so each page has a
sibling `.txt` RSC payload (`/period/index.txt`). `:edge` republishes on every
push to any `claude/*` branch, so the operator's container updates underneath
tabs that are still open. On the next client-side navigation the App Router
fetches the payload, sees a build id that doesn't match the one the tab booted
with, and bails out to a **full browser navigation to the `.txt` URL** — the
user lands on the payload itself.

Two guards now catch it, and both must stay:

- `static_shell_middleware` in `backend/app/main.py` — redirects a `.txt`
  request whose `Sec-Fetch-Dest` is `document` back to the HTML page, and marks
  HTML/RSC responses `no-cache` (hashed `_next/static/*` stays `immutable`).
  Gate on the document check: the router's own payload fetches must still get
  the file, and they're identified by `Sec-Fetch-Dest: empty` / the `RSC`
  header.
- The matching `.txt` branch in `sw.js`'s navigate handler, for when the SW is
  the one answering.

Reproduce with `curl -H 'Sec-Fetch-Dest: document' .../period/index.txt` —
expect a 307, not a payload.

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
