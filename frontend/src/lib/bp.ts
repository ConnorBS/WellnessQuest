export type BPCategory = "normal" | "elevated" | "stage_1" | "stage_2" | "crisis";

export function classifyBP(systolic: number, diastolic: number): BPCategory {
  if (systolic >= 180 || diastolic >= 120) return "crisis";
  if (systolic >= 140 || diastolic >= 90) return "stage_2";
  if (systolic >= 130 || diastolic >= 80) return "stage_1";
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) return "elevated";
  return "normal";
}

export interface BPCategoryMeta {
  label: string;
  color: string;
  bg: string;
}

export const BP_CATEGORY_META: Record<BPCategory, BPCategoryMeta> = {
  normal: { label: "Normal", color: "#022c22", bg: "#10b981" },
  elevated: { label: "Elevated", color: "#451a03", bg: "#fbbf24" },
  stage_1: { label: "Stage 1", color: "#422006", bg: "#eab308" },
  stage_2: { label: "Stage 2", color: "#431407", bg: "#f97316" },
  crisis: { label: "Crisis", color: "#fef2f2", bg: "#dc2626" },
};

export interface BPReading {
  systolic: number;
  diastolic: number;
}

export interface BPTarget {
  target_systolic: number;
  target_diastolic: number;
}

export function compareToTarget(reading: BPReading, target: BPTarget): string {
  const dSys = reading.systolic - target.target_systolic;
  const dDia = reading.diastolic - target.target_diastolic;
  if (dSys <= 0 && dDia <= 0) return "at or under target";
  if (dSys > 0 && dDia > 0) return `${dSys}/${dDia} over target`;
  if (dSys > 0) return `${dSys} sys over target`;
  return `${dDia} dia over target`;
}
