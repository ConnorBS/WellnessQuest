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
3. User-data tables (`water_logs`, `food_logs`, etc.) have rows but `users` is empty — orphaned data; need a recovery flow that re-creates an admin without nuking the existing rows.

Filling in the setup form in scenario 2 or 3 leads to a new admin with a new
`user_id` whose dashboard appears empty — even though the data is still in the
DB linked to the old user.

The diagnostic queries and one-liner fixes for each scenario live in
[`docs/unraid.md` → Diagnostics & recovery](docs/unraid.md#diagnostics--recovery).
Point the operator there rather than re-deriving the commands.

## Auth flow recap

- Tokens live in `localStorage` (remember-me on, default) or `sessionStorage` (off). See `frontend/src/lib/auth.ts`.
- Access token TTL: 15 min default (`ACCESS_TOKEN_TTL_SECONDS`). Refresh token TTL: 30 days default (`REFRESH_TOKEN_TTL_SECONDS`). Both are env-overridable.
- The protected layout (`frontend/src/app/(app)/layout.tsx`) gates rendering on a synchronous auth check so the app shell doesn't flash before redirecting unauthenticated users to `/login`.

## Where things live

- Backend FastAPI app: `backend/app/`
  - Auth & setup endpoints: `backend/app/api/v1/auth.py`, `backend/app/api/v1/setup.py`
  - Models: `backend/app/models/`
  - Per-user defaults seeded on user creation: `backend/app/services/user_bootstrap.py`
- Frontend Next.js (App Router) PWA: `frontend/src/app/`
- Unraid template: `unraid/wellnessquest.xml`
- Operator docs: `docs/unraid.md`, `docs/runbook.md`
