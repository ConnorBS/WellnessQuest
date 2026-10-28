"use client";

import { useMemo, useState } from "react";

import { BodyMap } from "@/components/pain/BodyMap";
import { EditDrawerShell, fieldLabel, inputStyle } from "@/components/forms/EditDrawerShell";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useSymptomCatalog, useUpdatePain, type UpdatePainArgs } from "@/hooks/usePain";
import {
  painColor,
  REGION_LABELS,
  SEVERITY_META,
  SEVERITY_ORDER,
} from "@/lib/bodyMap";
import type { PainEntry, Severity } from "@/lib/schemas";

interface Props {
  entry: PainEntry;
  onClose: () => void;
}

interface SymptomState {
  severity: Severity;
  duration: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type SymptomPatch = NonNullable<UpdatePainArgs["patch"]["symptoms"]>;

function sameSymptoms(a: SymptomPatch, entry: PainEntry): boolean {
  if (a.length !== entry.symptoms.length) return false;
  const before = new Map(
    entry.symptoms.map((s) => [s.catalog_id, `${s.severity}:${s.duration_minutes ?? ""}`]),
  );
  return a.every(
    (s) => before.get(s.catalog_id) === `${s.severity}:${s.duration_minutes ?? ""}`,
  );
}

export function EditPainEntryDrawer({ entry, onClose }: Props) {
  const catalog = useSymptomCatalog();
  const update = useUpdatePain();
  const [painLevel, setPainLevel] = useState(entry.pain_level);
  const [regions, setRegions] = useState<string[]>(entry.locations);
  const [note, setNote] = useState(entry.note ?? "");
  // null = "keep the original time"; OccurredAtField starts collapsed showing
  // the existing time and only yields a value once the user opens the picker.
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<Record<number, SymptomState>>(() =>
    Object.fromEntries(
      entry.symptoms.map((s) => [
        s.catalog_id,
        { severity: s.severity, duration: s.duration_minutes?.toString() ?? "" },
      ]),
    ),
  );

  // Symptoms archived since the entry was logged aren't in the catalog, but the
  // entry still references them — list them so an edit doesn't silently drop them.
  const rows = useMemo(() => {
    const live = (catalog.data ?? []).map((c) => ({ id: c.id, name: c.name }));
    const known = new Set(live.map((c) => c.id));
    const archived = entry.symptoms
      .filter((s) => !known.has(s.catalog_id))
      .map((s) => ({ id: s.catalog_id, name: `${s.name} (archived)` }));
    return [...live, ...archived];
  }, [catalog.data, entry.symptoms]);

  function toggleRegion(key: string) {
    setRegions((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function setSeverity(id: number, severity: Severity) {
    setSymptoms((cur) => ({ ...cur, [id]: { severity, duration: cur[id]?.duration ?? "" } }));
  }

  function setDuration(id: number, duration: string) {
    setSymptoms((cur) => ({
      ...cur,
      [id]: { severity: cur[id]?.severity ?? "none", duration },
    }));
  }

  function save() {
    const patch: UpdatePainArgs["patch"] = {};
    if (painLevel !== entry.pain_level) patch.pain_level = painLevel;

    const noteTrim = note.trim() || null;
    if (noteTrim !== (entry.note ?? null)) patch.note = noteTrim;

    if (occurredAt !== null) patch.occurred_at = occurredAt;

    const before = [...entry.locations].sort();
    const after = [...new Set(regions)].sort();
    if (before.join("|") !== after.join("|")) patch.locations = regions;

    const chosen = Object.entries(symptoms)
      .filter(([, s]) => s.severity !== "none")
      .map(([id, s]) => {
        const mins = parseInt(s.duration, 10);
        return {
          catalog_id: Number(id),
          severity: s.severity,
          duration_minutes: Number.isFinite(mins) && mins >= 0 ? mins : null,
        };
      });
    if (!sameSymptoms(chosen, entry)) patch.symptoms = chosen;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: entry.id, patch }, { onSuccess: () => onClose() });
  }

  return (
    <EditDrawerShell
      title="Edit check-in"
      ariaLabel={`Edit pain check-in (${entry.pain_level}/10)`}
      onClose={onClose}
      onSave={save}
      saving={update.isPending}
      errorMessage={update.isError ? "Save failed — try again." : null}
    >
      <div>
        <span style={fieldLabel}>
          Pain level: <strong style={{ color: painColor(painLevel) }}>{painLevel}/10</strong>
        </span>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={painLevel}
          aria-label="Pain level"
          onChange={(e) => setPainLevel(Number(e.target.value))}
          style={{ width: "100%", accentColor: painColor(painLevel) }}
        />
      </div>

      <div>
        <span style={fieldLabel}>Where does it hurt? (tap)</span>
        <BodyMap selected={regions} onToggle={toggleRegion} />
        {regions.length > 0 && (
          <p style={{ color: "var(--wq-text-2)", fontSize: 12, marginTop: 4, textAlign: "center" }}>
            {regions.map((r) => REGION_LABELS[r] ?? r).join(", ")}
          </p>
        )}
      </div>

      <div>
        <span style={fieldLabel}>Symptoms</span>
        {catalog.isLoading ? (
          <p style={{ color: "var(--wq-muted)", fontSize: 13 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--wq-muted)", fontSize: 13 }}>No symptoms in your list.</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {rows.map((c) => {
              const st = symptoms[c.id] ?? { severity: "none" as Severity, duration: "" };
              return (
                <li key={c.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13 }}>{c.name}</span>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                    {SEVERITY_ORDER.map((sev) => {
                      const on = st.severity === sev;
                      const meta = SEVERITY_META[sev];
                      return (
                        <button
                          key={sev}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSeverity(c.id, sev)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: on ? `2px solid ${meta.color}` : "1px solid var(--wq-border)",
                            background: on ? `${meta.color}22` : "transparent",
                            color: "var(--wq-text)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                    {st.severity !== "none" && (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={st.duration}
                        onChange={(e) => setDuration(c.id, e.target.value)}
                        placeholder="mins"
                        aria-label={`${c.name} duration in minutes`}
                        style={{ ...inputStyle, width: 70 }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <label>
        <span style={fieldLabel}>Note</span>
        <input
          type="text"
          value={note}
          maxLength={500}
          placeholder="Optional note"
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
