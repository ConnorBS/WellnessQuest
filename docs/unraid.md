# Unraid first-run guide

WellnessQuest ships as a **single Docker image** that serves the PWA and the API on one port. You bring your own Postgres 16 (any reachable instance — a separate Unraid container, a VM, or a managed DB), and the template wires the rest.

## Prerequisites

### 1. Postgres 16 reachable from Unraid

The container needs a Postgres 16 server it can reach over the network. Anything works:

- A separate Unraid Postgres container (Community Apps → install any `postgres:16` template, set POSTGRES_USER/PASSWORD/DB).
- A VM, a Synology, an existing home server.
- A managed cloud database.

What you need on hand before installing the template:

- `HOST` — IP or hostname reachable from the WellnessQuest container.
- `PORT` — usually `5432`.
- `USER` — Postgres role with **CREATE** privileges on the target database (Alembic will create the schema on first boot).
- `PASSWORD` — for that role.
- `DBNAME` — empty database to be migrated into (e.g. `wellnessquest`).

If you want the two containers on a shared internal docker network so you can address Postgres by container name (instead of an IP that might shift), `docker network create wellnessquest` and attach both containers to it. Otherwise host IP + port works fine.

### 2. Publish the image to GHCR (one-time)

The `.github/workflows/deploy.yml` workflow builds and pushes `ghcr.io/connorbs/wellnessquest` on every push:

| Source | Tags published | Who pins this |
|---|---|---|
| Git tag `vX.Y.Z` | `:vX.Y.Z`, `:X.Y.Z`, `:X.Y`, `:X`, `:stable`, `:latest`, `:sha-<7>` | Self-hosters (recommended) |
| Git tag `vX.Y.Z-pre.N` | `:vX.Y.Z-pre.N`, `:X.Y.Z-pre.N`, `:sha-<7>` | RC / beta testers |
| Branch `main` | `:edge`, `:sha-<7>` | Bleeding-edge testers |
| Branch `claude/**` | `:preview`, `:sha-<7>` | Development only |

**Recommended pin for self-hosters:** `:stable` (auto-updates to the latest tagged release) or an exact `:vX.Y.Z` (never moves). `:edge` and `:preview` can include unreleased / unstable work.

Push the working branch, watch the **deploy** workflow under Actions until green (~3-5 min first time), then confirm the package exists at <https://github.com/ConnorBS?tab=packages> as `ghcr.io/connorbs/wellnessquest`. See [`releasing.md`](releasing.md) for how to cut a versioned release.

### 3. Authenticate Unraid to GHCR

The package is private; the docker daemon needs to log in once:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u ConnorBS --password-stdin
```

Credentials persist in `/root/.docker/config.json` across reboots.

### 4. Add `wellnessquest.lan` to local DNS (optional but nice)

Map `wellnessquest.lan` to your Unraid IP via your router, Pi-hole, AdGuard, or `/etc/hosts`. Verify with `ping wellnessquest.lan`. Skip this if you're happy hitting the Unraid IP directly.

### 5. Generate secrets

From any machine with Python:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"                                     # JWT_SECRET
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"        # FERNET_KEY
```

No passwords need to be pre-set — the very first time you open the WebUI you'll
see a "Welcome — create your admin account" page (Nginx Proxy Manager style),
and any additional household users are added from inside the app afterwards.

## Install the template

1. From any machine with SMB access to Unraid, copy `unraid/wellnessquest.xml` to `\\TOWER\flash\config\plugins\dockerMan\templates-user\` (i.e. `/boot/config/plugins/dockerMan/templates-user/`). Filename can be anything ending in `.xml`.
2. In the Unraid WebUI: **Docker → Add Container → Template** dropdown → **wellnessquest**.
3. Fill in the fields:
   - **DATABASE_URL** — `postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME` with your Postgres values from prereq 1.
   - **JWT_SECRET** — paste the generated value.
   - **FERNET_KEY** — paste the generated value.
   - **App data** — host path for persistent data (uploaded preset icons today). Default `/mnt/user/appdata/wellnessquest/data` is usually right.
   - **CORS_ORIGINS**, **TZ** — defaults are fine if your LAN matches the defaults.
   - **App port** (bridge networking) — host port unraid exposes; defaults to 8000. Only matters if the container is on a bridge network (then it maps `host:APP_PORT → container:8000`). Change if it conflicts with another service.
   - **APP_PORT** env var (any networking, but especially macvlan / ipvlan) — sets the **internal** port uvicorn binds to inside the container. Defaults to 8000. If your container has its own LAN IP (macvlan), set this to **80** so the app is reachable at `http://<container-ip>/` with no port suffix, or **443** if you're terminating TLS inside the container (uncommon). Bridge users can usually leave it at 8000 and tune the host-side **App port** field instead.
4. **Apply**. The image pulls from GHCR (~30 s), then the container runs `alembic upgrade head` and starts uvicorn. Watch the log until you see `Uvicorn running on 0.0.0.0:<APP_PORT>`. The healthcheck flips the badge to `healthy` after ~30 s.

## First users

