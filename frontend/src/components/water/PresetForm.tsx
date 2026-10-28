"use client";

import { FormEvent, useState } from "react";

import { IconPicker } from "@/components/icons/IconPicker";
import { PresetIcon } from "@/components/presets/PresetIcon";
import { useUploadIcon } from "@/hooks/useUploadIcon";
import type { IconKind, WaterPreset } from "@/lib/schemas";

interface Props {
  initial?: WaterPreset;
  onSubmit: (values: Omit<WaterPreset, "id">) => void;
  onCancel?: () => void;
  busy?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  marginTop: 4,
  background: "var(--wq-surface)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  color: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "transparent",
  color: "var(--wq-muted)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
};

export function PresetForm({ initial, onSubmit, onCancel, busy }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [volume, setVolume] = useState<number>(initial?.volume_ml ?? 250);
  const [iconKind, setIconKind] = useState<IconKind>(initial?.icon_kind ?? "builtin");
  const [iconKey, setIconKey] = useState<string | null>(initial?.icon_key ?? "cup");
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
      label: label.trim(),
      volume_ml: Math.max(1, Math.min(5000, Math.round(volume))),
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
          placeholder="e.g. Yeti Rambler"
          style={inputStyle}
        />
      </label>
      <label>
        Volume (ml)
        <input
          type="number"
          required
          min={1}
          max={5000}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "var(--wq-muted)" }}>Icon:</span>
          {(["builtin", "upload", "none"] as const).map((k) => (
            <label key={k} style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="radio"
                name="iconKind"
                checked={iconKind === k}
                onChange={() => {
                  setIconKind(k);
                  if (k === "builtin" && !iconKey) setIconKey("cup");
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
            {upload.isPending && <p style={{ color: "var(--wq-muted)", fontSize: 13 }}>Uploading…</p>}
            {uploadError && <p style={{ color: "#fca5a5", fontSize: 13 }}>{uploadError}</p>}
            {iconKey && !upload.isPending && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PresetIcon preset={{ icon_kind: "upload", icon_key: iconKey }} size={56} />
                <span style={{ fontSize: 13, color: "var(--wq-muted)" }}>Looks good — save to attach.</span>
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
