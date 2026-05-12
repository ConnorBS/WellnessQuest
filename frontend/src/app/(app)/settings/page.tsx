"use client";

import Link from "next/link";

import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";

export default function SettingsPage() {
  const { data } = useMe();
  const updateMe = useUpdateMe();

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Profile
        </h2>
        {data ? (
          <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6, fontSize: 14 }}>
            <dt style={{ color: "#94a3b8" }}>Email</dt>
            <dd>{data.email}</dd>
            <dt style={{ color: "#94a3b8" }}>Display name</dt>
            <dd>{data.display_name}</dd>
            <dt style={{ color: "#94a3b8" }}>Timezone</dt>
            <dd>{data.timezone}</dd>
            <dt style={{ color: "#94a3b8" }}>Role</dt>
            <dd>{data.role}</dd>
          </dl>
        ) : (
          <p style={{ color: "#94a3b8" }}>Loading...</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Dashboard &amp; units
        </h2>
        {data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={data.show_weight_card}
                disabled={updateMe.isPending}
                onChange={(e) => updateMe.mutate({ show_weight_card: e.target.checked })}
              />
              Show Weight card on Dashboard
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <span style={{ minWidth: 100 }}>Weight unit</span>
              <select
                value={data.weight_unit}
                disabled={updateMe.isPending}
                onChange={(e) =>
                  updateMe.mutate({ weight_unit: e.target.value as "kg" | "lb" })
                }
                style={{ minWidth: 100 }}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </select>
            </label>
            <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>
              Weight entries are stored as kg internally; this only changes how they're shown.
            </p>
          </div>
        ) : (
          <p style={{ color: "#94a3b8" }}>Loading...</p>
        )}
      </section>

      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/settings/water">Water goal &amp; presets</Link>
        <Link href="/settings/activity">Activity goal &amp; presets</Link>
        <Link href="/settings/habits">Habits</Link>
        <Link href="/settings/tokens">Home Assistant tokens</Link>
        <Link href="/settings/integrations">Integrations</Link>
      </nav>
    </>
  );
}
