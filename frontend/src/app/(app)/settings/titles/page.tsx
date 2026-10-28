"use client";

import { useMemo, useState } from "react";

import { useMe } from "@/hooks/useMe";
import {
  LockFilter,
  useEquipTitle,
  useTitleCategories,
  useTitlesInCategory,
} from "@/hooks/useTitles";
import { useUpdateMe } from "@/hooks/useUpdateMe";
import { Title } from "@/lib/schemas";

const RARITY_COLORS: Record<string, string> = {
  common: "var(--wq-muted)",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#fbbf24",
};

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  lifetime_water: "Lifetime Water",
  lifetime_activity: "Lifetime Activity",
  streak_water: "Water Streaks",
  streak_activity: "Activity Streaks",
  login_days: "Login Days",
  active_days: "Active Days",
  exercise_type: "Exercise Types",
  weight_milestone: "Weight Milestones",
  bp_milestone: "Blood Pressure",
  entry_count: "Entries Logged",
  habit: "Habits",
  food: "Food",
  time_of_day: "Time of Day",
  composite: "Composite",
  secret: "Secret",
  level: "Level",
};

function labelForCategory(slug: string): string {
  return CATEGORY_LABELS[slug] ?? slug.replace(/_/g, " ");
}

function TitleRow({
  title,
  equipped,
  onEquip,
}: {
  title: Title;
  equipped: boolean;
  onEquip: () => void;
}) {
  const color = RARITY_COLORS[title.rarity] ?? "var(--wq-text-2)";
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid var(--wq-surface-2)",
        gap: 12,
        opacity: title.unlocked ? 1 : 0.55,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color, fontWeight: 600 }}>{title.name}</span>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--wq-muted-2)",
            }}
          >
            {title.rarity}
          </span>
        </div>
        {title.description && (
          <div style={{ fontSize: 12, color: "var(--wq-muted)", marginTop: 2 }}>
            {title.description}
          </div>
        )}
        {!title.unlocked && (
          <div style={{ fontSize: 12, color: "var(--wq-muted-2)", marginTop: 2 }}>Locked</div>
        )}
      </div>
      {title.unlocked && (
        <button
          type="button"
          onClick={onEquip}
          disabled={equipped}
          style={{
            padding: "6px 12px",
            background: equipped ? "transparent" : "var(--wq-accent)",
            color: equipped ? "var(--wq-muted)" : "#0b1220",
            border: equipped ? "1px solid var(--wq-border)" : 0,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: equipped ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {equipped ? "Equipped" : "Equip"}
        </button>
      )}
    </li>
  );
}

export default function TitlesPage() {
  const { data: me } = useMe();
  const categories = useTitleCategories();
  const [active, setActive] = useState<string | null>(null);
  const [lockFilter, setLockFilter] = useState<LockFilter>("all");
  const equipMutation = useEquipTitle();
  const updateMe = useUpdateMe();

  // Default to the first non-empty category once the list arrives.
  const effectiveCategory = useMemo(() => {
    if (active != null) return active;
    return categories.data?.[0]?.category ?? null;
  }, [active, categories.data]);

  const titles = useTitlesInCategory(effectiveCategory, lockFilter);

  if (!me) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Equipped title
        </h2>
        {me.equipped_title ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: RARITY_COLORS[me.equipped_title.rarity] ?? "var(--wq-text-2)", fontWeight: 600 }}>
                {me.equipped_title.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--wq-muted-2)", textTransform: "uppercase", letterSpacing: 1 }}>
                {me.equipped_title.rarity}
              </div>
            </div>
            <button
              type="button"
              onClick={() => equipMutation.mutate(null)}
              disabled={equipMutation.isPending}
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: "var(--wq-muted)",
                border: "1px solid var(--wq-border)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              Unequip
            </button>
          </div>
        ) : (
          <p style={{ color: "var(--wq-muted)", margin: 0 }}>None equipped.</p>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={me.title_hidden}
            disabled={updateMe.isPending}
            onChange={(e) => updateMe.mutate({ title_hidden: e.target.checked })}
          />
          Hide title from the XP bar
        </label>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Browse
        </h2>
        {categories.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading categories…</p>
        ) : !categories.data || categories.data.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>
            No titles in the catalog yet. Check back after the next deploy.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {categories.data.map((c) => {
                const isActive = c.category === effectiveCategory;
                return (
                  <button
                    key={c.category}
                    type="button"
                    onClick={() => setActive(c.category)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      background: isActive ? "#1e40af" : "transparent",
                      color: isActive ? "var(--wq-text)" : "var(--wq-muted)",
                      border: `1px solid ${isActive ? "#3b82f6" : "var(--wq-border)"}`,
                      cursor: "pointer",
                    }}
                  >
                    {labelForCategory(c.category)}{" "}
                    <span style={{ opacity: 0.7 }}>
                      {c.unlocked}/{c.total}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              role="tablist"
              aria-label="Filter by lock state"
              style={{ display: "flex", gap: 6, marginBottom: 12 }}
            >
              {(
                [
                  { key: "all", label: "All" },
                  { key: "unlocked", label: "Unlocked" },
                  { key: "locked", label: "Locked" },
                ] as { key: LockFilter; label: string }[]
              ).map((opt) => {
                const isActive = lockFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setLockFilter(opt.key)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      fontSize: 12,
                      background: isActive ? "var(--wq-surface)" : "transparent",
                      color: isActive ? "var(--wq-text)" : "var(--wq-muted)",
                      border: `1px solid ${isActive ? "var(--wq-border-strong)" : "var(--wq-surface-2)"}`,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {titles.isLoading ? (
              <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
            ) : !titles.data || titles.data.length === 0 ? (
              <p style={{ color: "var(--wq-muted)" }}>
                {lockFilter === "unlocked"
                  ? "Nothing unlocked here yet."
                  : lockFilter === "locked"
                  ? "Everything here is unlocked!"
                  : "Nothing here."}
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {titles.data.map((t) => (
                  <TitleRow
                    key={t.id}
                    title={t}
                    equipped={me.equipped_title?.id === t.id}
                    onEquip={() => equipMutation.mutate(t.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
