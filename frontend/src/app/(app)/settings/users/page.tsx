"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMe } from "@/hooks/useMe";
import { apiDelete, apiFetch, apiPatch, apiPost, apiPostVoid } from "@/lib/api";
import { Me, MeListSchema, MeSchema } from "@/lib/schemas";

function generateTempPassword(): string {
  const alpha = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = alpha + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const out = [pick(alpha), pick(alpha), pick(digits), pick(symbols)];
  for (let i = out.length; i < 14; i++) out.push(pick(all));
  return out.sort(() => Math.random() - 0.5).join("");
}

export default function AdminUsersPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const qc = useQueryClient();

  const usersQuery = useQuery<Me[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/admin/users", MeListSchema),
    enabled: me?.role === "admin",
  });

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [password, setPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: () =>
      apiPost("/admin/users", MeSchema, {
        email,
        display_name: displayName,
        password,
        role,
      }),
    onSuccess: (user) => {
      setCreatedNotice(
        `Created ${user.email}. They must change the temporary password on first login.`,
      );
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("user");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: unknown) => {
      const detail = (err as { body?: { detail?: string } }).body?.detail;
      setCreateError(
        detail === "email_taken"
          ? "That email is already in use."
          : "Could not create user.",
      );
    },
  });

  const toggleDisabled = useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      apiPatch(`/admin/users/${id}`, MeSchema, { disabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role: nextRole }: { id: string; role: "admin" | "user" }) =>
      apiPatch(`/admin/users/${id}`, MeSchema, { role: nextRole }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const disableUser = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password: pw }: { id: string; password: string }) =>
      apiPostVoid(`/admin/users/${id}/reset-password`, { password: pw }),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreatedNotice(null);
    createUser.mutate();
  }

  if (meLoading) return <p style={{ color: "#94a3b8" }}>Loading…</p>;
  if (me?.role !== "admin") {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold">Users</h2>
        <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
          Only admins can manage users.
        </p>
      </section>
    );
  }

  const cellStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderBottom: "1px solid #1e293b",
    fontSize: 14,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 8,
    marginTop: 4,
    background: "#0f172a",
    border: "1px solid #334155",
    color: "inherit",
    borderRadius: 6,
  };

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Add user
        </h2>
        <form onSubmit={onCreate} style={{ display: "grid", gap: 10 }}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label>
            Display name
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin")}
              style={inputStyle}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Temporary password (the user is forced to change it on first login)
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setPassword(generateTempPassword())}
                style={{
                  padding: "8px 12px",
                  background: "#334155",
                  color: "white",
                  border: 0,
                  borderRadius: 6,
                }}
              >
                Generate
              </button>
            </div>
          </label>
          {createError && <p style={{ color: "#fca5a5", fontSize: 14 }}>{createError}</p>}
          {createdNotice && <p style={{ color: "#86efac", fontSize: 14 }}>{createdNotice}</p>}
          <button
            type="submit"
            disabled={createUser.isPending}
            style={{
              padding: "10px 14px",
              background: "#2563eb",
              color: "white",
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              justifySelf: "start",
            }}
          >
            {createUser.isPending ? "Creating..." : "Create user"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5" style={{ marginTop: 16 }}>
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Users
        </h2>
        {usersQuery.isLoading && <p style={{ color: "#94a3b8" }}>Loading…</p>}
        {usersQuery.data && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: 12 }}>
                  <th style={cellStyle}>Email</th>
                  <th style={cellStyle}>Name</th>
                  <th style={cellStyle}>Role</th>
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.map((u) => {
                  const isSelf = u.id === me.id;
                  const isDisabled = u.disabled;
                  const onReset = () => {
                    const pw = window.prompt(
                      `Set a new temporary password for ${u.email}. The user will be forced to change it on next login.`,
                      generateTempPassword(),
                    );
                    if (!pw || pw.length < 10) return;
                    resetPassword.mutate(
                      { id: u.id, password: pw },
                      {
                        onSuccess: () =>
                          window.alert(`Password reset. Share this with ${u.email}:\n\n${pw}`),
                        onError: () => window.alert("Could not reset password."),
                      },
                    );
                  };
                  return (
                    <tr key={u.id}>
                      <td style={cellStyle}>{u.email}</td>
                      <td style={cellStyle}>{u.display_name}</td>
                      <td style={cellStyle}>
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            changeRole.mutate({ id: u.id, role: e.target.value as "admin" | "user" })
                          }
                          style={{ background: "#0f172a", color: "inherit", border: "1px solid #334155", padding: "2px 6px", borderRadius: 4 }}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td style={cellStyle}>
                        {isDisabled
                          ? "disabled"
                          : u.must_change_password
                            ? "must change pw"
                            : "active"}
                      </td>
                      <td style={cellStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={onReset}
                            style={{ color: "#cbd5e1", fontSize: 13 }}
                          >
                            Reset password
                          </button>
                          {!isSelf && !isDisabled && (
                            <button
                              onClick={() => {
                                if (!window.confirm(`Disable ${u.email}? They will be signed out and unable to log in.`))
                                  return;
                                disableUser.mutate(u.id, {
                                  onError: (err: unknown) => {
                                    const detail = (err as { body?: { detail?: string } }).body?.detail;
                                    window.alert(detail === "last_admin"
                                      ? "Can't disable the only active admin."
                                      : "Could not disable user.");
                                  },
                                });
                              }}
                              style={{ color: "#fca5a5", fontSize: 13 }}
                            >
                              Disable
                            </button>
                          )}
                          {!isSelf && isDisabled && (
                            <button
                              onClick={() => toggleDisabled.mutate({ id: u.id, disabled: false })}
                              style={{ color: "#86efac", fontSize: 13 }}
                            >
                              Enable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
