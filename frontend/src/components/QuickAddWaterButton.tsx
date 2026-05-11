"use client";

import { useAddWater } from "@/hooks/useAddWater";

interface Props {
  ml: number;
}

export function QuickAddWaterButton({ ml }: Props) {
  const add = useAddWater();
  return (
    <button
      type="button"
      onClick={() => add.mutate({ ml, client_id: crypto.randomUUID() })}
      disabled={add.isPending}
      className="rounded-md border border-slate-700 px-4 py-3 text-base font-medium hover:bg-slate-800 disabled:opacity-50"
      data-testid={`quick-add-${ml}`}
    >
      +{ml} ml
    </button>
  );
}