Open `http://wellnessquest.lan:8000/` (or `http://<unraid-ip>:8000/`). With no
users yet the app redirects you to `/setup` and presents a welcome screen:
enter a full name, email, and password, and click **Save**. That creates the
first admin and logs you straight into the dashboard.

After that, add more household users from **Settings → Users → Add user**. You
type their email and a temporary password; they're forced to change it on
first login. Credentials never live in environment variables — if you ever
need to reset someone, use the admin UI's **Reset password** button.

If you ever need to start over completely, delete the user rows in Postgres and
the next request will redirect you back to `/setup`:

```bash
docker exec wellnessquest python -c "
import asyncio
from sqlalchemy import delete
from app.db.session import async_session
from app.models.user import User
async def main():
    async with async_session() as db:
        await db.execute(delete(User))
        await db.commit()
asyncio.run(main())
"
```

## First login

Sign in with the admin account you created at `/setup`.

Install the PWA on your phone: Safari/Chrome → "Add to Home Screen".

## Wire up Home Assistant

1. **Settings → Tokens → New** in WellnessQuest. Label `HA living room`, scopes `water:read` + `water:write`. Copy the `wq_ha_...` value (shown once).
2. Add it to HA `secrets.yaml`:
   ```yaml
   wq_ha_token: "wq_ha_REPLACE_ME"
   ```
3. Paste the snippets from `infra/home-assistant/` into HA configuration — they target `http://wellnessquest.lan:8000`. Adjust the host if your port differs. Restart HA.
4. In WellnessQuest: **Settings → Integrations → Add Home Assistant**. Set `base_url=http://homeassistant.local:8123`, pick a `webhook_id`, subscribe `water.goal_met`.
5. Paste the same `webhook_id` into the HA automation snippet and reload automations.

## Walk the 16-step verification checklist

From the bottom of the implementation plan. Adds water from PWA, sees it in HA, fires from HA, observes XP + level change, partner isolation, error capture, etc.

## Updating after a code change

When a new image lands on GHCR:

- **Unraid UI**: Docker tab → click the WellnessQuest container icon → **Force Update**. Pulls the latest of the configured tag (e.g. `:preview`), recreates the container with the same env, runs migrations on start.
- **Shell**: `docker pull ghcr.io/connorbs/wellnessquest:preview && docker restart wellnessquest`.

Migrations run on backend startup, so there's nothing extra to do unless a release adds a new env var — in which case re-apply the template (Add Container → Template → wellnessquest) to surface the new field.

**Pin to a specific build**: edit the container's **Repository** field from `:preview` to `:sha-XXXXXXX` (any tag from a green deploy run). Apply.

## When a deploy fails

The unified image is built and pushed by `.github/workflows/deploy.yml`. If the workflow fails, **GHCR keeps serving the last successful build** — so Force Update on Unraid will silently pull stale code. The repo is wired to surface failures two ways:

1. **A GitHub Issue is opened on every failure** with the failing commit SHA, a link to the workflow run logs, and the commit message. You'll get a notification via your normal GitHub issue subscription.
2. **The README has a deploy badge** at the top — green when the latest run succeeded, red otherwise.

The most common silent-failure mode I've hit: Next.js's production build (`pnpm build`) enforces some lint rules as **errors** that `pnpm typecheck` doesn't catch — `react/no-unescaped-entities` is the classic. To reproduce locally before pushing UI changes:

```bash
cd frontend
NEXT_OUTPUT_MODE=export pnpm build
```

If that's clean, the GHA build will be clean too.

## Evolving the template

`unraid/wellnessquest.xml` is the source of truth. When the slice gains a new env var:

1. Add a `<Config Name="..." Target="VAR_NAME" Type="Variable" .../>` entry to the XML and commit.
2. On Unraid, re-import the template (Docker → Add Container → Template → wellnessquest → re-pick) **or** manually add the same field via the container's Edit view. Existing env values are preserved across template re-imports for keys whose `Target=` already exists.

Unraid auto-writes your live container's customizations to `/boot/config/plugins/dockerMan/templates-user/my-wellnessquest.xml`. Diff that against the repo's template if something gets out of sync.

## Diagnostics & recovery

If the welcome / create-admin page shows up on a deployment that was working
before, **don't fill the form in yet** — your data may still be there. A new
admin created via setup gets a new `user_id`, and your old water/food/activity
rows are linked to the *previous* `user_id`, so the new account's dashboard
will look empty even though the data exists.

All commands below are mobile-friendly: tap your **postgres container's icon
in the Unraid WebUI → `>_` (Console)** to drop into a shell inside it. No
`docker exec` or `docker compose` required.

### Find your DB user and DB name

The runbook examples use `wq` / `wellnessquest`, but on Unraid these are whatever
*you* picked when you set up the postgres container. Check them in the Unraid
WebUI: click your postgres container → **Edit** → look at `POSTGRES_USER` and
`POSTGRES_DB`. Substitute those values everywhere `<USER>` and `<DB>` appear
below. If you set a custom password and the console rejects passwordless login,
add `-W` and paste it.

### Step 1 — see what's in the database

