"use client";

import { useState } from "react";

import { EditDrawerShell, fieldLabel, inputStyle } from "@/components/forms/EditDrawerShell";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { bpUpdateErrorMessage, useUpdateBP, type UpdateBPArgs } from "@/hooks/useBloodPressure";
import type { BloodPressureEntry } from "@/lib/schemas";

interface Props {
  entry: BloodPressureEntry;
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

export function EditBPEntryDrawer({ entry, onClose }: Props) {
  const update = useUpdateBP();
  const [systolic, setSystolic] = useState<number | "">(entry.systolic);
  const [diastolic, setDiastolic] = useState<number | "">(entry.diastolic);
  const [pulse, setPulse] = useState<number | "">(entry.pulse ?? "");
  const [note, setNote] = useState<string>(entry.note ?? "");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);

  function save() {
    const patch: UpdateBPArgs["patch"] = {};
    const sys = systolic === "" ? 0 : Number(systolic);
    const dia = diastolic === "" ? 0 : Number(diastolic);
    if (sys > 0 && sys !== entry.systolic) patch.systolic = sys;
    if (dia > 0 && dia !== entry.diastolic) patch.diastolic = dia;
    const pulseVal = pulse === "" ? null : Number(pulse);
    if (pulseVal !== (entry.pulse ?? null)) patch.pulse = pulseVal;
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
      title="Edit reading"
      ariaLabel={`Edit BP reading (${entry.systolic}/${entry.diastolic})`}
      onClose={onClose}
      onSave={save}
      saving={update.isPending}
      errorMessage={
        update.isError && update.error ? bpUpdateErrorMessage(update.error) : null
      }
    >
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ flex: 1 }}>
          <span style={fieldLabel}>Systolic</span>
          <input
            type="number"
            min={1}
            max={299}
            value={systolic}
            onChange={(e) =>
              setSystolic(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={inputStyle}
          />
        </label>
        <label style={{ flex: 1 }}>
          <span style={fieldLabel}>Diastolic</span>
          <input
            type="number"
            min={1}
            max={199}
            value={diastolic}
            onChange={(e) =>
              setDiastolic(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={inputStyle}
          />
        </label>
      </div>
      <label>
        <span style={fieldLabel}>Pulse (bpm)</span>
        <input
          type="number"
          min={1}
          max={299}
          value={pulse}
          placeholder="optional"
          onChange={(e) =>
            setPulse(e.target.value === "" ? "" : Number(e.target.value))
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
