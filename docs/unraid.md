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

| Branch | Tags published |
|---|---|
| `main` | `:latest`, `:stable`, `:sha-<7>` |
| `claude/**` | `:preview`, `:sha-<7>` |

Push the working branch, watch the **deploy** workflow under Actions until green (~3-5 min first time), then confirm the package exists at <https://github.com/ConnorBS?tab=packages> as `ghcr.io/connorbs/wellnessquest`.

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

Plus pick passwords for the two seeded users (`ADMIN_PASSWORD`, `PARTNER_PASSWORD`).

## Install the template

1. From any machine with SMB access to Unraid, copy `unraid/wellnessquest.xml` to `\\TOWER\flash\config\plugins\dockerMan\templates-user\` (i.e. `/boot/config/plugins/dockerMan/templates-user/`). Filename can be anything ending in `.xml`.
2. In the Unraid WebUI: **Docker → Add Container → Template** dropdown → **wellnessquest**.
3. Fill in the fields:
   - **DATABASE_URL** — `postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME` with your Postgres values from prereq 1.
   - **JWT_SECRET** — paste the generated value.
   - **FERNET_KEY** — paste the generated value.
   - **ADMIN_PASSWORD** — your chosen admin password.
   - **PARTNER_PASSWORD** — your wife's chosen password.
   - **App data** — host path for persistent data (uploaded preset icons today). Default `/mnt/user/appdata/wellnessquest/data` is usually right.
   - **CORS_ORIGINS**, **TZ** — defaults are fine if your LAN matches the defaults.
   - **App port** — defaults to 8000; change if it conflicts with another service.
4. **Apply**. The image pulls from GHCR (~30 s), then the container runs `alembic upgrade head` and starts uvicorn. Watch the log until you see `Uvicorn running on 0.0.0.0:8000`. The healthcheck flips the badge to `healthy` after ~30 s.

## First users

The container auto-seeds them on every start (right after Alembic migrations, before uvicorn). It reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` (and `PARTNER_EMAIL` / `PARTNER_PASSWORD` if set) and inserts them only if they don't already exist.

A few gotchas worth knowing:

- The seed **does not rotate passwords**. Once the user row exists in Postgres, changing `ADMIN_PASSWORD` in the template does nothing — change passwords from the UI instead.
- If you initially set the wrong password and want to start over, delete the user row and the next container restart will re-seed:
  ```bash
  docker exec wellnessquest python -c "
  import asyncio
  from sqlalchemy import delete
  from app.db.session import async_session
  from app.models.user import User
  async def main():
      async with async_session() as db:
          await db.execute(delete(User).where(User.email == 'admin@local'))
          await db.commit()
  asyncio.run(main())
  "
  docker restart wellnessquest
  ```
  (Replace `admin@local` with whatever you actually set in `ADMIN_EMAIL`.)
- Email comparison is case-sensitive — log in with the exact value you set in `ADMIN_EMAIL`.
- You can also run the seed manually anytime: `docker exec wellnessquest python -m app.db.seed`. Idempotent.

## First login

Open `http://wellnessquest.lan:8000/` (or `http://<unraid-ip>:8000/`). Sign in as `admin@local`, change your password, then **Settings → Admin → New invite** to mint the signup link for your wife.

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

## Evolving the template

`unraid/wellnessquest.xml` is the source of truth. When the slice gains a new env var:

1. Add a `<Config Name="..." Target="VAR_NAME" Type="Variable" .../>` entry to the XML and commit.
2. On Unraid, re-import the template (Docker → Add Container → Template → wellnessquest → re-pick) **or** manually add the same field via the container's Edit view. Existing env values are preserved across template re-imports for keys whose `Target=` already exists.

Unraid auto-writes your live container's customizations to `/boot/config/plugins/dockerMan/templates-user/my-wellnessquest.xml`. Diff that against the repo's template if something gets out of sync.

## Switching to HTTPS later

Two paths once you've validated the slice:

- **Reverse proxy** (NPM/SWAG/Traefik already on Unraid): proxy your chosen hostname to `wellnessquest:8000`. One upstream covers both the PWA and the API since they share the same origin.
- **Caddy alongside**: the repo's `docker-compose.yml` has a `caddy` profile (`docker compose --profile proxy up -d caddy`) intended for local dev with TLS; you can adapt the Caddyfile for production on Unraid.

## Local development (not Unraid)

The `docker-compose.yml` in the repo runs a three-service dev stack (db + backend + frontend) with hot reload on both. That setup is **only** for development on your laptop — Unraid uses the unified image above instead. See the comments in the compose file for usage.
