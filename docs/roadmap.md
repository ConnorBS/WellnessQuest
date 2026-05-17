# Roadmap

A prioritized view of where WellnessQuest goes next, based on a full code +
docs review of the current `main` (post-`v9` merge). Written for the
single-operator, two-person-household deployment that this project is built
for — not for a hypothetical SaaS pivot.

## How to read this

- **Phases are buckets, not promises.** "Now" is the highest-leverage, lowest-risk work; "Later" is exploratory and may move or drop.
- **Sizes are rough.** S = ≤1 day, M = a few days, L = a week+, XL = multi-week.
- Items reference concrete files / tables / endpoints so the work is shovel-ready.
- Anything already covered in [`docs/agent-pipeline.md`](agent-pipeline.md) is summarized here, not re-derived.

## What's already shipped (snapshot)

Five trackers (water, food, activity, habits, weight), per-user goals,
streaks, an XP+level loop, multi-user admin, first-run setup, PWA with an
offline queue for water, Material Design icon picker, Home Assistant two-way
integration (water only), OpenFoodFacts search + barcode, webhook dispatcher
with retry, audit/error logs, semver release pipeline, single-container
deploy. Auth: Argon2 + JWT access + rotating opaque refresh + remember-me +
HA scope-gated tokens.

## Themes driving the next year

1. **Finish the "Quest."** The product is named WellnessQuest but the
   "Quest" today is just XP and streaks. Achievements, household challenges,
   and milestones close that gap without a rewrite.
2. **Pay off the QoL debt.** Reminders, trends, data export, and macro
   targets are the obvious gaps every tracker app eventually fills. Each is
   small individually; together they change the daily-use experience.
3. **Widen the integration surface.** HA is wired for water only. Activity
   ingestion (Fitbit/Garmin), smart scales, ntfy/Discord notification
   channels, and Apple/Google Health import unlock the other modules.
4. **Harden ops.** Encrypted integration secrets, a real backup/restore UI,
   the planned agent pipeline (M2), and broader test coverage.
5. **Get the AI off the bench.** Natural-language logging, photo-based food
   capture, and weekly summaries — opt-in, behind a toggle, with a clear
   provider boundary so self-hosters can pick their own LLM or run none.

---

## Now (1–2 sprints)

Order matters loosely; each item is independently shippable.

### Reminders & nudges — M
Local notifications via Web Push from the PWA, configurable per metric and
per habit. Backend already stores per-user timezone; add a `reminders` table
keyed by `(user_id, kind, schedule)` and a small dispatcher that emits push
payloads through the existing service worker. Kinds to start with:
hydration low-water, missed habit, end-of-day "you're 200 kcal over."

### Trends & history view — M
Week / month / 90-day rollups for every metric. Add a single
`GET /<metric>/range?from&to&bucket=day|week` shape and reuse it for charts
on each module page and a calendar-heatmap on `/habits`. The dashboard's
`viewedDay` jump is great for in-the-moment editing; trends are the missing
*review* loop.

### CSV / JSON export — S
`GET /export/<metric>?from&to` per metric, plus `GET /export/all` zipping
everything for a user. Closes the data-portability gap surfaced in the
inventory — today the only way out is operator-level `pg_dump`. Pairs well
with an "Export my data" button in `settings/users` (per-user) and in admin.

### Streak freezes / vacation mode — S
Two `streak`-table additions: `freeze_credits_remaining` and a small monthly
top-up. A user-toggleable "vacation: 2026-06-01 to 2026-06-08" interval that
the streak service treats as neutral. Prevents the all-or-nothing failure
mode that kills streak-based motivation in week 3.

### Macro targets on food — S
Extend the `goals` model with three more metric keys: `food_protein_g`
(floor), `food_carbs_g` (ceiling), `food_fat_g` (ceiling). Food entries
already carry the per-entry macros. UI work is one extra panel under
`settings/food`.

### Encrypted integration secrets — S
[`docs/providers.md`](providers.md) currently warns: *"today it's plain JSON
— do not put real production secrets here yet."* Wire the existing
`FERNET_KEY` env through `integrations.secrets` JSONB read/write paths,
migrate any existing rows on upgrade, and lift the warning from the doc.

### First-run onboarding wizard — M
The setup page covers admin creation but drops you straight at an empty
dashboard. After admin creation, walk through: timezone confirmation, daily
water/activity goal, weight unit + show/hide weight card, optional HA token
generation with copy-to-clipboard, optional Web Push permission prompt.
None of this is new infra — it's a multi-step wrapper around endpoints
that already exist.

