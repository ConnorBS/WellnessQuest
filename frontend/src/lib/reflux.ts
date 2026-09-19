import type { RefluxEntry, RefluxSeverity, RefluxTrigger } from "@/lib/schemas";

export const SEVERITY_META: Record<RefluxSeverity, { label: string; color: string }> = {
  mild: { label: "Mild", color: "#fbbf24" },
  moderate: { label: "Moderate", color: "#f97316" },
  severe: { label: "Severe", color: "#ef4444" },
};

export const SEVERITY_ORDER: RefluxSeverity[] = ["mild", "moderate", "severe"];

export const TRIGGER_LABELS: Record<RefluxTrigger, string> = {
  caffeine: "Coffee / caffeine",
  alcohol: "Alcohol",
  chocolate: "Chocolate",
  spicy: "Spicy food",
  fatty_fried: "Fatty / fried",
  citrus: "Citrus",
  tomato: "Tomato",
  carbonated: "Fizzy drinks",
  mint: "Mint",
  onion_garlic: "Onion / garlic",
  dairy: "Dairy",
  large_meal: "Large meal",
  late_meal: "Ate late / lay down after",
};

export const TRIGGER_ORDER: RefluxTrigger[] = [
  "caffeine",
  "alcohol",
  "chocolate",
  "spicy",
  "fatty_fried",
  "citrus",
  "tomato",
  "carbonated",
  "mint",
  "onion_garlic",
  "dairy",
  "large_meal",
  "late_meal",
];

export interface TriggerCount {
  trigger: RefluxTrigger;
  count: number;
  /** Share of episodes in the window that named this trigger, 0..1. */
  share: number;
}

/**
 * How often each trigger was ticked across the episodes in the last `days`
 * days, most frequent first. This is the whole point of the checklist: after a
 * few weeks the top of this list is the answer to "what should I cut out".
 * Computed client-side from the raw history, like BP categories.
 */
export function topTriggers(
  entries: RefluxEntry[],
  days = 30,
  now: Date = new Date(),
): TriggerCount[] {
  const cutoff = now.getTime() - days * 86_400_000;
  const recent = entries.filter((e) => new Date(e.occurred_at).getTime() >= cutoff);
  if (recent.length === 0) return [];
  const counts = new Map<RefluxTrigger, number>();
  for (const e of recent) {
    for (const t of e.triggers) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([trigger, count]) => ({ trigger, count, share: count / recent.length }))
    .sort((a, b) => b.count - a.count || a.trigger.localeCompare(b.trigger));
}

/** One line for a list row: "Moderate · Spicy food, Coffee / caffeine". */
export function describeEntry(entry: RefluxEntry): string {
  const parts = [SEVERITY_META[entry.severity].label];
  if (entry.triggers.length > 0) {
    parts.push(entry.triggers.map((t) => TRIGGER_LABELS[t]).join(", "));
  }
  return parts.join(" · ");
}
