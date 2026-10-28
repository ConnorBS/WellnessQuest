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
      className="wq-tap flex flex-col items-center justify-center gap-1 rounded-md border border-slate-700 px-2 py-3 text-slate-200 hover:bg-slate-800 active:bg-slate-800 disabled:opacity-50"
      data-testid={`quick-add-${volume}`}
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
      <span style={{ fontSize: 13, fontWeight: 600 }}>+{volume} ml</span>
    </button>
  );
}
