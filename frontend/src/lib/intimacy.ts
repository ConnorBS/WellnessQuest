// Relative rather than aliased: vitest resolves no "@/" alias, and unlike the
// type-only imports below this one survives transform.
import { type CycleStats, dayKey } from "./cycle";
import type {
  IntimacyEntry,
  IntimacyKind,
  IntimacyTag,
  ProtectionValue,
} from "@/lib/schemas";

export const KIND_LABELS: Record<IntimacyKind, string> = {
  partnered: "With a partner",
  solo: "Solo",
};

export const KIND_ORDER: IntimacyKind[] = ["partnered", "solo"];

export const PROTECTION_LABELS: Record<ProtectionValue, string> = {
  protected: "Protected",
  unprotected: "Unprotected",
  withdrawal: "Withdrawal",
  unspecified: "Not recorded",
};

export const PROTECTION_ORDER: ProtectionValue[] = [
  "protected",
  "unprotected",
  "withdrawal",
  "unspecified",
];

export const TAG_LABELS: Record<IntimacyTag, string> = {
  orgasm: "Orgasm",
  no_orgasm: "No orgasm",
  high_drive: "High sex drive",
  low_drive: "Low sex drive",
  painful: "Painful",
  toys: "Toys",
  fantasies: "Fantasies",
  bleeding: "Bleeding after",
};

export const TAG_ORDER: IntimacyTag[] = [
  "orgasm",
  "no_orgasm",
  "high_drive",
  "low_drive",
  "painful",
  "toys",
  "fantasies",
  "bleeding",
];

/**
 * Whether an entry fell inside the estimated fertile window — the one piece of
 * cycle context worth surfacing next to an entry, and only for a partnered
 * occurrence that wasn't protected. Withdrawal counts as "not protected" here
 * on purpose: it's the least reliable method there is.
 *
 * The window itself is an average-based estimate (see computeCycleStats), so the
 * UI labels it an estimate and never as a pregnancy risk verdict.
 */
export function isFertileWindowRisk(
  entry: IntimacyEntry,
  stats: CycleStats,
): boolean {
  if (entry.kind !== "partnered") return false;
  if (entry.protection === "protected") return false;
  if (entry.protection === "unspecified") return false;
  return fertileWindowKeys(stats).has(entry.entry_date);
}

/** Day keys covered by the estimated fertile window, or an empty set. */
export function fertileWindowKeys(stats: CycleStats): Set<string> {
  const keys = new Set<string>();
  const { fertileStart, fertileEnd } = stats;
  if (!fertileStart || !fertileEnd) return keys;
  for (
    let d = new Date(fertileStart);
    d <= fertileEnd;
    d.setDate(d.getDate() + 1)
  ) {
    keys.add(dayKey(d));
  }
  return keys;
}

/** One-line summary of an entry for the day list: "With a partner · Protected". */
export function describeEntry(entry: IntimacyEntry): string {
  const parts = [KIND_LABELS[entry.kind]];
  // Protection is meaningless for a solo entry, and "Not recorded" is noise.
  if (entry.kind === "partnered" && entry.protection !== "unspecified") {
    parts.push(PROTECTION_LABELS[entry.protection]);
  }
  return parts.join(" · ");
}

/** Day keys that have at least one entry, for marking the period calendar. */
export function loggedDayKeys(entries: IntimacyEntry[]): Set<string> {
  return new Set(entries.map((e) => e.entry_date));
}
