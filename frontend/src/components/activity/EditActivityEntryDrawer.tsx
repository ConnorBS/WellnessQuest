"use client";

import { useState } from "react";

import { EditDrawerShell, fieldLabel, inputStyle } from "@/components/forms/EditDrawerShell";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useUpdateActivity, type UpdateActivityArgs } from "@/hooks/useAddActivity";
import type { ActivityEntry } from "@/lib/schemas";

interface Props {
  entry: ActivityEntry;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EditActivityEntryDrawer({ entry, onClose }: Props) {
  const update = useUpdateActivity();
  const [minutes, setMinutes] = useState<number | "">(entry.minutes);
  const [name, setName] = useState<string>(entry.name ?? "");
  const [exerciseType, setExerciseType] = useState<string>(entry.exercise_type ?? "");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);

  function save() {
    const patch: UpdateActivityArgs["patch"] = {};
    const m = minutes === "" ? 0 : Number(minutes);
    if (m > 0 && m !== entry.minutes) patch.minutes = m;
    const nameTrim = name.trim() || null;
    if (nameTrim !== (entry.name ?? null)) patch.name = nameTrim;
    const exTrim = exerciseType.trim() || null;
    if (exTrim !== (entry.exercise_type ?? null)) patch.exercise_type = exTrim;
    if (occurredAt !== null) patch.occurred_at = occurredAt;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: entry.id, patch }, { onSuccess: () => onClose() });
  }

  return (
    <EditDrawerShell
      title="Edit activity"
      ariaLabel={`Edit activity entry (${entry.minutes} min)`}
      onClose={onClose}
      onSave={save}
      saving={update.isPending}
      errorMessage={update.isError ? "Save failed — try again." : null}
    >
      <label>
        <span style={fieldLabel}>Minutes</span>
        <input
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value === "" ? "" : Number(e.target.value))}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={fieldLabel}>Name</span>
        <input
          value={name}
          maxLength={60}
          placeholder="e.g. Lunch walk"
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={fieldLabel}>Exercise type</span>
        <input
          value={exerciseType}
          maxLength={60}
          placeholder="e.g. Walking, Cycling"
          onChange={(e) => setExerciseType(e.target.value)}
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
