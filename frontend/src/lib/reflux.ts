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

// How much a tick counts for, by how bad the episode was. A trigger that keeps
// showing up on severe episodes should outrank one that only ever precedes a
// mild one, even at equal frequency.
export const SEVERITY_WEIGHT: Record<RefluxSeverity, number> = {
  mild: 1,
  moderate: 2,
  severe: 3,
};

export interface TriggerCount {
  trigger: RefluxTrigger;
  /** Episodes in the window that named this trigger. */
  count: number;
  /** Sum of SEVERITY_WEIGHT over those episodes — what the ranking sorts on. */
  score: number;
  /** Mean severity when this trigger was in play, on the 1..3 weight scale. */
  avgSeverity: number;
  /** The severity bucket `avgSeverity` rounds to, for the label and colour. */
  typicalSeverity: RefluxSeverity;
  /** `score` relative to the top trigger's, 0..1 — the bar width. */
  share: number;
}

/** Nearest severity for a mean weight: <1.5 mild, <2.5 moderate, else severe. */
export function severityForWeight(avg: number): RefluxSeverity {
  if (avg < 1.5) return "mild";
  if (avg < 2.5) return "moderate";
  return "severe";
}

/**
 * Rank the triggers ticked across the episodes in the last `days` days by
 * frequency weighted by severity. This is the whole point of the checklist:
 * after a few weeks the top of this list is the answer to "what should I cut
 * out" — and a trigger behind one severe episode belongs above one behind a
 * single mild episode, which a plain tick count can't say.
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
  const acc = new Map<RefluxTrigger, { count: number; score: number }>();
  for (const e of recent) {
    const weight = SEVERITY_WEIGHT[e.severity];
    for (const t of e.triggers) {
      const cur = acc.get(t) ?? { count: 0, score: 0 };
      acc.set(t, { count: cur.count + 1, score: cur.score + weight });
    }
  }
  const maxScore = Math.max(0, ...[...acc.values()].map((v) => v.score));
  return [...acc.entries()]
    .map(([trigger, { count, score }]) => {
      const avgSeverity = score / count;
      return {
        trigger,
        count,
        score,
        avgSeverity,
        typicalSeverity: severityForWeight(avgSeverity),
        share: maxScore > 0 ? score / maxScore : 0,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.count - a.count || a.trigger.localeCompare(b.trigger),
    );
}

/** One line for a list row: "Moderate · Spicy food, Coffee / caffeine". */
export function describeEntry(entry: RefluxEntry): string {
  const parts = [SEVERITY_META[entry.severity].label];
  if (entry.triggers.length > 0) {
    parts.push(entry.triggers.map((t) => TRIGGER_LABELS[t]).join(", "));
  }
  return parts.join(" · ");
}
