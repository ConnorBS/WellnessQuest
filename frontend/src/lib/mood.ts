import type { MoodValue } from "@/lib/schemas";

export interface MoodMeta {
  label: string;
  emoji: string;
  // Hex used for the dot/swatch and the monthly grid cell.
  color: string;
}

// Display order for the picker + legend. Roughly grouped pleasant → difficult.
export const MOOD_ORDER: MoodValue[] = [
  "happy",
  "excited",
  "grateful",
  "relaxed",
  "calm",
  "motivated",
  "productive",
  "tired",
  "low_energy",
  "sad",
  "stressed",
  "anxious",
  "overwhelmed",
  "frustrated",
  "angry",
];

export const MOOD_META: Record<MoodValue, MoodMeta> = {
  happy: { label: "Happy", emoji: "😊", color: "#22c55e" },
  excited: { label: "Excited", emoji: "🤩", color: "#f59e0b" },
  grateful: { label: "Grateful", emoji: "🙏", color: "#f97316" },
  relaxed: { label: "Relaxed", emoji: "😌", color: "#14b8a6" },
  calm: { label: "Calm", emoji: "🙂", color: "#38bdf8" },
  motivated: { label: "Motivated", emoji: "💪", color: "#a855f7" },
  productive: { label: "Productive", emoji: "✅", color: "#84cc16" },
  tired: { label: "Tired", emoji: "😴", color: "#94a3b8" },
  low_energy: { label: "Low energy", emoji: "🔋", color: "#64748b" },
  sad: { label: "Sad", emoji: "😢", color: "#3b82f6" },
  stressed: { label: "Stressed", emoji: "😣", color: "#eab308" },
  anxious: { label: "Anxious", emoji: "😰", color: "#6366f1" },
  overwhelmed: { label: "Overwhelmed", emoji: "🥵", color: "#fb7185" },
  frustrated: { label: "Frustrated", emoji: "😤", color: "#ef4444" },
  angry: { label: "Angry", emoji: "😠", color: "#dc2626" },
};

export const ENERGY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
};

export function moodMeta(mood: MoodValue): MoodMeta {
  return MOOD_META[mood];
}

// "Anxious, grateful & tired" — label for a check-in with several feelings.
// The strongest (first) keeps its capital; the rest read as a list after it.
export function moodsLabel(moods: MoodValue[]): string {
  const [first, ...rest] = moods.map((m) => MOOD_META[m].label);
  if (first === undefined) return "";
  if (rest.length === 0) return first;
  const tail = rest.map((l) => l.toLowerCase());
  const last = tail.pop();
  return tail.length ? `${first}, ${tail.join(", ")} & ${last}` : `${first} & ${last}`;
}
