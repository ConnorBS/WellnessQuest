"use client";

import { FormEvent, useEffect, useState } from "react";
import { z } from "zod";

import { apiDelete, apiFetch, apiPost } from "@/lib/api";

const IntegrationOut = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  name: z.string(),
  config: z.record(z.unknown()),
  enabled: z.boolean(),
  created_at: z.string(),
});
const IntegrationList = z.array(IntegrationOut);
const KindsOut = z.object({
  channels: z.array(z.object({ kind: z.string(), label: z.string() })),
});
const SubOut = z.object({
  id: z.string().uuid(),
  integration_id: z.string().uuid(),
  event: z.string(),
  url: z.string(),
  active: z.boolean(),
});

type Integration = z.infer<typeof IntegrationOut>;

const DEFAULT_EVENTS = [
  "water.goal_met",
  "activity.goal_met",
  "food.target_exceeded",
  "steps.daily_goal_met",
  "sleep.session_logged",
];

export default function IntegrationsPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [kind, setKind] = useState("home_assistant");
  const [name, setName] = useState("Home Assistant");
  const [baseUrl, setBaseUrl] = useState("http://homeassistant.local:8123");
  const [webhookId, setWebhookId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [stepsEntity, setStepsEntity] = useState("");
  const [sleepMinutesEntity, setSleepMinutesEntity] = useState("");
  const [sleepQualityEntity, setSleepQualityEntity] = useState("");
  const [pullInterval, setPullInterval] = useState(300);
  const [subscribedEvents, setSubscribedEvents] = useState<string[]>([
    "water.goal_met",
    "steps.daily_goal_met",
    "sleep.session_logged",
  ]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const k = await apiFetch("/integrations/kinds", KindsOut);
      setKinds(k.channels.map((c) => c.kind));
      const rows = await apiFetch("/integrations", IntegrationList);
      setItems(rows);
    } catch (_e) {
      setError("Could not load integrations");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleEvent(ev: string) {
    setSubscribedEvents((cur) =>
      cur.includes(ev) ? cur.filter((x) => x !== ev) : [...cur, ev],
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const config: Record<string, unknown> = {
        base_url: baseUrl,
        webhook_id: webhookId,
        pull_interval_seconds: pullInterval,
        entity_map: {
          steps: stepsEntity || null,
          sleep_minutes: sleepMinutesEntity || null,
          sleep_quality: sleepQualityEntity || null,
        },
      };
      const secrets: Record<string, unknown> = {};
      if (accessToken) secrets.access_token = accessToken;

      const created = await apiPost("/integrations", IntegrationOut, {
        kind,
        name,
        config,
        secrets,
      });
      for (const ev of subscribedEvents) {
        await apiPost(`/integrations/${created.id}/webhooks`, SubOut, {
          event: ev,
          url: `${baseUrl.replace(/\/$/, "")}/api/webhook/${webhookId}`,
        });
      }
      setAccessToken("");
      await load();
    } catch (_e) {
      setError("Could not create integration");
    }
  }

  async function onDelete(id: string) {
    await apiDelete(`/integrations/${id}`);
    await load();
  }

  const inputStyle: React.CSSProperties = {
    padding: 8,
    background: "#0f172a",
    border: "1px solid #334155",
    color: "inherit",
  };

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Add Home Assistant
        </h2>
        <p className="text-sm text-slate-400" style={{ marginBottom: 12 }}>
          WellnessQuest will pull entity state from your HA instance on the
          interval below, and post webhook events back to it when milestones are
          hit. The access token is encrypted at rest.
        </p>
        <form
          onSubmit={onCreate}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <label>
            Kind
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
          <label>
            Base URL
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
          <label>
            HA webhook id (for outbound milestone events)
            <input
              value={webhookId}
              onChange={(e) => setWebhookId(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
          <label>
            HA long-lived access token (for inbound pull). HA → Profile →
            Security → Long-Lived Access Tokens.
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="eyJhbGciOiJI..."
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
          <fieldset
            style={{
              border: "1px solid #334155",
              borderRadius: 8,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <legend style={{ fontSize: 13, color: "#94a3b8" }}>
              Entities to import (leave blank to skip)
            </legend>
            <label>
              Steps entity (e.g. sensor.steps_today)
              <input
                value={stepsEntity}
                onChange={(e) => setStepsEntity(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </label>
            <label>
              Sleep duration entity (minutes, e.g.
              sensor.cpap_sleep_duration)
              <input
                value={sleepMinutesEntity}
                onChange={(e) => setSleepMinutesEntity(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </label>
            <label>
              Sleep quality entity (0-100, optional)
              <input
                value={sleepQualityEntity}
                onChange={(e) => setSleepQualityEntity(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </label>
          </fieldset>
          <label>
            Pull interval (seconds)
            <input
              type="number"
              min={60}
              max={3600}
              value={pullInterval}
              onChange={(e) =>
                setPullInterval(Math.max(60, Math.min(3600, Number(e.target.value) || 300)))
              }
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
          <fieldset
            style={{
              border: "1px solid #334155",
              borderRadius: 8,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <legend style={{ fontSize: 13, color: "#94a3b8" }}>
              Outbound webhook events
            </legend>
            {DEFAULT_EVENTS.map((ev) => (
              <label key={ev} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={subscribedEvents.includes(ev)}
                  onChange={() => toggleEvent(ev)}
                />
                {ev}
              </label>
            ))}
          </fieldset>
          <button
            type="submit"
            style={{
              padding: "8px 12px",
              background: "#10b981",
              color: "#0b1220",
              border: 0,
              borderRadius: 8,
            }}
          >
            Save
          </button>
        </form>
        {error && (
          <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Configured
        </h2>
        {items.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>None yet.</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {items.map((i) => (
              <li
                key={i.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {i.name}{" "}
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    · {i.kind} {i.enabled ? "" : "(disabled)"}
                  </span>
                </span>
                <button
                  onClick={() => onDelete(i.id)}
                  style={{ background: "transparent", color: "#fca5a5", border: 0 }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
