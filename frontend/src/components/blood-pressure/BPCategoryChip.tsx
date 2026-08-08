"use client";

import { useMe } from "@/hooks/useMe";
import { BP_CATEGORY_META, classifyBP } from "@/lib/bp";

interface Props {
  systolic: number;
  diastolic: number;
}

export function BPCategoryChip({ systolic, diastolic }: Props) {
  const { data: me } = useMe();
  // The opt-out lives here rather than at each call site so a new place that
  // renders a reading can't forget it. Falls open to "shown" while /me loads.
  const cat = classifyBP(systolic, diastolic);
  const meta = BP_CATEGORY_META[cat];
  if (me && !me.show_bp_category) return null;
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
