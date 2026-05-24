"use client";

import { useState } from "react";

import { EditDrawerShell, fieldLabel, inputStyle } from "@/components/forms/EditDrawerShell";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useUpdateWeight, type UpdateWeightArgs } from "@/hooks/useWeight";
import type { WeightEntry } from "@/lib/schemas";
import { displayToKg, kgToDisplay } from "@/lib/units";

interface Props {
  entry: WeightEntry;
  unit: string; // "kg" | "lb" — display only; storage is canonical kg
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EditWeightEntryDrawer({ entry, unit, onClose }: Props) {
  const update = useUpdateWeight();
  // Show + edit in the user's chosen display unit; convert back to kg on save.
  const initialDisplay = kgToDisplay(entry.weight_kg, unit);
  const [weightDisplay, setWeightDisplay] = useState<number | "">(
    Number(initialDisplay.toFixed(2)),
  );
  const [note, setNote] = useState<string>(entry.note ?? "");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);

  function save() {
    const patch: UpdateWeightArgs["patch"] = {};
    const w = weightDisplay === "" ? 0 : Number(weightDisplay);
    if (w > 0) {
      const kg = displayToKg(w, unit);
      // Only send if the round-tripped kg actually differs to >0.01 kg, so a
      // pure "open and close" doesn't churn the row.
      if (Math.abs(kg - entry.weight_kg) > 0.01) {
        patch.weight_kg = Math.round(kg * 100) / 100;
      }
    }
    const noteTrim = note.trim() || null;
    if (noteTrim !== (entry.note ?? null)) patch.note = noteTrim;
    if (occurredAt !== null) patch.occurred_at = occurredAt;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: entry.id, patch }, { onSuccess: () => onClose() });
  }

  return (
    <EditDrawerShell
      title="Edit weight"
      ariaLabel="Edit weight entry"
      onClose={onClose}
      onSave={save}
      saving={update.isPending}
      errorMessage={update.isError ? "Save failed — try again." : null}
    >
      <label>
        <span style={fieldLabel}>Weight ({unit})</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={weightDisplay}
          onChange={(e) =>
            setWeightDisplay(e.target.value === "" ? "" : Number(e.target.value))
          }
          style={inputStyle}
        />
      </label>
      <label>
        <span style={fieldLabel}>Note</span>
        <input
          value={note}
          maxLength={500}
          placeholder="optional"
          onChange={(e) => setNote(e.target.value)}
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
