"use client";

import { useState } from "react";

import { EditDrawerShell, fieldLabel, inputStyle } from "@/components/forms/EditDrawerShell";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useUpdateWater, type UpdateWaterArgs } from "@/hooks/useAddWater";
import type { WaterEntry } from "@/lib/schemas";

interface Props {
  entry: WaterEntry;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EditWaterEntryDrawer({ entry, onClose }: Props) {
  const update = useUpdateWater();
  const [ml, setMl] = useState<number | "">(entry.ml);
  const [name, setName] = useState<string>(entry.name ?? "");
  // null = "keep the original time" — OccurredAtField starts collapsed
  // showing the existing time as its default label, and only becomes a
  // non-null value once the user explicitly opens the picker.
  const [occurredAt, setOccurredAt] = useState<string | null>(null);

  function save() {
    const patch: UpdateWaterArgs["patch"] = {};
    const mlNum = ml === "" ? 0 : Number(ml);
    if (mlNum > 0 && mlNum !== entry.ml) patch.ml = mlNum;
    const nameTrim = name.trim() || null;
    if (nameTrim !== (entry.name ?? null)) patch.name = nameTrim;
    if (occurredAt !== null) patch.occurred_at = occurredAt;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: entry.id, patch }, { onSuccess: () => onClose() });
  }

  return (
    <EditDrawerShell
      title="Edit water"
      ariaLabel={`Edit water entry (${entry.ml} ml)`}
      onClose={onClose}
      onSave={save}
      saving={update.isPending}
      errorMessage={update.isError ? "Save failed — try again." : null}
    >
      <label>
        <span style={fieldLabel}>Amount (ml)</span>
        <input
          type="number"
          min={1}
          max={5000}
          value={ml}
          onChange={(e) => setMl(e.target.value === "" ? "" : Number(e.target.value))}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={fieldLabel}>Label</span>
        <input
          value={name}
          maxLength={60}
          placeholder="e.g. Glass, Bottle"
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </label>
      <OccurredAtField
        value={occurredAt}
        onChange={setOccurredAt}
        defaultLabel={formatTime(entry.occurred_at)}
        initialPickerIso={entry.occurred_at}
      />
    </EditDrawerShell>
  );
}
