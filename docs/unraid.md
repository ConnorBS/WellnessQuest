# Unraid first-run guide

This is the recommended deploy path for slice 1 on Unraid: pull pre-built images from GitHub Container Registry (GHCR) and run them via the **Compose Manager** plugin. No custom Unraid template needed for slice 1 — the stack is multi-service with internal docker networking, which compose handles natively. A real Unraid template per service is M2+ work.

## A. Prerequisites on Unraid

1. **Community Applications** installed.
2. **Compose Manager** plugin (search "compose" in CA, install the one by `dlandon`).
3. SSH access to Unraid (Settings → Management → SSH), or the WebUI terminal under Tools.
4. An `appdata` location for WellnessQuest. The rest of this guide assumes `/mnt/user/appdata/wellnessquest`.

## B. Publish images to GHCR (one-time)

The `.github/workflows/deploy.yml` workflow builds and pushes both images to GHCR on every push to `main` or `claude/**`. For slice 1, the working branch publishes the `:preview` tag.

1. Push the working branch to GitHub (if not already).
2. Watch the **deploy** workflow under Actions until it finishes (~3-5 min first run, faster after that thanks to buildx cache).
3. Make the packages visible to your Unraid pulls. By default GHCR packages tied to a private repo are private. Two options:
   - **Keep private (recommended)**: generate a Personal Access Token with `read:packages` scope at <https://github.com/settings/tokens?type=beta>. Save it as `GHCR_PAT`.
   - **Make public**: GitHub → your profile → Packages → `wellnessquest-backend` → Package settings → Change visibility → Public. Repeat for `wellnessquest-frontend`. No PAT needed on Unraid.

## C. Local DNS for `wellnessquest.lan`

You picked LAN DNS over IP-only access. Pick the path that matches your network:

- **Router-level DNS**: most consumer routers (Unifi, OPNsense, pfSense) support "Local DNS records" or "Static DNS". Add `wellnessquest.lan` → Unraid IP.
- **Pi-hole / AdGuard Home**: Local DNS → Custom DNS records → add the same mapping.
- **Test only on a single device**: edit `/etc/hosts` (or `C:\Windows\System32\drivers\etc\hosts`) to add `UNRAID_IP wellnessquest.lan`. Won't work on phones without a profile.

Verify from your laptop:

```bash
ping wellnessquest.lan       # should resolve to Unraid's IP
```

## D. Get the repo onto Unraid

You only need it for `docker-compose.yml`, `.env`, the Postgres init script, the backup container build context, and the HA snippets — not for the Python or Node source (those are inside the GHCR images).

```bash
# Unraid terminal
mkdir -p /mnt/user/appdata/wellnessquest
cd /mnt/user/appdata/wellnessquest
git clone https://github.com/ConnorBS/WellnessQuest.git .
git checkout claude/health-tracking-app-27gJW
```

If you don't want git on Unraid, SMB-mount `/mnt/user/appdata/wellnessquest` from your laptop and copy the repo over.

## E. Configure `.env`

```bash
cd /mnt/user/appdata/wellnessquest
cp .env.example .env
```

Generate the three sensitive values from your laptop or any machine with Python:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# also Fernet:
pip install -q cryptography && python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Open `.env` and:

- `POSTGRES_PASSWORD` → strong random string. Also update the password inside `DATABASE_URL`.
- `JWT_SECRET` → first generated value.
- `FERNET_KEY` → second generated value.
- `ADMIN_PASSWORD`, `PARTNER_PASSWORD` → your real passwords.
- `WQ_IMAGE_OWNER` → `connorbs` (lowercase; or your GitHub user/org).
- `WQ_IMAGE_TAG` → `preview` for the slice-1 branch; switch to `latest` once you merge to main.
- `TZ` → `America/Toronto`.

## F. Authenticate to GHCR (only if you kept packages private)

On Unraid:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u ConnorBS --password-stdin
```

Docker stores this in `/root/.docker/config.json` so it persists across reboots.

## G. Bring up the stack

### Option 1: Compose Manager UI

1. Open Compose Manager → Add new stack named `wellnessquest`.
2. Point it at `/mnt/user/appdata/wellnessquest/docker-compose.yml`.
3. Click **Compose Up**.

### Option 2: SSH

```bash
cd /mnt/user/appdata/wellnessquest
docker compose pull
docker compose up -d
docker compose logs -f backend
```

Wait for `Uvicorn running on 0.0.0.0:8000`. Migrations run automatically as part of the backend startup command.

## H. Seed admin + partner

```bash
docker compose exec backend python -m app.db.seed
```

This creates `admin@local` and `partner@local` with the passwords from `.env`. Re-running is safe (idempotent).

## I. First login

Open `http://wellnessquest.lan:3000` on your phone or laptop:

1. Sign in as `admin@local`.
2. Change the admin password.
3. Settings → Admin → New invite → copy the code → share the `/signup?code=...` link with your wife.

Install the PWA: Chrome / Safari → "Add to Home Screen".

## J. Wire up Home Assistant

1. Issue an HA token: Settings → Tokens → New (`HA living room`, scopes `water:read` + `water:write`). Copy the `wq_ha_...` value now — shown once.
2. Add to HA `secrets.yaml`:
   ```yaml
   wq_ha_token: "wq_ha_REPLACE_ME"
   ```
3. Paste the snippets from `infra/home-assistant/` into HA (already point at `http://wellnessquest.lan:8000`). Restart HA.
4. In WellnessQuest: Settings → Integrations → Add Home Assistant. Set `base_url=http://homeassistant.local:8123` and pick a unique `webhook_id`. Subscribe `water.goal_met`.
5. Paste the same `webhook_id` into the HA automation snippet and reload automations.

## K. Verify (one pass through the slice-1 checklist)

1. PWA quick-add: tap +250 a few times, watch the gauge.
2. HA: `sensor.wq_water_today` reflects the same total within 60 s.
3. HA: tap a Lovelace `+500 ml` button — PWA dashboard catches up in a few seconds; `water_entries` row source is `ha`.
4. Cross 2000 ml — HA gets a push from the automation.
5. Sign in as partner — only their data visible.
6. Trigger an error (`curl` a 422): `error_log` has the row.

## Updates

When a new image is published to GHCR (push to `main` or `claude/**`):

```bash
cd /mnt/user/appdata/wellnessquest
docker compose pull
docker compose up -d
```

Backend runs `alembic upgrade head` on start. M2's deploy workflow + Watchtower will automate this; for slice 1, the manual two-line update is fine.

## Switching to HTTPS later

Two paths:

- **Existing reverse proxy** (NPM/SWAG/Traefik on Unraid): point your proxy at `wellnessquest.lan:3000` for the app and `wellnessquest.lan:8000/api/v1/` for the API (or just proxy all of `:3000` — Next.js rewrites already forward `/api/v1/*` to the backend).
- **Built-in Caddy with internal CA**: `docker compose --profile proxy up -d caddy` (binds 80/443 on Unraid — make sure nothing else uses them). Install Caddy's root cert on phones and HA.
