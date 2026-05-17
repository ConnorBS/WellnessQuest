"use client";

import { BP_CATEGORY_META, classifyBP } from "@/lib/bp";

interface Props {
  systolic: number;
  diastolic: number;
}

export function BPCategoryChip({ systolic, diastolic }: Props) {
  const cat = classifyBP(systolic, diastolic);
  const meta = BP_CATEGORY_META[cat];
  return (
    <span
      style={{
        background: meta.bg,
        color: meta.color,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}
