import type { Habit, HabitWithStatus } from "@/lib/schemas";

export type HabitBucketKey = "today" | "week" | "month";

export interface HabitBucket {
  key: HabitBucketKey;
  label: string;
  items: HabitWithStatus[];
}

function bucketFor(h: Habit): HabitBucketKey {
  if (h.cadence_kind === "daily") return "today";
  if (h.cadence_kind === "weekly") return "week";
  if (h.cadence_kind === "monthly") return "month";
  const k = h.interval_days ?? 7;
  if (k < 7) return "today";
  if (k < 28) return "week";
  return "month";
}

export function groupHabits(items: HabitWithStatus[]): HabitBucket[] {
  const buckets: Record<HabitBucketKey, HabitWithStatus[]> = {
    today: [],
    week: [],
    month: [],
  };
  for (const item of items) {
    buckets[bucketFor(item.habit)].push(item);
  }
  for (const key of Object.keys(buckets) as HabitBucketKey[]) {
    buckets[key].sort((a, b) => a.habit.sort_order - b.habit.sort_order);
  }
  return [
    { key: "today", label: "Today", items: buckets.today },
    { key: "week", label: "This week", items: buckets.week },
    { key: "month", label: "This month", items: buckets.month },
  ];
}
