import type { MoodValue } from "@/lib/schemas";

export interface MoodMeta {
  label: string;
  emoji: string;
  // Hex used for the dot/swatch and the monthly grid cell.
  color: string;
}

// Picker sections, roughly pleasant → difficult. Grouping keeps ~45 chips
// scannable on a phone; a value may appear in only one group.
export const MOOD_GROUPS: { label: string; moods: MoodValue[] }[] = [
  {
    label: "Pleasant & energised",
    moods: ["happy", "joyful", "excited", "amused", "proud", "confident", "hopeful", "inspired", "motivated", "productive"],
  },
  {
    label: "Pleasant & calm",
    moods: ["calm", "relaxed", "peaceful", "content", "grateful", "loved", "connected", "relieved"],
  },
  {
    label: "Sad",
    moods: ["sad", "lonely", "disappointed", "hurt", "grieving", "nostalgic"],
  },
  {
    label: "Anxious & afraid",
    moods: ["anxious", "worried", "scared", "insecure", "stressed", "overwhelmed"],
  },
  {
    label: "Angry",
    moods: ["angry", "frustrated", "irritated", "resentful", "jealous"],
  },
  {
    label: "Self-conscious",
    moods: ["ashamed", "guilty", "embarrassed"],
  },
  {
    label: "Body & mind",
    moods: ["tired", "low_energy", "restless", "bored", "confused", "numb"],
  },
];

export const MOOD_ORDER: MoodValue[] = MOOD_GROUPS.flatMap((g) => g.moods);

export const MOOD_META: Record<MoodValue, MoodMeta> = {
  happy: { label: "Happy", emoji: "😊", color: "#22c55e" },
  joyful: { label: "Joyful", emoji: "😄", color: "#16a34a" },
  excited: { label: "Excited", emoji: "🤩", color: "#f59e0b" },
  amused: { label: "Amused", emoji: "😆", color: "#fbbf24" },
  proud: { label: "Proud", emoji: "🦁", color: "#eab308" },
  confident: { label: "Confident", emoji: "😎", color: "#ca8a04" },
  hopeful: { label: "Hopeful", emoji: "🌱", color: "#4ade80" },
  inspired: { label: "Inspired", emoji: "✨", color: "#c084fc" },
  motivated: { label: "Motivated", emoji: "💪", color: "#a855f7" },
  productive: { label: "Productive", emoji: "✅", color: "#84cc16" },
  calm: { label: "Calm", emoji: "🙂", color: "#38bdf8" },
  relaxed: { label: "Relaxed", emoji: "😌", color: "#14b8a6" },
  peaceful: { label: "Peaceful", emoji: "🕊️", color: "#7dd3fc" },
  content: { label: "Content", emoji: "☺️", color: "#2dd4bf" },
  grateful: { label: "Grateful", emoji: "🙏", color: "#f97316" },
  loved: { label: "Loved", emoji: "🥰", color: "#f472b6" },
  connected: { label: "Connected", emoji: "🤝", color: "#0ea5e9" },
  relieved: { label: "Relieved", emoji: "😮‍💨", color: "#5eead4" },
  sad: { label: "Sad", emoji: "😢", color: "#3b82f6" },
  lonely: { label: "Lonely", emoji: "🥺", color: "#60a5fa" },
  disappointed: { label: "Disappointed", emoji: "😞", color: "#2563eb" },
  hurt: { label: "Hurt", emoji: "💔", color: "#1d4ed8" },
  grieving: { label: "Grieving", emoji: "🖤", color: "#1e40af" },
  nostalgic: { label: "Nostalgic", emoji: "🌅", color: "#93c5fd" },
  anxious: { label: "Anxious", emoji: "😰", color: "#6366f1" },
  worried: { label: "Worried", emoji: "😟", color: "#818cf8" },
  scared: { label: "Scared", emoji: "😨", color: "#4f46e5" },
  insecure: { label: "Insecure", emoji: "😶", color: "#a5b4fc" },
  stressed: { label: "Stressed", emoji: "😣", color: "#eab308" },
  overwhelmed: { label: "Overwhelmed", emoji: "🥵", color: "#fb7185" },
  angry: { label: "Angry", emoji: "😠", color: "#dc2626" },
  frustrated: { label: "Frustrated", emoji: "😤", color: "#ef4444" },
  irritated: { label: "Irritated", emoji: "😒", color: "#f87171" },
  resentful: { label: "Resentful", emoji: "😾", color: "#b91c1c" },
  jealous: { label: "Jealous", emoji: "😑", color: "#991b1b" },
  ashamed: { label: "Ashamed", emoji: "😔", color: "#d946ef" },
  guilty: { label: "Guilty", emoji: "😬", color: "#c026d3" },
  embarrassed: { label: "Embarrassed", emoji: "😳", color: "#f0abfc" },
  tired: { label: "Tired", emoji: "😴", color: "#94a3b8" },
  low_energy: { label: "Low energy", emoji: "🔋", color: "#64748b" },
  restless: { label: "Restless", emoji: "🌀", color: "#a3a3a3" },
  bored: { label: "Bored", emoji: "🥱", color: "#78716c" },
  confused: { label: "Confused", emoji: "😕", color: "#a8a29e" },
  numb: { label: "Numb", emoji: "😐", color: "#6b7280" },
};

// Mirrors MOOD_NOTE_MAX in backend/app/models/mood_entry.py.
export const MOOD_NOTE_MAX = 4000;

export const noteTextarea: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 15,
  lineHeight: 1.5,
  fontFamily: "inherit",
  resize: "vertical",
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
