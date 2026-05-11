"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiPost } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { SignupOutSchema } from "@/lib/schemas";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = params.get("code");
    if (c) setCode(c);
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const out = await apiPost("/auth/signup", SignupOutSchema, {
        invite_code: code,
        email,
        password,
        display_name: displayName,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setTokens(out.tokens);
      router.replace("/dashboard");
    } catch (_err) {
      setError("Could not sign up. Check your invite code and try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 8,
    marginTop: 4,
    background: "#0f172a",
    border: "1px solid #334155",
    color: "inherit",
  };

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Sign up</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Invite code
          <input required value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Display name
          <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Password
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
        <button type="submit" disabled={busy} style={{ padding: "10px 14px", background: "#10b981", color: "#0b1220", border: 0, borderRadius: 8 }}>
          {busy ? "Signing up..." : "Create account"}
        </button>
      </form>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>Loading…</main>}>
      <SignupForm />
    </Suspense>
  );
}
