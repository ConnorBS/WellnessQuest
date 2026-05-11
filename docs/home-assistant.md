# Home Assistant integration

Two-way: HA reads totals/stats via REST sensors, posts buttons via `rest_command`, and receives webhooks from WellnessQuest on events like `water.goal_met`.

## 1. Issue a long-lived token

In WellnessQuest:

1. Settings → Tokens → "New token".
2. Name it (e.g. `HA Living Room`), pick scopes `water:read` + `water:write`.
3. Copy the `wq_ha_...` value **now** — it is shown only once.

## 2. Add it to HA secrets

Append to `secrets.yaml`:

```yaml
wq_ha_token: "wq_ha_REPLACE_ME"
```

## 3. Paste the configuration snippets

Copy `infra/home-assistant/configuration.snippet.yaml` into HA's `configuration.yaml`
(or split-file equivalent). Restart HA.

You now have:

- `sensor.wq_water_today` — today's total ml; attributes include `goal_ml`, `percent`.
- `sensor.wq_level` — current level; attributes include `xp_total` and `streaks`.
- Service `rest_command.wq_add_water` — call with `{ ml: 250 }` (or 500, 750).

## 4. Lovelace card

Copy `infra/home-assistant/lovelace.snippet.yaml` into your Lovelace dashboard. Adjust the `max:` on the gauge to your water goal.

## 5. Receive webhook events

In WellnessQuest:

1. Settings → Integrations → Add Home Assistant.
2. Base URL: e.g. `http://homeassistant.local:8123`.
3. HA webhook id: any unique-to-you string (e.g. `wq_events_4f1a`).
4. Subscribe event: start with `water.goal_met`.

In HA, paste `infra/home-assistant/automations.snippet.yaml` and replace `REPLACE_WITH_YOUR_WEBHOOK_ID` with the same id. Reload automations.

When you cross today's water goal, WellnessQuest POSTs to `{base_url}/api/webhook/{webhook_id}` with `{ event: "water.goal_met", goal_ml, total_ml, date }`. The automation fires a `notify.notify` (point this at your mobile_app_* device).

## Tips

- **Trust the Caddy internal CA on phones and HA** so `https://wellnessquest.lan` works without warnings. Otherwise use plain HTTP on the LAN by editing `infra/caddy/Caddyfile`.
- HA tokens are scoped: a `water:read`-only token cannot call `/ha/water/add` (the server returns 403). Issue narrow tokens per use case.
- Every HA call is audited (`audit_log.actor = "ha:<token_id>"`). Use Settings → Tokens to revoke when you rotate.
