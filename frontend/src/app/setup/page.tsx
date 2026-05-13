"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, apiPost } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { AuthOutSchema, SetupStatusSchema } from "@/lib/schemas";

export default function SetupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/setup/status", SetupStatusSchema, { skipAuth: true })
      .then((s) => {
        if (cancelled) return;
        if (!s.setup_required) router.replace("/login");
        else setChecked(true);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const out = await apiPost("/setup/admin", AuthOutSchema, {
        email,
        password,
        display_name: displayName,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setTokens(out.tokens);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const detail = (err as { body?: { detail?: string } }).body?.detail;
      if (detail === "setup_already_complete") {
        router.replace("/login");
        return;
      }
      if (detail === "email_taken") setError("That email is already taken.");
      else setError("Could not create the admin account. Check the form and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 10,
    marginTop: 4,
    background: "#0f172a",
    border: "1px solid #334155",
    color: "inherit",
    borderRadius: 8,
  };

  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Welcome!</h1>
      <p style={{ color: "#94a3b8", marginBottom: 24, fontSize: 14 }}>
        Get started by creating your admin account.
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label>
          Full name
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Email address
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        {error && <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "12px 14px",
            background: "#2563eb",
            color: "white",
            border: 0,
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </form>
    </main>
  );
}
