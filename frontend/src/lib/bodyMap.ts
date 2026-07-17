import type { Severity } from "@/lib/schemas";

export type BodyView = "front" | "back";

export type RegionShape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number };

export interface RegionDef {
  key: string;
  label: string;
  view: BodyView;
  shape: RegionShape;
}

// A schematic blocky figure in a 100x220 viewBox per view. Larger regions are
// listed before smaller ones so the smaller (hands/knees/feet) render on top
// and win taps in overlapping areas.
export const REGIONS: RegionDef[] = [
  // --- front ---
  { key: "left_arm", label: "Left arm", view: "front", shape: { kind: "rect", x: 18, y: 52, w: 10, h: 46 } },
  { key: "right_arm", label: "Right arm", view: "front", shape: { kind: "rect", x: 72, y: 52, w: 10, h: 46 } },
  { key: "left_leg", label: "Left leg", view: "front", shape: { kind: "rect", x: 39, y: 104, w: 10, h: 58 } },
  { key: "right_leg", label: "Right leg", view: "front", shape: { kind: "rect", x: 51, y: 104, w: 10, h: 58 } },
  { key: "chest", label: "Chest", view: "front", shape: { kind: "rect", x: 36, y: 44, w: 28, h: 22 } },
  { key: "abdomen", label: "Abdomen", view: "front", shape: { kind: "rect", x: 38, y: 66, w: 24, h: 24 } },
  { key: "hip", label: "Hip", view: "front", shape: { kind: "rect", x: 36, y: 90, w: 28, h: 14 } },
  { key: "head", label: "Head", view: "front", shape: { kind: "ellipse", cx: 50, cy: 18, rx: 12, ry: 15 } },
  { key: "neck", label: "Neck", view: "front", shape: { kind: "rect", x: 44, y: 33, w: 12, h: 9 } },
  { key: "left_shoulder", label: "Left shoulder", view: "front", shape: { kind: "ellipse", cx: 31, cy: 47, rx: 8, ry: 7 } },
  { key: "right_shoulder", label: "Right shoulder", view: "front", shape: { kind: "ellipse", cx: 69, cy: 47, rx: 8, ry: 7 } },
  { key: "left_knee", label: "Left knee", view: "front", shape: { kind: "ellipse", cx: 44, cy: 150, rx: 6, ry: 6 } },
  { key: "right_knee", label: "Right knee", view: "front", shape: { kind: "ellipse", cx: 56, cy: 150, rx: 6, ry: 6 } },
  { key: "left_hand", label: "Left hand", view: "front", shape: { kind: "ellipse", cx: 23, cy: 103, rx: 6, ry: 7 } },
  { key: "right_hand", label: "Right hand", view: "front", shape: { kind: "ellipse", cx: 77, cy: 103, rx: 6, ry: 7 } },
  { key: "left_foot", label: "Left foot", view: "front", shape: { kind: "ellipse", cx: 44, cy: 170, rx: 7, ry: 6 } },
  { key: "right_foot", label: "Right foot", view: "front", shape: { kind: "ellipse", cx: 56, cy: 170, rx: 7, ry: 6 } },
  // --- back ---
  { key: "upper_back", label: "Upper back", view: "back", shape: { kind: "rect", x: 36, y: 44, w: 28, h: 24 } },
  { key: "lower_back", label: "Lower back", view: "back", shape: { kind: "rect", x: 38, y: 68, w: 24, h: 22 } },
];

export const REGION_LABELS: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.key, r.label]),
);

export const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  none: { label: "None", color: "#334155" },
  mild: { label: "Mild", color: "#eab308" },
  moderate: { label: "Moderate", color: "#f97316" },
  severe: { label: "Severe", color: "#ef4444" },
};

export const SEVERITY_ORDER: Severity[] = ["none", "mild", "moderate", "severe"];

// Pain 0-10 → a green→red hue for the slider fill and history dots.
export function painColor(level: number): string {
  const clamped = Math.max(0, Math.min(10, level));
  const hue = 120 - clamped * 12; // 120=green .. 0=red
  return `hsl(${hue}, 70%, 45%)`;
}
