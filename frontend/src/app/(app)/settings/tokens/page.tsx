"use client";

import { FormEvent, useEffect, useState } from "react";
import { z } from "zod";

import { apiDelete, apiFetch, apiPost } from "@/lib/api";

const TokenOut = z.object({
  id: z.string().uuid(),
  name: z.string(),
  scopes: z.array(z.string()),
  last_used_at: z.string().nullable(),
  created_at: z.string(),
  revoked_at: z.string().nullable(),
});
const TokenList = z.array(TokenOut);
const TokenCreated = TokenOut.extend({ token: z.string() });
type Token = z.infer<typeof TokenOut>;

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["water:read", "water:write"]);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await apiFetch("/api-tokens", TokenList);
      setTokens(rows);
    } catch (_e) {
      setError("Could not load tokens");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await apiPost("/api-tokens", TokenCreated, { name, scopes });
      setJustCreated(created.token);
      setName("");
      await load();
    } catch (_e) {
      setError("Could not create token");
    }
  }

  async function onRevoke(id: string) {
    await apiDelete(`/api-tokens/${id}`);
    await load();
  }

  async function onRemove(id: string) {
    await apiDelete(`/api-tokens/${id}?hard=true`);
    await load();
  }

  function toggleScope(s: string) {
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          New Home Assistant token
        </h2>
        <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Name (e.g. HA Living Room)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: 8, background: "#0f172a", border: "1px solid #334155", color: "inherit" }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
              fontSize: 14,
            }}
          >
            {[
              "water:read",
              "water:write",
              "steps:read",
              "steps:write",
              "sleep:read",
              "sleep:write",
              "me:read",
            ].map((s) => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                {s}
              </label>
            ))}
          </div>
          <button
            type="submit"
            style={{ padding: "8px 12px", background: "#10b981", color: "#0b1220", border: 0, borderRadius: 8 }}
          >
            Create
          </button>
        </form>
        {justCreated && (
          <div style={{ marginTop: 12, padding: 10, border: "1px solid #10b981", borderRadius: 8 }}>
            <p style={{ marginTop: 0 }}>
              Copy this token now — it will not be shown again:
            </p>
            <code style={{ wordBreak: "break-all", display: "block", background: "#020617", padding: 8 }}>
              {justCreated}
            </code>
          </div>
        )}
        {error && <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Existing tokens
        </h2>
        {tokens.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No tokens yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {tokens.map((t) => (
              <li key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {t.name} <span style={{ color: "#94a3b8", fontSize: 12 }}>· {t.scopes.join(", ")}</span>
                </span>
                {t.revoked_at ? (
                  <button
                    onClick={() => onRemove(t.id)}
                    style={{ background: "transparent", color: "#94a3b8", border: 0 }}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => onRevoke(t.id)}
                    style={{ background: "transparent", color: "#fca5a5", border: 0 }}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
