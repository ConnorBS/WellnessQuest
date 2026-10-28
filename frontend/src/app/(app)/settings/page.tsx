"use client";

import Link from "next/link";

import { useMe } from "@/hooks/useMe";
import { useFeatures } from "@/hooks/useFeatures";

export default function SettingsPage() {
  const { data } = useMe();
  const { isEnabled } = useFeatures();

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Profile
        </h2>
        {data ? (
          <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6, fontSize: 14 }}>
            <dt style={{ color: "var(--wq-muted)" }}>Email</dt>
            <dd>{data.email}</dd>
            <dt style={{ color: "var(--wq-muted)" }}>Display name</dt>
            <dd>{data.display_name}</dd>
            <dt style={{ color: "var(--wq-muted)" }}>Timezone</dt>
            <dd>{data.timezone}</dd>
            <dt style={{ color: "var(--wq-muted)" }}>Role</dt>
            <dd>{data.role}</dd>
          </dl>
        ) : (
          <p style={{ color: "var(--wq-muted)" }}>Loading...</p>
        )}
      </section>

      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/settings/trackers">Trackers (enable / disable / order)</Link>
        <Link href="/settings/appearance">Appearance (colours &amp; sections)</Link>
        {isEnabled("water") && <Link href="/settings/water">Water goal &amp; presets</Link>}
        {isEnabled("food") && <Link href="/settings/food">Food ceiling &amp; quick foods</Link>}
        {isEnabled("activity") && (
          <Link href="/settings/activity">Activity goal &amp; presets</Link>
        )}
        {isEnabled("steps") && <Link href="/settings/steps">Steps goal</Link>}
        {isEnabled("sleep") && <Link href="/settings/sleep">Sleep goal</Link>}
        {isEnabled("habits") && <Link href="/settings/habits">Habits</Link>}
        <Link href="/settings/titles">Titles</Link>
        {isEnabled("weight") && <Link href="/settings/weight">Weight &amp; units</Link>}
        {isEnabled("blood_pressure") && (
          <Link href="/settings/blood-pressure">Blood pressure</Link>
        )}
        {isEnabled("pain") && <Link href="/settings/pain">Pain symptom list</Link>}
        {isEnabled("tiny_wins") && <Link href="/settings/tiny-wins">Tiny wins list</Link>}
        <Link href="/settings/tokens">Home Assistant tokens</Link>
        <Link href="/settings/integrations">Integrations</Link>
        <Link href="/change-password">Change password</Link>
        {data?.role === "admin" && <Link href="/settings/users">Users</Link>}
      </nav>
    </>
  );
}