### Orphaned-data recovery flow — S
[`CLAUDE.md`](../CLAUDE.md) documents the painful scenario where
`water_entries` etc. have rows but `users` is empty (postgres phantom-path
bug → fresh DB on the *same* volume). Add a single admin-only
`POST /api/v1/setup/recover` that:
1. Detects orphan state via row counts.
2. Re-creates an admin with a user-chosen email + the smallest
   `user_id` actually referenced in the data tables.

So the recovered user lands on a dashboard with their data, not an empty
shell. Lifts a 1-paragraph recovery from the docs into a single click.

### Activity kcal estimation — S
Activity entries store `minutes` and (optionally) `exercise_type`. Add a MET
lookup table (Walking=3.5, Running=10.0, Cycling=8.0, etc.) and surface
"estimated kcal burned" on the activity card. With food kcal already
tracked, the dashboard can show net energy — high-value, cheap to build.

---

## Next (1–3 months)

### Achievements / milestones — M
A `milestones` catalog (static, in code) + a `user_milestones`
`(user_id, milestone_key, unlocked_at)` table. Hooks into the existing
`services.events.emit` so unlocks happen as a side-effect of normal logging.
Surface on a new `/(app)/achievements` page and as toasts on dashboard.
Starter set: first 10 entries, 7/30/90-day streaks, first goal-met week,
first 1000 mL day, first HA-logged entry. This is the single biggest move
toward earning the "Quest" in the name.

### Household / partner challenges — M
Opt-in shared goals between users on the same instance. Schema:
`challenges(id, name, metric, target, period, created_by)` +
`challenge_participants(challenge_id, user_id, joined_at)`. The dispatcher
already emits per-user events; aggregate them across participants in a new
service. "Hit 2L together for 7 days" → both users see one shared bar on
their dashboards. Specifically designed for the two-person home target.

### Outbound notification channels (ntfy, Discord, email) — M
Add three channel implementations under `backend/app/integrations/` using
the existing `channels.register` pattern from
[`docs/providers.md`](providers.md). Each is ~½ day; the UI at
`settings/integrations` already enumerates `GET /integrations/kinds`.
Unblocks "send me a push when my partner crosses their goal" without
requiring HA in the loop.

### Fitbit / Garmin / Polar activity import — L
Read-only OAuth provider under `backend/app/providers/activity/`. Daily
sync of steps + active minutes + HR zones into `activity_entries` with
`source='fitbit'`. The existing `client_id` uniqueness handles re-sync
dedup. Start with Fitbit (most documented OAuth flow); the others slot in
under the same provider interface.

### Smart scale ingestion — L
Two paths, ship whichever lands first:
- **ESPHome / HA-side:** new `weight:write` scope on HA tokens; HA-side
  ESPHome scale posts to a new `/ha/weight/add`. Cheapest path for
  existing HA users.
- **Withings OAuth:** new provider under `providers/weight/`. Higher
  setup cost, broader hardware support.

### Sleep module — M
Same shape as the existing four scalar modules: `sleep_entries`
(`hours`, `bedtime`, `wake_time`, optional `quality`), `goals` row with
metric `sleep_hours`, dashboard card, streak. Manual entry first, then
fold in the Fitbit feed from the activity-import work.

### Mood / journal module — M
One check-in per day: 1–5 scale + free-text note + optional tags.
Lightweight `mood_entries` table. Dashboard widget shows last-7-day mood
trend. Pairs well with the weekly-summary AI work below.

### Recipe / meal templates — M
`food_presets` today stores single items. Extend with a
`composite_preset_id` self-FK so a preset can be a *meal* of N sub-presets.
One-tap log of "Breakfast: oatmeal + banana + coffee." UI lift is the
main cost; the data shape is small.

### Photo-based food logging — L
Behind an `AI_PROVIDER` env. Upload a meal photo → Claude vision (or
configured provider) returns suggested food + macros → user confirms /
edits before commit. Reuses `uploads_service`; nothing persists to
`food_entries` until the user taps Save. Ship behind a feature flag so
self-hosters who don't want LLM dependencies are unaffected.

### Per-habit notes & history chart — S
Add a `note` column on `habit_checkins` and a chart of the last 30 days'
hit rate per habit. Surfaces under each habit on `/habits`. Tiny.

---

