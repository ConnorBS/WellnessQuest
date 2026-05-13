"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, apiPost } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { MeSchema, SetupStatusSchema, TokenPairSchema } from "@/lib/schemas";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/setup/status", SetupStatusSchema, { skipAuth: true })
      .then((s) => {
        if (!cancelled && s.setup_required) router.replace("/setup");
      })
      .catch(() => {
        /* fall through — let the user try to log in anyway */
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
      const tokens = await apiPost("/auth/login", TokenPairSchema, { email, password });
      setTokens(tokens);
      const me = await apiFetch("/me", MeSchema);
      router.replace(me.must_change_password ? "/change-password" : "/dashboard");
    } catch {
      setError("Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>WellnessQuest</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4, background: "#0f172a", border: "1px solid #334155", color: "inherit" }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4, background: "#0f172a", border: "1px solid #334155", color: "inherit" }}
          />
        </label>
        {error && <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: "10px 14px", background: "#10b981", color: "#0b1220", border: 0, borderRadius: 8 }}
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
