"use client";

import { useAddActivity } from "@/hooks/useAddActivity";
import type { ActivityPreset } from "@/lib/schemas";
import { uuidv4 } from "@/lib/uuid";

import { PresetIcon } from "@/components/presets/PresetIcon";

interface Props {
  preset?: ActivityPreset;
  minutes?: number;
  label?: string;
}

export function QuickAddActivityButton({ preset, minutes, label }: Props) {
  const add = useAddActivity();
  const duration = preset?.minutes ?? minutes ?? 0;
  const displayLabel = label ?? preset?.label;

  return (
    <button
      type="button"
      onClick={() =>
        add.mutate({
          minutes: duration,
          client_id: uuidv4(),
          exercise_type: preset?.exercise_type ?? null,
        })
      }
      disabled={add.isPending || !duration}
      className="wq-tap flex flex-col items-center justify-center gap-1 rounded-md border border-slate-700 px-2 py-3 text-slate-200 hover:bg-slate-800 active:bg-slate-800 disabled:opacity-50"
      data-testid={`quick-add-activity-${duration}`}
    >
      {preset && (
        <span style={{ color: "var(--wq-text-2)", lineHeight: 0 }}>
          <PresetIcon preset={preset} size={28} />
        </span>
      )}
      {displayLabel && (
        <span style={{ fontSize: 12, color: "var(--wq-text-2)", textAlign: "center", lineHeight: 1.15 }}>
          {displayLabel}
        </span>
      )}
      <span style={{ fontSize: 13, fontWeight: 600 }}>+{duration} min</span>
    </button>
  );
}
