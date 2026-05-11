# WellnessQuest

A gamified health and wellness tracker that transforms daily habits into quests. Track weight, calories, water intake, and streaks while leveling up your character. Multi-user support with Home Assistant integration for a connected smart home experience.

## Status

Slice 1 (vertical proof of stack): multi-user water tracking with HA two-way integration, XP/level scaffolding, and telemetry/error capture.

## Stack

- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2 async, Alembic, Postgres 16
- **Frontend**: Next.js 15 App Router (TypeScript), TanStack Query, PWA with offline water queue
- **Auth**: Argon2 password hashing, JWT access + opaque refresh, long-lived HA tokens
- **Integration**: REST API + outbound webhooks, with pluggable provider/integration registries
- **Infra**: Docker Compose, Caddy (LAN HTTPS via internal CA)

## Local quickstart

```bash
cp .env.example .env
# edit secrets (POSTGRES_PASSWORD, JWT_SECRET, FERNET_KEY, ADMIN_PASSWORD, PARTNER_PASSWORD)
make dev          # build + run the dev stack with hot reload
make seed         # create admin@local + partner@local
```

Backend: <http://localhost:8000/docs>. Frontend: <http://localhost:3000>. LAN: <https://wellnessquest.lan>.

## Docs

- `docs/architecture.md` — services, modules, conventions
- `docs/api.md` — REST surface
- `docs/home-assistant.md` — HA snippets, token issuance, webhooks
- `docs/providers.md` — adding a provider or integration
- `docs/runbook.md` — backup/restore, upgrades

## License

See `LICENSE`.
