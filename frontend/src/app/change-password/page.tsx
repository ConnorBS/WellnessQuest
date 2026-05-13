"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, apiPost } from "@/lib/api";
import { isLoggedIn, setTokens } from "@/lib/auth";
import { MeSchema, TokenPairSchema } from "@/lib/schemas";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mustChange, setMustChange] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    apiFetch("/me", MeSchema)
      .then((me) => {
        if (!cancelled) setMustChange(me.must_change_password);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (current === next) {
      setError("New password must differ from your current password.");
      return;
    }
    setBusy(true);
    try {
      const tokens = await apiPost("/auth/change-password", TokenPairSchema, {
        current_password: current,
        new_password: next,
      });
      setTokens(tokens);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const detail = (err as { body?: { detail?: string } }).body?.detail;
      if (detail === "invalid_credentials") setError("Current password is incorrect.");
      else if (detail === "password_unchanged") setError("New password must differ from your current password.");
      else setError("Could not change password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (mustChange === null) return null;

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
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Change password</h1>
      {mustChange && (
        <p style={{ color: "#fbbf24", fontSize: 14, marginBottom: 16 }}>
          Your administrator set a temporary password. Choose a new one to continue.
        </p>
      )}
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label>
          Current password
          <input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            required
            minLength={10}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            required
            minLength={10}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
