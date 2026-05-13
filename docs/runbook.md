# Runbook

## First run

**Deploying to Unraid?** Follow [`unraid.md`](./unraid.md) — Compose Manager + GHCR pull, no reverse proxy.

**Local dev (laptop, builds from source):**

```bash
cp .env.example .env
# generate secrets
python -c "import secrets; print(secrets.token_urlsafe(32))"           # JWT_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FERNET_KEY
# pick a strong POSTGRES_PASSWORD
make dev
```

Open <http://localhost:3000>. With no users yet the app redirects to `/setup`
and asks you to create the first admin account. Add additional users from
inside the app afterwards (Settings → Users).

## Daily ops

- Logs: `make logs`
- DB shell: `make psql`
- Migrate after pulling: `make migrate`

## Backups

The `backup` container runs `pg_dump` nightly at 02:30 UTC and gzips the result into `./backups/`. Retention: 14 daily + 8 weekly.

Restore a dump:

```bash
# 1. Stop the backend so nothing writes during restore
docker compose stop backend

# 2. Drop and recreate the database
docker compose exec postgres psql -U wq -d postgres -c "DROP DATABASE wellnessquest; CREATE DATABASE wellnessquest;"

# 3. Pipe the chosen dump in. Both -Fc and gzipped -Fc work:
gunzip -c ./backups/wq-YYYYMMDD-HHMM.dump.gz \
  | docker compose exec -T postgres pg_restore -U wq -d wellnessquest --clean --if-exists

# 4. Bring the backend back up
docker compose start backend
```

## Upgrades

1. `git pull` (only needed for compose / infra / HA-snippet changes)
2. `docker compose pull` — fetches the latest published images from GHCR
3. `docker compose up -d`
4. Backend container runs `alembic upgrade head` automatically on start.

For agent-pipeline deployments via Watchtower, label-scoped to the WQ services: container labels `com.centurylinklabs.watchtower.enable=true` are set on `backend` and `frontend` only. Postgres, Caddy, and backup are explicitly opted out.

## Pinning a specific build

If something breaks after a pull, switch `WQ_IMAGE_TAG` in `.env` from `latest` (or `preview`) to a specific `sha-XXXXXXX` from a known-good run, then `docker compose pull && docker compose up -d`.

## HA token rotation

1. Settings → Tokens → revoke the old one.
2. Create a new token with the same scopes, paste it into HA's `secrets.yaml` as `wq_ha_token`, reload HA.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 invalid_token` on the PWA | Refresh token rotated (or expired) | Sign out and back in |
| HA sensor stuck at last value | Backend down or token revoked | Check `docker compose ps`, check Settings → Tokens for `last_used_at` |
| Water entries duplicated | Same `client_id` reused across different totals | Generate a fresh `crypto.randomUUID()` per click; offline queue already does this |
| Webhook never fires in HA | `webhook_id` mismatch | Compare WQ integration `config.webhook_id` with the id in your HA automation |