```sh
psql -U <USER> -d <DB> \
  -c "SELECT id, email, role, disabled_at FROM users ORDER BY created_at;" \
  -c "SELECT 'water_logs' AS tbl, count(*) FROM water_logs
      UNION ALL SELECT 'food_logs', count(*) FROM food_logs
      UNION ALL SELECT 'activity_logs', count(*) FROM activity_logs
      UNION ALL SELECT 'weight_entries', count(*) FROM weight_entries
      UNION ALL SELECT 'habits', count(*) FROM habits;"
```

Three possible outcomes:

| What you see | Meaning | Go to |
|---|---|---|
| Users listed, your admin row has a `disabled_at` timestamp | Account got disabled, data intact | **Step 2a** |
| Users listed, but none have `role='admin'` (or the admin row is missing) | Admin lost, other users + data may be intact | **Step 2b** |
| `users` empty AND every `count` returns 0 | DB really is fresh; just fill in the setup form on the WQ page | — |
| `users` empty BUT some counts > 0 | Orphaned data — see **Step 2c** | **Step 2c** |

### Step 2a — re-enable your existing admin

```sh
psql -U <USER> -d <DB> \
  -c "UPDATE users SET disabled_at = NULL WHERE email = 'you@example.com';"
```

Refresh the WQ page, sign in normally. Done.

### Step 2b — promote an existing user back to admin

If the admin row was deleted but other user rows exist, promote one of them
(this also clears `disabled_at` if it was set):

```sh
psql -U <USER> -d <DB> \
  -c "UPDATE users SET role = 'admin', disabled_at = NULL,
                       must_change_password = true
      WHERE email = 'you@example.com';"
```

You won't know the old password, so set a new hash via the WQ container shell
(it has Python + the app code, so it can hash with the same algorithm):

```sh
docker exec -it wellnessquest python -c "
from app.auth.passwords import hash_password
print(hash_password('YourNewTempPassword!'))
"
```

Copy the printed hash and write it back:

```sh
psql -U <USER> -d <DB> \
  -c "UPDATE users SET password_hash = '<paste-hash-here>'
      WHERE email = 'you@example.com';"
```

Sign in with `you@example.com` / `YourNewTempPassword!`. The app forces a
password change on first login.

### Step 2c — orphaned data, no users at all

This is the rarest case (data tables have rows but the `users` table is empty).
Recovering means reattaching old rows to a new admin. The user-data tables
(`water_logs`, `food_logs`, `activity_logs`, `weight_entries`, `habits`,
`goals`, `water_presets`, `activity_presets`, `food_presets`) all carry a
`user_id` foreign key. Look at the distinct `user_id`s that show up in each:

```sh
psql -U <USER> -d <DB> \
  -c "SELECT DISTINCT user_id FROM water_logs
      UNION SELECT DISTINCT user_id FROM food_logs
      UNION SELECT DISTINCT user_id FROM activity_logs;"
```

If there's a single `user_id` (one-person household), create a new admin via
the setup form, then re-point the old rows at the new admin's id:

```sh
psql -U <USER> -d <DB> \
  -c "UPDATE water_logs    SET user_id = '<new-admin-uuid>' WHERE user_id = '<old-uuid>';" \
  -c "UPDATE food_logs     SET user_id = '<new-admin-uuid>' WHERE user_id = '<old-uuid>';" \
  -c "UPDATE activity_logs SET user_id = '<new-admin-uuid>' WHERE user_id = '<old-uuid>';" \
  -c "UPDATE weight_entries SET user_id = '<new-admin-uuid>' WHERE user_id = '<old-uuid>';" \
  -c "UPDATE habits        SET user_id = '<new-admin-uuid>' WHERE user_id = '<old-uuid>';" \
  -c "UPDATE goals         SET user_id = '<new-admin-uuid>' WHERE user_id = '<old-uuid>';"
```

(Multi-user households: do this per old user, mapping each to a freshly-created
new user.)

### Restore from the backup container's dumps

If steps 2a-c don't apply (data really is gone), the `backup` service in
`docker-compose.yml` writes nightly `pg_dump` archives. On Unraid you'll only
have these if you wired up an equivalent backup container — the unified
WellnessQuest image doesn't bundle one. Check `/mnt/user/appdata/` for a
`wq-YYYYMMDD-HHMM.dump.gz` you trust, then follow the restore steps in
[`runbook.md` → Backups](runbook.md#backups), substituting your `<USER>` /
`<DB>` and your postgres container name.

## Switching to HTTPS later

Two paths once you've validated the slice:

- **Reverse proxy** (NPM/SWAG/Traefik already on Unraid): proxy your chosen hostname to `wellnessquest:8000`. One upstream covers both the PWA and the API since they share the same origin.
- **Caddy alongside**: the repo's `docker-compose.yml` has a `caddy` profile (`docker compose --profile proxy up -d caddy`) intended for local dev with TLS; you can adapt the Caddyfile for production on Unraid.

## Local development (not Unraid)

The `docker-compose.yml` in the repo runs a three-service dev stack (db + backend + frontend) with hot reload on both. That setup is **only** for development on your laptop — Unraid uses the unified image above instead. See the comments in the compose file for usage.
