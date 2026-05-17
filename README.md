# WellnessQuest

[![Deploy](https://github.com/ConnorBS/WellnessQuest/actions/workflows/deploy.yml/badge.svg)](https://github.com/ConnorBS/WellnessQuest/actions/workflows/deploy.yml)

A gamified household wellness tracker. Log water, activity, habits, weight, and blood pressure; see progress against goals on a single dashboard; tie it to Home Assistant for two-way automation. Designed for a two-person home running on Unraid.

## Status

Five trackers wired up, day-by-day navigation, Material Design icon picker, PWA install on phone, Home Assistant two-way integration for water. Single Docker image, bring-your-own Postgres.

## Modules

| Module | What it tracks | Cadence shape |
|---|---|---|
| **Water** | Daily ml against a goal | Continuous scalar, per-day total |
| **Activity** | Active minutes against a goal, with optional exercise type tag | Continuous scalar, per-day total |
| **Habits** | Discrete tap-to-check items with flexible cadence | `daily` / `weekly(N)` / `monthly(N)` / `every K days` |
| **Weight** | Time-series weight entries + versioned target history | Append-only log, sparkline + delta |
| **Blood pressure** | Systolic/diastolic (+ optional pulse) with AHA classification | Append-only log, multiple readings/day, optional target |

Each module has its own page, settings sub-page (goal + presets), and dashboard card. Day-navigation arrows + horizontal swipe move the dashboard between days (never future).

## Stack

- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2 async, Alembic, Postgres 16+
- **Frontend**: Next.js 15 App Router (TypeScript), TanStack Query, statically exported into the unified image
- **Auth**: Argon2 password hashing, JWT access + opaque refresh, long-lived HA tokens with scope gating
- **Icons**: Material Design Icons (~7,000), searchable picker
- **Deploy**: Single unified Docker image at `ghcr.io/connorbs/wellnessquest`, FastAPI serves both the API and the static PWA bundle

## Quickstart

**Unraid (production target)**: see [`docs/unraid.md`](docs/unraid.md). Single template, single container, BYO Postgres.

**Local dev (laptop, builds from source)**:

```bash
cp .env.example .env
# generate JWT_SECRET, FERNET_KEY, POSTGRES_PASSWORD
make dev          # build + run the dev stack with hot reload
```

Frontend: <http://localhost:3000>. Backend docs (Swagger): <http://localhost:8000/docs>.

On first boot the database has no users. Open the app and you'll land on a
welcome screen that asks you to create the initial admin account (Nginx Proxy
Manager-style). After that, more users are added from inside the app
(Settings → Users) — credentials never live in environment variables.

## Docs

- [`docs/unraid.md`](docs/unraid.md) — Unraid + GHCR first-run guide (deployment target)
- [`docs/architecture.md`](docs/architecture.md) — service shape, module pattern, table inventory
- [`docs/api.md`](docs/api.md) — REST surface across all modules
- [`docs/home-assistant.md`](docs/home-assistant.md) — HA snippets, token issuance, webhooks
- [`docs/providers.md`](docs/providers.md) — adding a provider or integration
- [`docs/runbook.md`](docs/runbook.md) — local-dev ops, backups, troubleshooting
- [`docs/agent-pipeline.md`](docs/agent-pipeline.md) — multi-agent workflow plan

## License

See `LICENSE`.
