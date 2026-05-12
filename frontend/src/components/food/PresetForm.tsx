"use client";

import { FormEvent, useState } from "react";

import { IconPicker } from "@/components/icons/IconPicker";
import { PresetIcon } from "@/components/presets/PresetIcon";
import { useUploadIcon } from "@/hooks/useUploadIcon";
import type { FoodPreset, IconKind, MealType } from "@/lib/schemas";

interface Props {
  initial?: FoodPreset;
  onSubmit: (values: Omit<FoodPreset, "id">) => void;
  onCancel?: () => void;
  busy?: boolean;
}

const MEAL_OPTIONS: { label: string; value: MealType | "" }[] = [
  { label: "—", value: "" },
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Snack", value: "snack" },
];

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

function toNumOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function PresetForm({ initial, onSubmit, onCancel, busy }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [kcal, setKcal] = useState<number>(initial?.kcal ?? 100);
  const [protein, setProtein] = useState<string>(
    initial?.protein_g != null ? String(initial.protein_g) : "",
  );
  const [carbs, setCarbs] = useState<string>(
    initial?.carbs_g != null ? String(initial.carbs_g) : "",
  );
  const [fat, setFat] = useState<string>(
    initial?.fat_g != null ? String(initial.fat_g) : "",
  );
  const [meal, setMeal] = useState<MealType | "">(initial?.meal_type ?? "");
  const [iconKind, setIconKind] = useState<IconKind>(initial?.icon_kind ?? "builtin");
  const [iconKey, setIconKey] = useState<string | null>(
    initial?.icon_key ?? "food-apple",
  );
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
      brand: brand.trim() ? brand.trim().slice(0, 120) : null,
      kcal: Math.max(0, Math.min(20000, Math.round(kcal))),
      protein_g: toNumOrNull(protein),
      carbs_g: toNumOrNull(carbs),
      fat_g: toNumOrNull(fat),
      meal_type: meal === "" ? null : meal,
      provider: initial?.provider ?? null,
      provider_id: initial?.provider_id ?? null,
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
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Greek yogurt cup"
          style={inputStyle}
        />
      </label>

      <label>
        Brand <span style={{ color: "#64748b", fontWeight: "normal", fontSize: 12 }}>(optional)</span>
        <input
          type="text"
          maxLength={120}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Fage"
          style={inputStyle}
        />
      </label>

      <label>
        Calories (kcal)
        <input
          type="number"
          required
          min={0}
          max={20000}
          value={kcal}
          onChange={(e) => setKcal(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <label>
          Protein (g)
          <input
            type="number"
            min={0}
            max={2000}
            step="0.1"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Carbs (g)
          <input
            type="number"
            min={0}
            max={2000}
            step="0.1"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Fat (g)
          <input
            type="number"
            min={0}
            max={2000}
            step="0.1"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label>
        Default meal <span style={{ color: "#64748b", fontWeight: "normal", fontSize: 12 }}>(optional)</span>
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value as MealType | "")}
          style={inputStyle}
        >
          {MEAL_OPTIONS.map((o) => (
            <option key={o.value || "none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
                  if (k === "builtin" && !iconKey) setIconKey("food-apple");
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
          {busy ? "Saving…" : upload.isPending ? "Uploading…" : initial ? "Save changes" : "Add quick food"}
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
