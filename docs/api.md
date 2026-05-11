# API reference (slice 1)

All routes are under `/api/v1`. JSON only.

- **User routes**: `Authorization: Bearer <access_jwt>`. Access tokens expire after 15 minutes; refresh via `/auth/refresh`.
- **HA routes**: `X-WQ-Token: wq_ha_...`. Scope-gated. Issued from the UI (Settings → Tokens), shown exactly once.

Live OpenAPI docs at `/docs` (Swagger) and `/openapi.json`.

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/signup` | `{ invite_code, email, password, display_name, timezone? }` | `{ user, tokens }` |
| POST | `/auth/login` | `{ email, password }` | `TokenPair` |
| POST | `/auth/refresh` | `{ refresh_token }` | `TokenPair` (rotated) |
| POST | `/auth/logout` | `{ refresh_token }` | 204 |

`TokenPair`: `{ access_token, refresh_token, access_expires_at, token_type }`.

## Me

| Method | Path | Returns |
|---|---|---|
| GET | `/me` | `MeOut { id, email, display_name, role, xp_total, level, timezone }` |

## Water

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/water/today` | — | `{ date, total_ml, goal_ml, percent, entries[] }` |
| POST | `/water` | `{ ml, client_id?, occurred_at? }` | `{ entry, total_ml, goal_ml, xp_delta, goal_met }` |
| DELETE | `/water/{id}` | — | 204 |

Idempotency: when `client_id` is provided, the same `(user_id, client_id)` pair is unique. Re-POSTing the same `client_id` returns the existing row with `xp_delta: 0`.

## API tokens (HA)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api-tokens` | `{ name, scopes? }` | `{ id, name, scopes, token, created_at }` — `token` shown once |
| GET | `/api-tokens` | — | `[{ id, name, scopes, last_used_at, created_at, revoked_at }]` |
| DELETE | `/api-tokens/{id}` | — | 204 (revokes) |

Allowed scopes (slice 1): `water:read`, `water:write`.

## Integrations + webhooks

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/integrations/kinds` | — | `{ channels: [{kind, label}] }` |
| POST | `/integrations` | `{ kind, name, config, secrets? }` | `IntegrationOut` |
| GET | `/integrations` | — | `IntegrationOut[]` |
| DELETE | `/integrations/{id}` | — | 204 |
| POST | `/integrations/{id}/webhooks` | `{ event, url }` | `WebhookSubscriptionOut` |
| GET | `/integrations/{id}/webhooks` | — | `WebhookSubscriptionOut[]` |
| DELETE | `/integrations/{id}/webhooks/{sub_id}` | — | 204 |

Events emitted (slice 1): `water.goal_met`.

## Home Assistant–facing

Header: `X-WQ-Token: wq_ha_...`. Rate-limited.

| Method | Path | Scope | Body | Returns |
|---|---|---|---|---|
| POST | `/ha/water/add` | `water:write` | `{ ml, client_id? }` | `WaterAddOut` |
| GET | `/ha/water/today` | `water:read` | — | `WaterTodayOut` (entries omitted) |
| GET | `/ha/me/stats` | `water:read` | — | `{ xp_total, level, streaks }` |

## Telemetry

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/telemetry/events` | `{ events: [{ level, message, stack?, context }] }` (≤ 100) | `{ accepted }` |

## Admin

Requires `role: admin`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/admin/invites` | `{ email?, ttl_hours? }` | `{ code, expires_at }` |
| GET | `/admin/users` | — | `MeOut[]` |

## Meta

- `GET /api/v1/healthz` → `{ status: "ok" }`
