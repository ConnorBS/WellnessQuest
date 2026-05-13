# Agent pipeline (planned, M2)

Slice 1 ships with **Light CI**: lint + typecheck + unit + a single Playwright smoke run against a docker-compose stage. Branch protection on `main` requires checks to pass. That's enough to keep the trunk green while we build the heavy pipeline next.

M2 turns on a four-agent loop driven by GitHub Actions:

| Agent | Trigger | Scope | What it does |
|---|---|---|---|
| **Builder** | Issue label `agent:build` | Write `backend/**`, `frontend/**`, `docs/**`; **never** `.github/workflows/**` or `infra/**` | Parses Acceptance / Out-of-scope from the issue template, opens a PR on `claude/issue-<n>-<slug>`, runs `make test` before opening. Marks the PR `agent:qa-pending`. |
| **QA / Tester** | PR label `agent:qa-pending` or any PR to `claude/**` | Read-only against code; can boot compose | Runs pytest, Playwright, `tests/scenarios/*.yaml` declarative scripts, and `schemathesis` against `/openapi.json`. Posts a single structured comment. Sets `agent:qa-pass` or `agent:qa-fail`. |
| **Reviewer** | PR label `agent:qa-pass` | Read-only | Runs `bandit`, `pip-audit`, `npm audit --omit=dev`, `semgrep`. Checks architecture invariants from `docs/architecture.md`. Sets `agent:review-pass` or `agent:review-changes`. |
| **Deploy** | Push to `main` | Build + push GHCR images, render `alembic upgrade --sql`, ping home server | Watchtower scoped via `com.centurylinklabs.watchtower.enable=true` pulls and restarts the WQ services only. |

Promotion: auto-merge when `agent:qa-pass` + `agent:review-pass` + CODEOWNERS approval. `CODEOWNERS` requires a human ack for `/infra/`, `/.github/`, and Alembic migrations.

## Reviewer ruleset (initial)

Tune in this file over time. Reviewer agent should check at minimum:

- No raw SQL in `app/api/`.
- Every router function uses `Depends(current_user)` or `Depends(current_ha_token(...))`.
- No service uses `datetime.now()` of server local time — must go through `services.time_utils.day_for_user`.
- New migrations are deterministic (`alembic upgrade --sql` diff attached to PR).
- No new dependency without a one-line justification in the PR body.
- No `print(...)` left in services; use `structlog` via `get_logger`.

## Scenario suite (planned location)

`backend/app/tests/scenarios/*.yaml` — declarative end-to-end scripts. Each scenario:

1. Creates the first admin via `/api/v1/setup/admin`, then a second user via `/api/v1/admin/users`.
2. Issues an HA token.
3. Logs water via both PWA route and HA route.
4. Asserts XP rules and webhook delivery.

Slice 1 only includes one Playwright smoke; the scenario runner is part of M2.
