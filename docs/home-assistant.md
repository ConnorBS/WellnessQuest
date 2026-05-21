# Home Assistant integration

Bidirectional sync with Home Assistant:

- **Inbound (HA → WQ)**: WellnessQuest can either *pull* selected HA entities on
  an interval (steps from your phone/wearable, sleep duration from a CPAP
  integration) or accept *push* writes from HA automations.
- **Outbound (WQ → HA)**: HA polls WQ REST endpoints for current totals and
  receives webhook callbacks on milestones (water goal met, daily step target
  hit, sleep session logged, etc).

## 0. Prerequisites

- `FERNET_KEY` is required and must be a valid 32-byte url-safe base64 Fernet
  key. Generate with `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`. The HA long-lived access token is
  encrypted at rest with this key.

## 1. Issue a WQ token (HA → WQ push + REST sensors)

In WellnessQuest:

1. Settings → Tokens → "New token".
2. Name it (e.g. `HA Living Room`).
3. Pick scopes you need. Common combos:
   - **Read-only dashboards in HA**: `me:read`.
   - **Push water/steps/sleep from HA automations**: add `water:write`,
     `steps:write`, `sleep:write` as needed.
4. Copy the `wq_ha_...` value **now** — it is shown only once.

The available scopes:

| Scope | Grants |
| --- | --- |
| `water:read` | GET `/api/v1/ha/water/today` |
| `water:write` | POST `/api/v1/ha/water/add` |
| `steps:read` | GET `/api/v1/ha/steps/today` |
| `steps:write` | POST `/api/v1/ha/steps/add` |
| `sleep:read` | GET `/api/v1/ha/sleep/last` |
| `sleep:write` | POST `/api/v1/ha/sleep/add` |
| `me:read` | GET `/api/v1/ha/me/stats` (consolidated rollup of all metrics) |

## 2. Connect WQ → HA pull (recommended)

This is the simplest way to import steps/sleep without writing any HA
automations.

1. In HA → your profile → Security → **Long-Lived Access Tokens** → create a
   new token. Copy it.
2. In WellnessQuest → Settings → Integrations → **Add Home Assistant**.
   - Base URL, e.g. `http://homeassistant.local:8123`
   - HA webhook id (used for outbound milestone events — invent one, e.g.
     `wq_events_4f1a`)
   - HA long-lived access token (pasted from step 1; encrypted with
     `FERNET_KEY` before storage)
   - Entity map:
     - **Steps**: e.g. `sensor.steps_today` (cumulative daily counter from a
       phone integration like Home Assistant Companion).
     - **Sleep duration (minutes)**: e.g. `sensor.cpap_sleep_duration` from a
       CPAP / OSCAR integration.
     - **Sleep quality (0–100, optional)**: e.g. `sensor.cpap_score`.
   - Pull interval (seconds): default 300, min 60, max 3600.

WellnessQuest will poll those entities on the configured interval and append
delta-encoded rows to `steps_entries` / `sleep_entries` with `source='ha_pull'`.
Re-polling the same state value is a no-op (idempotent via `client_id =
ha:<entity>:<last_changed>`).

If a poll returns HTTP 401/403, the integration is automatically disabled —
re-save it in the UI with a fresh token to re-enable.

## 3. HA → WQ push (alternative)

For more control, you can write HA automations that POST directly to WQ
endpoints. Use the `wq_ha_...` token from step 1 in the `X-WQ-Token` header.

```yaml
rest_command:
  wq_add_steps:
    url: "http://wellnessquest.lan:8000/api/v1/ha/steps/add"
    method: post
    headers:
      X-WQ-Token: !secret wq_ha_token
      Content-Type: application/json
    payload: '{"count": {{ count }}, "client_id": "ha-{{ now().isoformat() }}"}'
```

## 4. WQ → HA REST sensors

The existing patterns in `infra/home-assistant/configuration.snippet.yaml` work
unchanged. For the new metrics, add sensors against `/api/v1/ha/me/stats`
(needs `me:read` scope), e.g.:

```yaml
rest:
  - resource: "http://wellnessquest.lan:8000/api/v1/ha/me/stats"
    headers:
      X-WQ-Token: !secret wq_ha_token
    scan_interval: 60
    sensor:
      - name: "WQ Steps Today"
        value_template: "{{ value_json.steps_today.total }}"
        unit_of_measurement: "steps"
        json_attributes_path: "$.steps_today"
        json_attributes: [goal, percent]
      - name: "WQ Sleep Last Night"
        value_template: >-
          {{ value_json.sleep_last_night.duration_minutes
             if value_json.sleep_last_night else None }}
        unit_of_measurement: "min"
        json_attributes_path: "$.sleep_last_night"
        json_attributes: [quality_score, ended_at, goal_met]
```

## 5. WQ → HA webhook events

In the integration form (step 2), pick which events you want WQ to fire as
webhooks. Available events:

| Event | Fired when | Payload |
| --- | --- | --- |
| `water.goal_met` | first water entry that crosses today's goal | `goal_ml`, `total_ml`, `date` |
| `activity.goal_met` | first activity entry that crosses today's goal | `goal_minutes`, `total_minutes`, `date` |
| `food.target_exceeded` | first food entry that crosses today's kcal ceiling | `kcal`, `target_kcal`, `date` |
| `steps.daily_goal_met` | first steps delta that crosses today's step goal | `count`, `goal`, `date` |
| `sleep.session_logged` | every time a sleep session is recorded | `duration_minutes`, `quality_score`, `goal_met`, `goal_minutes`, `ended_at` |

WQ POSTs to `{base_url}/api/webhook/{webhook_id}` with `{event, ...payload}`.
HA automations trigger on `webhook` with that id.

## 6. Tips

- **Token rotation**: revoke WQ tokens in Settings → Tokens; revoke HA tokens
  in HA's profile. The WQ secrets table re-encrypts on next write, so rotating
  `FERNET_KEY` requires re-saving every integration (no built-in re-key tool
  yet).
- **Audit trail**: every HA-sourced write (pull or push) is recorded in
  `audit_log` with `actor = "ha:<token_id>"` or `actor = "ha_pull:<integration_id>"`.
- **Disabled tokens**: a 401 from HA during a pull marks the integration
  `enabled = False` automatically; re-save in the UI to re-enable.
- **Step counter resets**: phone step sensors typically reset at midnight in
  the device's local timezone. WQ detects a backward jump and treats the new
  value as today's accumulator (rather than writing a negative delta).
