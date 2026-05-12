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
      onClick={() => add.mutate({ minutes: duration, client_id: uuidv4() })}
      disabled={add.isPending || !duration}
      className="flex flex-col items-center gap-1 rounded-md border border-slate-700 px-3 py-3 hover:bg-slate-800 disabled:opacity-50"
      data-testid={`quick-add-activity-${duration}`}
    >
      {preset && (
        <span style={{ color: "#cbd5e1" }}>
          <PresetIcon preset={preset} size={32} />
        </span>
      )}
      {displayLabel && (
        <span style={{ fontSize: 12, color: "#cbd5e1" }}>{displayLabel}</span>
      )}
      <span style={{ fontSize: 14, fontWeight: 500 }}>+{duration} min</span>
    </button>
  );
}
