# Unraid first-run guide

Two supported paths to bring WellnessQuest up on Unraid:

- **[Path A: per-service templates](#path-a--per-service-templates-recommended-for-slice-1)** (recommended). Three first-class containers in the Unraid Docker tab — Postgres, backend, frontend. Native Start/Stop/Logs/Update buttons per service. Templates live in `unraid/` and evolve with the slice.
- **[Path B: Compose Manager](#path-b--compose-manager-alternative)**. A single docker-compose.yml runs the whole stack; the Unraid UI sees the project, not the individual containers. Lower per-service ceremony, less native Unraid feel.

You can switch between paths later — both pull the same GHCR images and use the same `.env` / volume layout.

---

## Common prerequisites

These steps apply to both paths.

### 1. Publish images to GHCR (one-time)

The `.github/workflows/deploy.yml` workflow builds and pushes both images to GHCR on every push to `main` or `claude/**`. Tag mapping:

| Branch | Tags published |
|---|---|
| `main` | `:latest`, `:stable`, `:sha-<7>` |
| `claude/**` | `:preview`, `:sha-<7>` |

Push the working branch, watch the **deploy** workflow under Actions until it's green (~3-5 min first time), then confirm both packages exist at <https://github.com/ConnorBS?tab=packages>:

- `ghcr.io/connorbs/wellnessquest-backend`
- `ghcr.io/connorbs/wellnessquest-frontend`

Both packages default to private (inherits repo visibility). Keep them private — you already have a PAT.

### 2. Authenticate the Unraid docker daemon to GHCR

On Unraid (terminal or SSH):

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u ConnorBS --password-stdin
```

The credential lands in `/root/.docker/config.json` and persists across reboots. After this, both the Docker UI's "Force Update" button and any compose pull will succeed against the private packages.

### 3. Create the custom docker network

All three containers (Postgres + backend + frontend) need to reach each other by hostname on a shared network. Create it once:

```bash
docker network create wellnessquest
```

Verify:

```bash
docker network ls | grep wellnessquest
```

### 4. Add `wellnessquest.lan` to local DNS

Map `wellnessquest.lan` to the Unraid IP via whichever DNS authority your LAN uses (router static DNS, Pi-hole, AdGuard, or `/etc/hosts` for laptop-only). Verify with `ping wellnessquest.lan`.

### 5. Lay down the appdata directory + repo clone

The backend image is fully self-contained, but we still need the Postgres `init.sql` and (if you use Path B) the compose file on disk. Standard location:

```bash
mkdir -p /mnt/user/appdata/wellnessquest
cd /mnt/user/appdata/wellnessquest
git clone https://github.com/ConnorBS/WellnessQuest.git repo
cd repo
git checkout claude/health-tracking-app-27gJW
```

This gives you:

- `/mnt/user/appdata/wellnessquest/repo/` — checked-out source (compose, init.sql, templates, HA snippets)
- `/mnt/user/appdata/wellnessquest/postgres/` — will hold the Postgres data dir (created on first start)

### 6. Generate secrets

From any machine with Python:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"                                     # JWT_SECRET
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"        # FERNET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(24))"                                     # POSTGRES_PASSWORD
```

Keep these alongside your real `ADMIN_PASSWORD` and `PARTNER_PASSWORD` — you'll paste them into the templates (Path A) or `.env` (Path B).

---

## Path A — per-service templates (recommended for slice 1)

Three containers wired to the `wellnessquest` network. The Unraid Docker tab shows each one with its own health badge, port, logs, and update button.

### A.1 Install Postgres via Community Apps (or "Add Container")

We don't ship our own Postgres template — the upstream image is well-supported by Unraid's standard "Add Container" flow. Configure it as follows:

1. **Docker tab → Add Container**.
2. **Template**: leave blank (we're configuring from scratch).
3. **Name**: `postgres` — this is critical; the backend's `DATABASE_URL` resolves Postgres by this exact hostname on the docker network.
4. **Repository**: `postgres:16-alpine`.
5. **Network Type**: `Custom: wellnessquest`.
6. **WebUI**: leave blank.
7. Add **Variables**:
   - `POSTGRES_USER` = `wq`
   - `POSTGRES_PASSWORD` = the one you generated
   - `POSTGRES_DB` = `wellnessquest`
   - `TZ` = `America/Toronto`
8. Add **Paths**:
   - Container path `/var/lib/postgresql/data` → Host path `/mnt/user/appdata/wellnessquest/postgres` (RW)
   - Container path `/docker-entrypoint-initdb.d/init.sql` → Host path `/mnt/user/appdata/wellnessquest/repo/infra/postgres/init.sql` (RO)
9. **Apply**. Watch the log until you see `database system is ready to accept connections`.

If you want to save your customization as a reusable template, click "Add another Path/Port/Variable" → in the per-container "User Templates" dropdown you'll see your `postgres` entry the next time you "Add Container".

### A.2 Install the backend template

1. From any machine with SMB access, copy `unraid/wellnessquest-backend.xml` to `\\TOWER\flash\config\plugins\dockerMan\templates-user\` (i.e. `/boot/config/plugins/dockerMan/templates-user/` on Unraid). The filename can be anything `.xml`.
2. In the Unraid WebUI: **Docker → Add Container → Template** dropdown → pick **wellnessquest-backend**.
3. Fill in the required fields:
   - **DATABASE_URL**: replace `CHANGE_ME` with the Postgres password you set in A.1. The full value should be `postgresql+asyncpg://wq:<your-password>@postgres:5432/wellnessquest`.
   - **JWT_SECRET**: paste the generated value.
   - **FERNET_KEY**: paste the generated value.
   - **ADMIN_PASSWORD**: your chosen admin password.
   - **PARTNER_PASSWORD**: your wife's chosen password.
   - **CORS_ORIGINS**, **TZ**: defaults are fine if your LAN matches the assumptions.
4. **Apply**. The image will pull from GHCR (~30 s on a fresh node), then the container runs `alembic upgrade head` and starts uvicorn. Watch the log until you see `Uvicorn running on 0.0.0.0:8000`.
5. The healthcheck in the image will flip the Unraid container badge to `healthy` after ~30 s.

### A.3 Install the frontend template

1. Copy `unraid/wellnessquest-frontend.xml` to `/boot/config/plugins/dockerMan/templates-user/` the same way.
2. **Docker → Add Container → Template → wellnessquest-frontend**.
3. Defaults are usually correct. Confirm:
   - **BACKEND_UPSTREAM** = `http://wellnessquest-backend:8000` (matches the backend container name).
   - **NEXT_PUBLIC_API_BASE** = `/api/v1`.
4. **Apply**. Once it shows up at `http://wellnessquest.lan:3000`, you're in the slice.

### A.4 Seed the first users

```bash
docker exec wellnessquest-backend python -m app.db.seed
```

Re-running is safe (idempotent). This reads `ADMIN_EMAIL/PASSWORD` and `PARTNER_EMAIL/PASSWORD` from the backend container's env.

### A.5 First login

Open `http://wellnessquest.lan:3000`. Sign in as `admin@local`, change your password, then **Settings → Admin → New invite** → copy the `/signup?code=...` link for your wife.

Install the PWA on your phone: Safari/Chrome → "Add to Home Screen".

### A.6 Wire up Home Assistant

1. **Settings → Tokens → New** in WellnessQuest. Label `HA living room`, scopes `water:read` + `water:write`. Copy the `wq_ha_...` value (shown once).
2. Add to HA `secrets.yaml`:
   ```yaml
   wq_ha_token: "wq_ha_REPLACE_ME"
   ```
3. Paste the snippets from `infra/home-assistant/` into HA configuration; they already target `http://wellnessquest.lan:8000`. Restart HA.
4. In WellnessQuest: **Settings → Integrations → Add Home Assistant**. Set `base_url=http://homeassistant.local:8123`, pick a `webhook_id`, subscribe `water.goal_met`.
5. Paste the same `webhook_id` into the HA automation snippet and reload automations.

### A.7 Walk the 16-step verification checklist

From the bottom of the implementation plan — adds water from PWA, sees it in HA, fires from HA, observes XP + level change, partner isolation, error capture, etc.

### A.8 Updating after a code change

The slice will iterate. When a new image lands on GHCR:

```bash
# Pull new images. Unraid "Force Update" works too, per container.
docker pull ghcr.io/connorbs/wellnessquest-backend:preview
docker pull ghcr.io/connorbs/wellnessquest-frontend:preview

# Restart so each container picks up its new image.
docker restart wellnessquest-backend
docker restart wellnessquest-frontend
```

Migrations run on backend startup, so nothing extra to do.

**Pinning a specific build**: edit the container's **Repository** field in the Unraid UI from `:preview` to `:sha-XXXXXXX` (any tag from a green deploy run). Apply.

### A.9 When templates need to change

Because the slice will mutate, treat the XMLs in `unraid/` as the source of truth:

- **New env var added to the backend** → add a `<Config Name="..." Target="VAR_NAME" Type="Variable" .../>` block to `unraid/wellnessquest-backend.xml`, commit, then **on Unraid**: re-import the template (Add Container → Template → wellnessquest-backend → re-pick) or manually add the same field via the container's Edit view. The container's existing env values are preserved across template re-imports for keys whose `Target=` already exists.
- **Port change** → edit the `<Config Type="Port" .../>` default in the XML and on the container.
- **Image rename** → edit `<Repository>` in the XML and **Repository** in the container.

Tip: keep your live container's customized values exported as `my-wellnessquest-backend.xml` (Unraid writes this automatically into `templates-user/`). Diff that against the repo's template when something gets out of sync.

---

## Path B — Compose Manager (alternative)

If you'd rather have one source of truth (`docker-compose.yml`) and accept that the Unraid Docker tab sees the stack as a single project rather than per-service rows:

1. Install **Compose Manager** plugin (search "compose" in Community Applications, install dlandon's).
2. From `/mnt/user/appdata/wellnessquest/repo/`, copy `.env.example` to `.env` and fill in the same secrets from Common Step 6. Make sure `WQ_IMAGE_OWNER=connorbs` and `WQ_IMAGE_TAG=preview`.
3. Open Compose Manager → Add new stack `wellnessquest` → point it at `/mnt/user/appdata/wellnessquest/repo/docker-compose.yml`.
4. Click **Compose Up**. Backend, frontend, and the bundled Postgres come up together. The bundled Postgres uses the volume from the compose file (a docker-managed volume, not the path you created in Common Step 5 — if you want the data on a specific share, edit the compose volume mount).
5. Seed via `docker compose exec backend python -m app.db.seed` from the repo dir.
6. Update with `docker compose pull && docker compose up -d`.

Picking Path B means you should **not** also run Path A's Postgres / backend / frontend containers — they would conflict on names and ports. Pick one path per host.

---

## Switching to HTTPS later

Two options once you've validated the slice:

- **Reverse proxy** (NPM/SWAG/Traefik already on Unraid): proxy to `wellnessquest-frontend:3000` for the app — the Next.js rewrite already forwards `/api/v1/*` to the backend internally, so a single upstream is enough.
- **Built-in Caddy** (Path B only): `docker compose --profile proxy up -d caddy`. Install Caddy's root CA on your phone + HA.
