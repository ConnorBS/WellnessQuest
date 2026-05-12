"use client";

import { FormEvent, useState } from "react";

import { IconPicker } from "@/components/icons/IconPicker";
import { PresetIcon } from "@/components/presets/PresetIcon";
import { useUploadIcon } from "@/hooks/useUploadIcon";
import { ACTIVITY_TYPE_DATALIST_ID, ACTIVITY_TYPE_SUGGESTIONS } from "@/lib/activityTypes";
import type { ActivityPreset, IconKind } from "@/lib/schemas";

interface Props {
  initial?: ActivityPreset;
  onSubmit: (values: Omit<ActivityPreset, "id">) => void;
  onCancel?: () => void;
  busy?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  marginTop: 4,
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 6,
};

export function PresetForm({ initial, onSubmit, onCancel, busy }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [minutes, setMinutes] = useState<number>(initial?.minutes ?? 30);
  const [exerciseType, setExerciseType] = useState<string>(initial?.exercise_type ?? "");
  const [iconKind, setIconKind] = useState<IconKind>(initial?.icon_kind ?? "builtin");
  const [iconKey, setIconKey] = useState<string | null>(initial?.icon_key ?? "walk");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const upload = useUploadIcon();

  function handleFile(file: File) {
    setUploadError(null);
    upload.mutate(file, {
      onSuccess: (res) => {
        setIconKind("upload");
        setIconKey(res.id);
      },
      onError: () => setUploadError("Upload failed — try a smaller image (under 5 MB)."),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedType = exerciseType.trim();
    onSubmit({
      label: label.trim(),
      minutes: Math.max(1, Math.min(1440, Math.round(minutes))),
      exercise_type: trimmedType ? trimmedType.slice(0, 60) : null,
      icon_kind: iconKind,
      icon_key: iconKind === "none" ? null : iconKey,
      sort_order: initial?.sort_order ?? 0,
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label>
        Label
        <input
          required
          maxLength={60}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. 30 min walk"
          style={inputStyle}
        />
      </label>
      <label>
        Duration (min)
        <input
          type="number"
          required
          min={1}
          max={1440}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      <label>
        Exercise type <span style={{ color: "#64748b", fontWeight: "normal", fontSize: 12 }}>(optional)</span>
        <input
          type="text"
          maxLength={60}
          value={exerciseType}
          onChange={(e) => setExerciseType(e.target.value)}
          placeholder="e.g. Running"
          list={ACTIVITY_TYPE_DATALIST_ID}
          style={inputStyle}
        />
        <datalist id={ACTIVITY_TYPE_DATALIST_ID}>
          {ACTIVITY_TYPE_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#94a3b8" }}>Icon:</span>
          {(["builtin", "upload", "none"] as const).map((k) => (
            <label key={k} style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="radio"
                name="iconKind"
                checked={iconKind === k}
                onChange={() => {
                  setIconKind(k);
                  if (k === "builtin" && !iconKey) setIconKey("walk");
                  if (k === "none") setIconKey(null);
                }}
              />
              {k === "builtin" ? "Pick from MDI" : k === "upload" ? "Upload" : "None"}
            </label>
          ))}
        </div>

        {iconKind === "builtin" && <IconPicker value={iconKey} onChange={setIconKey} />}

        {iconKind === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={upload.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              style={{ fontSize: 14 }}
            />
            {upload.isPending && <p style={{ color: "#94a3b8", fontSize: 13 }}>Uploading…</p>}
            {uploadError && <p style={{ color: "#fca5a5", fontSize: 13 }}>{uploadError}</p>}
            {iconKey && !upload.isPending && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PresetIcon preset={{ icon_kind: "upload", icon_key: iconKey }} size={56} />
                <span style={{ fontSize: 13, color: "#94a3b8" }}>Looks good — save to attach.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy || upload.isPending} style={buttonStyle}>
          {busy ? "Saving…" : upload.isPending ? "Uploading…" : initial ? "Save changes" : "Add preset"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
