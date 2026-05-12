"use client";

import { FormEvent, useState } from "react";

import { useUploadIcon } from "@/hooks/useUploadIcon";
import { BUILTIN_ICONS, BuiltinIcon } from "@/lib/builtin-icons";
import type { CadenceKind, Habit, IconKind } from "@/lib/schemas";

import { PresetIcon } from "@/components/presets/PresetIcon";

interface Props {
  initial?: Habit;
  onSubmit: (values: Omit<Habit, "id">) => void;
  onCancel?: () => void;
  busy?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 6,
};

export function HabitForm({ initial, onSubmit, onCancel, busy }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [cadenceKind, setCadenceKind] = useState<CadenceKind>(initial?.cadence_kind ?? "daily");
  const [weeklyTarget, setWeeklyTarget] = useState<number>(initial?.weekly_target ?? 3);
  const [intervalDays, setIntervalDays] = useState<number>(initial?.interval_days ?? 2);
  const [iconKind, setIconKind] = useState<IconKind>(initial?.icon_kind ?? "builtin");
  const [iconKey, setIconKey] = useState<string | null>(initial?.icon_key ?? "droplet");
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
    onSubmit({
      name: name.trim(),
      icon_kind: iconKind,
      icon_key: iconKind === "none" ? null : iconKey,
      cadence_kind: cadenceKind,
      weekly_target: cadenceKind === "weekly" ? Math.max(1, Math.min(7, weeklyTarget)) : null,
      interval_days: cadenceKind === "interval" ? Math.max(2, Math.min(365, intervalDays)) : null,
      sort_order: initial?.sort_order ?? 0,
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label>
        Habit name
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Take vitamins"
          style={inputStyle}
        />
      </label>

      <fieldset style={{ border: "1px solid #334155", borderRadius: 8, padding: 12 }}>
        <legend style={{ color: "#cbd5e1", padding: "0 6px" }}>Cadence</legend>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input
            type="radio"
            name="cadence"
            checked={cadenceKind === "daily"}
            onChange={() => setCadenceKind("daily")}
          />
          Every day
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <input
            type="radio"
            name="cadence"
            checked={cadenceKind === "weekly"}
            onChange={() => setCadenceKind("weekly")}
          />
          <input
            type="number"
            min={1}
            max={7}
            value={weeklyTarget}
            onChange={(e) => setWeeklyTarget(Number(e.target.value) || 0)}
            disabled={cadenceKind !== "weekly"}
            style={{ width: 64 }}
          />
          times per week
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="radio"
            name="cadence"
            checked={cadenceKind === "interval"}
            onChange={() => setCadenceKind("interval")}
          />
          Every
          <input
            type="number"
            min={2}
            max={365}
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value) || 0)}
            disabled={cadenceKind !== "interval"}
            style={{ width: 64 }}
          />
          days
        </label>
      </fieldset>

      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "#94a3b8" }}>Icon:</span>
          {(["builtin", "upload", "none"] as const).map((k) => (
            <label key={k} style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="radio"
                name="iconKind"
                checked={iconKind === k}
                onChange={() => {
                  setIconKind(k);
                  if (k === "builtin" && !iconKey) setIconKey("droplet");
                  if (k === "none") setIconKey(null);
                }}
              />
              {k === "builtin" ? "Pick from set" : k === "upload" ? "Upload" : "None"}
            </label>
          ))}
        </div>

        {iconKind === "builtin" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {BUILTIN_ICONS.map((icon) => {
              const selected = iconKey === icon.key;
              return (
                <button
                  key={icon.key}
                  type="button"
                  onClick={() => setIconKey(icon.key)}
                  title={icon.label}
                  style={{
                    aspectRatio: "1",
                    padding: 6,
                    background: selected ? "#1e293b" : "transparent",
                    border: selected ? "2px solid #10b981" : "1px solid #334155",
                    borderRadius: 6,
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BuiltinIcon name={icon.key} size={28} />
                </button>
              );
            })}
          </div>
        )}

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
          {busy ? "Saving…" : upload.isPending ? "Uploading…" : initial ? "Save changes" : "Add habit"}
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
