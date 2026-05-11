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
const KindsOut = z.object({ channels: z.array(z.object({ kind: z.string(), label: z.string() })) });
const SubOut = z.object({
  id: z.string().uuid(),
  integration_id: z.string().uuid(),
  event: z.string(),
  url: z.string(),
  active: z.boolean(),
});

type Integration = z.infer<typeof IntegrationOut>;

export default function IntegrationsPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [kind, setKind] = useState("home_assistant");
  const [name, setName] = useState("Home Assistant");
  const [baseUrl, setBaseUrl] = useState("http://homeassistant.local:8123");
  const [webhookId, setWebhookId] = useState("");
  const [subEvent, setSubEvent] = useState("water.goal_met");
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await apiPost("/integrations", IntegrationOut, {
        kind,
        name,
        config: { base_url: baseUrl, webhook_id: webhookId },
        secrets: {},
      });
      await apiPost(`/integrations/${created.id}/webhooks`, SubOut, {
        event: subEvent,
        url: `${baseUrl}/api/webhook/${webhookId}`,
      });
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
        <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label>
            Base URL
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label>
            HA webhook id
            <input value={webhookId} onChange={(e) => setWebhookId(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label>
            Subscribe event
            <input value={subEvent} onChange={(e) => setSubEvent(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <button type="submit" style={{ padding: "8px 12px", background: "#10b981", color: "#0b1220", border: 0, borderRadius: 8 }}>
            Save
          </button>
        </form>
        {error && <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Configured
        </h2>
        {items.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>None yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((i) => (
              <li key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {i.name} <span style={{ color: "#94a3b8", fontSize: 12 }}>· {i.kind}</span>
                </span>
                <button onClick={() => onDelete(i.id)} style={{ background: "transparent", color: "#fca5a5", border: 0 }}>
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