## Later (3–6 months, exploratory)

### Natural-language quick log — L
"I had two eggs and toast and a coffee" → parser (LLM-backed) →
preview-and-confirm modal → `POST /food` x3. Reuses the photo-logging
provider interface. Optional; not a core dep.

### AI weekly summary — M
Cron-style weekly job per user: "Last week — water up 12%, activity flat,
weight –0.4 kg. Habit X slipped. Try Y." Rendered on dashboard as a
dismissable card and emailed via the new SMTP channel if configured.

### Backup / restore UI — M
Closes the biggest single operator pain in [`docs/unraid.md`](unraid.md).
Admin-only:
- "Download backup" → streams `pg_dump` from inside the container, served
  through FastAPI so the operator doesn't need shell access.
- "Restore from backup" → upload + apply, guarded by a typed-confirmation
  modal because it's destructive.

Schedule-and-rotate via a small cron worker; settings live in
`settings/backups`. Pairs with the User Scripts recipe already in
`unraid.md`.

### Agent pipeline M2 — L
Already designed in [`docs/agent-pipeline.md`](agent-pipeline.md). Pick it
up once feature velocity warrants it (or earlier if review load grows).
Builder + QA + Reviewer + Deploy agents with the label-driven workflow
sketched there.

### PWA polish — S
Custom install prompt (the browser's default is easy to miss), dark mode
that respects `prefers-color-scheme`, single accent-color picker that
threads through the theme tokens. Smallest item with the biggest "feels
finished" payoff.

### i18n scaffolding — M
`next-intl` wiring + English strings extracted. Don't translate yet —
just make the day-one diff small for whoever adds the second language.

### Per-module offline queue — M
The service worker currently queues `POST /water` only. Extend the
IndexedDB queue and the server-side `(user_id, client_id)` idempotency
constraint to `food`, `activity`, `weight`, and `habit_checkins`. Useful
on patchy mobile data.

---

## Cross-cutting / tech debt

- **Test coverage backfill** — M. Activity, habits, weight, and
  integrations don't have the coverage water + food + auth do. Backfill
  to parity and add one Playwright e2e per module (today there's a single
  water smoke).
- **Schemathesis against `/openapi.json` in CI** — S. Cheap contract
  testing; catches drift the unit tests miss. Slot it into `ci.yml`.
- **Alembic downgrade smoke test in CI** — S. The deploy workflow
  already renders `alembic upgrade --sql`; add a downgrade-then-upgrade
  roundtrip on a throwaway DB. Catches non-reversible migrations before
  they ship.
- **Secrets rotation runbook** — S. Extend [`docs/runbook.md`](runbook.md)
  with step-by-step `JWT_SECRET` and `FERNET_KEY` rotation. The
  rotation-aware refresh logic is already in place; the docs aren't.
- **Frontend bundle audit** — S. `@mdi/js` is ~7,000 icons lazy-loaded
  per the architecture doc; verify the chunk-splitting is actually
  working in the production build and the install size isn't blowing
  past the PWA's reasonable cache budget.
- **Structured per-route telemetry** — S. `error_log` exists; add a
  thin `request_log` summary (count/p95/error-rate per route per day)
  for the operator dashboard. Avoids needing a full Prom stack for the
  single-container deploy target.

---

## Intentional non-goals

Listed so future contributors don't re-litigate them every quarter.

- **Multi-tenancy beyond the household.** No org / team accounts; the
  user model is "one Unraid box, ≤10 users."
- **SSO / SCIM.** Out of scope for self-hosted home use.
- **Native iOS/Android apps.** The PWA is the mobile story.
- **Public-internet leaderboards.** Household challenges yes;
  cross-instance social no.
- **Medical / coaching claims.** Macro targets and weight tracking only;
  no "you should eat X" prescriptions.
- **Operator-supplied Postgres replacement.** Keep BYO-postgres — bundling
  it would double the container surface area for no win.

---

## Suggested ordering rationale

If only one thing ships from "Now," ship **reminders** — every tracker app
lives or dies on whether the user remembers to open it. After that,
**trends + export** are the two complaints that show up in every
self-hosted-tracker issue tracker eventually; cheap to head off.

In "Next," **achievements** is the highest-leverage *product* move
(closes the brand gap); **Fitbit import** is the highest-leverage
*integration* move (unlocks the activity module for anyone who already
wears a tracker). Pick one based on whether the next sprint is feeling
more product-y or more plumbing-y.
