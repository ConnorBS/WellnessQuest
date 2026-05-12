"use client";

import { useAddWater } from "@/hooks/useAddWater";
import type { WaterPreset } from "@/lib/schemas";
import { uuidv4 } from "@/lib/uuid";

import { PresetIcon } from "@/components/presets/PresetIcon";

interface Props {
  preset?: WaterPreset;
  ml?: number;
  label?: string;
}

export function QuickAddWaterButton({ preset, ml, label }: Props) {
  const add = useAddWater();
  const volume = preset?.volume_ml ?? ml ?? 0;
  const displayLabel = label ?? preset?.label;

  return (
    <button
      type="button"
      onClick={() => add.mutate({ ml: volume, client_id: uuidv4() })}
      disabled={add.isPending || !volume}
      className="flex flex-col items-center gap-1 rounded-md border border-slate-700 px-3 py-3 hover:bg-slate-800 disabled:opacity-50"
      data-testid={`quick-add-${volume}`}
    >
      {preset && (
        <span style={{ color: "#cbd5e1" }}>
          <PresetIcon preset={preset} size={32} />
        </span>
      )}
      {displayLabel && (
        <span style={{ fontSize: 12, color: "#cbd5e1" }}>{displayLabel}</span>
      )}
      <span style={{ fontSize: 14, fontWeight: 500 }}>+{volume} ml</span>
    </button>
  );
}
