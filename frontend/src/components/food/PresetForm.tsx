"use client";

import { FormEvent, useState } from "react";

import { IconPicker } from "@/components/icons/IconPicker";
import { NutritionLabelScanner } from "@/components/food/NutritionLabelScanner";
import { PresetIcon } from "@/components/presets/PresetIcon";
import { useDailyValues } from "@/hooks/useDailyValues";
import { useUploadIcon } from "@/hooks/useUploadIcon";
import { PANEL_ORDER } from "@/lib/canadianDV";
import type {
  FoodPreset,
  IconKind,
  LabelScanOut,
  MealType,
  NutrientPanel,
} from "@/lib/schemas";

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

const MACRO_KEYS = new Set(["kcal", "protein_g", "carbs_g", "fat_g"]);

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

function nutrientToString(v: number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

export function PresetForm({ initial, onSubmit, onCancel, busy }: Props) {
  const { data: dv } = useDailyValues();
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
  const [servingG, setServingG] = useState<string>(
    initial?.serving_g != null ? String(initial.serving_g) : "",
  );
  const [servingLabel, setServingLabel] = useState<string>(initial?.serving_label ?? "");
  const [nutrients, setNutrients] = useState<NutrientPanel>(
    (initial?.nutrients as NutrientPanel) ?? {},
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

  function onLabelScanned(parsed: LabelScanOut) {
    // Auto-fill anything the parser confidently extracted. Don't clobber
    // values the user already typed — the use case is "I started filling
    // this out, then realized I should just scan it".
    if (parsed.name && !label.trim()) setLabel(parsed.name);
    if (parsed.brand && !brand.trim()) setBrand(parsed.brand);
    if (parsed.kcal != null) setKcal(parsed.kcal);
    if (parsed.serving_g != null && !servingG) setServingG(String(parsed.serving_g));
    if (parsed.serving_label && !servingLabel) setServingLabel(parsed.serving_label);
    setNutrients((prev) => {
      const merged: NutrientPanel = { ...prev };
      for (const [k, v] of Object.entries(parsed.nutrients)) {
        if (v != null && (merged as Record<string, number | null | undefined>)[k] == null) {
          (merged as Record<string, number>)[k] = v;
        }
      }
      return merged;
    });
  }

  function setNutrient(key: string, raw: string) {
    setNutrients((prev) => ({
      ...prev,
      [key]: raw === "" ? null : Number(raw),
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanNutrients: Record<string, number> = {};
    for (const [k, v] of Object.entries(nutrients)) {
      if (v != null) cleanNutrients[k] = v;
    }
    onSubmit({
      label: label.trim(),
      brand: brand.trim() ? brand.trim().slice(0, 120) : null,
      kcal: Math.max(0, Math.min(20000, Math.round(kcal))),
      protein_g: toNumOrNull(protein),
      carbs_g: toNumOrNull(carbs),
      fat_g: toNumOrNull(fat),
      serving_g: toNumOrNull(servingG),
      serving_label: servingLabel.trim() ? servingLabel.trim().slice(0, 64) : null,
      nutrients: Object.keys(cleanNutrients).length ? cleanNutrients : null,
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
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <NutritionLabelScanner
          onScanned={onLabelScanned}
          variant="ghost"
          label="Auto-fill from label"
        />
      </div>

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label>
          Serving size (g)
          <input
            type="number"
            min={0}
            max={100000}
            step="0.1"
            value={servingG}
            onChange={(e) => setServingG(e.target.value)}
            placeholder="e.g. 58"
            style={inputStyle}
          />
        </label>
        <label>
          Serving label
          <input
            type="text"
            maxLength={64}
            value={servingLabel}
            onChange={(e) => setServingLabel(e.target.value)}
            placeholder="e.g. 1 cup, 3 sticks"
            style={inputStyle}
          />
        </label>
      </div>

      <label>
        Calories (kcal) per serving
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

      <details
        style={{
          border: "1px solid #1e293b",
          borderRadius: 6,
          padding: 10,
          background: "#0b1220",
        }}
      >
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#cbd5e1" }}>
          Full nutrient panel ({Object.values(nutrients).filter((v) => v != null).length} set)
        </summary>
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            fontSize: 12,
          }}
        >
          {PANEL_ORDER.filter((k) => !MACRO_KEYS.has(k)).map((key) => {
            const meta = dv.meta[key];
            if (!meta) return null;
            return (
              <label key={key}>
                <span style={{ display: "block", color: "#94a3b8" }}>
                  {meta.label} ({meta.unit})
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nutrientToString(
                    (nutrients as Record<string, number | null | undefined>)[key],
                  )}
                  onChange={(e) => setNutrient(key, e.target.value)}
                  style={{ ...inputStyle, padding: "6px 8px", marginTop: 2, fontSize: 12 }}
                />
              </label>
            );
          })}
        </div>
      </details>

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
