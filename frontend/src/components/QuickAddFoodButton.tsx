"use client";

import { useAddFood } from "@/hooks/useAddFood";
import type { FoodPreset } from "@/lib/schemas";
import { uuidv4 } from "@/lib/uuid";

import { PresetIcon } from "@/components/presets/PresetIcon";

interface Props {
  preset: FoodPreset;
}

export function QuickAddFoodButton({ preset }: Props) {
  const add = useAddFood();
  return (
    <button
      type="button"
      onClick={() =>
        add.mutate({
          name: preset.label,
          brand: preset.brand ?? null,
          kcal: preset.kcal,
          protein_g: preset.protein_g ?? null,
          carbs_g: preset.carbs_g ?? null,
          fat_g: preset.fat_g ?? null,
          meal_type: preset.meal_type ?? null,
          provider: preset.provider ?? null,
          provider_id: preset.provider_id ?? null,
          client_id: uuidv4(),
        })
      }
      disabled={add.isPending}
      className="wq-tap flex flex-col items-center justify-center gap-1 rounded-md border border-slate-700 px-2 py-3 text-slate-200 hover:bg-slate-800 active:bg-slate-800 disabled:opacity-50"
      data-testid={`quick-add-food-${preset.kcal}`}
    >
      <span style={{ color: "var(--wq-text-2)", lineHeight: 0 }}>
        <PresetIcon preset={preset} size={28} />
      </span>
      <span style={{ fontSize: 12, color: "var(--wq-text-2)", textAlign: "center", lineHeight: 1.15 }}>
        {preset.label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>+{preset.kcal} kcal</span>
    </button>
  );
}
