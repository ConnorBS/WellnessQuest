"use client";

import { useState } from "react";

import { PANEL_ORDER } from "@/lib/canadianDV";
import { useDailyValues } from "@/hooks/useDailyValues";
import type { LabelScanOut, MealType, NutrientPanel } from "@/lib/schemas";

interface Props {
  parsed: LabelScanOut;
  imageUrl?: string | null;
  defaultMeal: MealType;
  onCancel: () => void;
  onSave: (values: ReviewedLabel) => void;
  onSaveAndLog?: (values: ReviewedLabel) => void;
  busy?: boolean;
}

export type ReviewedLabel = {
  name: string;
  brand: string | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  serving_g: number | null;
  serving_label: string | null;
  nutrients: NutrientPanel;
  meal_type: MealType;
};

const MACRO_KEYS = ["protein_g", "carbs_g", "fat_g"] as const;

/**
 * Editable form pre-filled with OCR results. Per the plan, every scan goes
 * through this screen — we never silently insert what the parser returned,
 * because Tesseract on a real-world phone photo will miss fields. The user
 * confirms / fills blanks; THEN we hit /food or /food/presets.
 */
export function ParsedLabelReview({
  parsed,
  imageUrl,
  defaultMeal,
  onCancel,
  onSave,
  onSaveAndLog,
  busy,
}: Props) {
  const { data: dv } = useDailyValues();
  const [name, setName] = useState(parsed.name ?? "");
  const [brand, setBrand] = useState(parsed.brand ?? "");
  const [kcal, setKcal] = useState<number | "">(parsed.kcal ?? "");
  const [protein, setProtein] = useState<string>("");
  const [carbs, setCarbs] = useState<string>("");
  const [fat, setFat] = useState<string>("");
  const [servingG, setServingG] = useState<number | "">(parsed.serving_g ?? "");
  const [servingLabel, setServingLabel] = useState(parsed.serving_label ?? "");
  const [nutrients, setNutrients] = useState<NutrientPanel>(parsed.nutrients);
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [showRaw, setShowRaw] = useState(false);

  function build(): ReviewedLabel | null {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const kcalNum = kcal === "" ? 0 : Number(kcal);
    if (Number.isNaN(kcalNum) || kcalNum < 0) return null;
    return {
      name: trimmedName,
      brand: brand.trim() || null,
      kcal: Math.round(kcalNum),
      protein_g: toNumOrNull(protein),
      carbs_g: toNumOrNull(carbs),
      fat_g: toNumOrNull(fat),
      serving_g: servingG === "" ? null : Number(servingG),
      serving_label: servingLabel.trim() || null,
      nutrients,
      meal_type: meal,
    };
  }

  function setNutrient(key: keyof NutrientPanel, raw: string) {
    setNutrients((prev) => ({
      ...prev,
      [key]: raw === "" ? null : Number(raw),
    }));
  }

  const canSave = name.trim().length > 0 && kcal !== "" && !busy;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "#cbd5e1", margin: 0 }}>
        Review the values we read from your label and fix anything that looks off.
        OCR isn&apos;t perfect — your edits are what we save.
      </p>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Scanned nutrition label"
          style={{
            maxHeight: 160,
            objectFit: "contain",
            borderRadius: 6,
            border: "1px solid #1e293b",
            alignSelf: "flex-start",
          }}
        />
      ) : null}

      <label>
        <span style={fieldLabel}>Name</span>
        <input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Oatmeal Crisp"
          style={inputStyle}
        />
      </label>

      <label>
        <span style={fieldLabel}>
          Brand <span style={hintStyle}>(optional)</span>
        </span>
        <input
          value={brand}
          maxLength={120}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Quaker"
          style={inputStyle}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label>
          <span style={fieldLabel}>Serving size (g)</span>
          <input
            type="number"
            min={0}
            max={100000}
            step={0.1}
            value={servingG}
            onChange={(e) =>
              setServingG(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={inputStyle}
          />
        </label>
        <label>
          <span style={fieldLabel}>Serving label</span>
          <input
            value={servingLabel}
            maxLength={64}
            placeholder="e.g. 1 cup, 3 sticks"
            onChange={(e) => setServingLabel(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <label>
          <span style={fieldLabel}>Calories</span>
          <input
            type="number"
            min={0}
            max={20000}
            value={kcal}
            onChange={(e) =>
              setKcal(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={inputStyle}
          />
        </label>
        <label>
          <span style={fieldLabel}>Protein (g)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={fieldLabel}>Carbs (g)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={fieldLabel}>Fat (g)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label>
        <span style={fieldLabel}>Meal</span>
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value as MealType)}
          style={inputStyle}
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </label>

      <details
        style={{
          border: "1px solid #1e293b",
          borderRadius: 6,
          padding: 10,
          background: "#0b1220",
        }}
      >
        <summary style={{ cursor: "pointer", color: "#cbd5e1", fontSize: 13 }}>
          Nutrients (
          {Object.values(nutrients).filter((v) => v != null).length} read from label
          )
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
          {PANEL_ORDER.filter(
            (k) => k !== "kcal" && !MACRO_KEYS.includes(k as (typeof MACRO_KEYS)[number]),
          ).map((key) => {
            const meta = dv.meta[key];
            if (!meta) return null;
            const value = nutrients[key as keyof NutrientPanel] ?? "";
            return (
              <label key={key}>
                <span style={{ display: "block", color: "#94a3b8" }}>
                  {meta.label} ({meta.unit})
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={value === null ? "" : value}
                  onChange={(e) =>
                    setNutrient(key as keyof NutrientPanel, e.target.value)
                  }
                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
                />
              </label>
            );
          })}
        </div>
      </details>

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          color: "#64748b",
          fontSize: 12,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {showRaw ? "Hide" : "Show"} raw OCR text ({parsed.language})
      </button>
      {showRaw ? (
        <pre
          style={{
            background: "#020617",
            border: "1px solid #1e293b",
            borderRadius: 6,
            padding: 8,
            fontSize: 11,
            color: "#64748b",
            maxHeight: 160,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {parsed.raw_text || "(empty)"}
        </pre>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onSaveAndLog ? (
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              const v = build();
              if (v) onSaveAndLog(v);
            }}
            style={primaryBtn(!canSave)}
          >
            Save & log 1 serving
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            const v = build();
            if (v) onSave(v);
          }}
          style={secondaryBtn(!canSave)}
        >
          Save as quick food
        </button>
        <button type="button" onClick={onCancel} style={ghostBtn}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function toNumOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
};

const hintStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: "normal",
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#1e293b" : "#10b981",
    color: disabled ? "#64748b" : "white",
    border: "none",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: disabled ? "#64748b" : "#10b981",
    border: "1px solid #10b981",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #1e293b",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 14,
  cursor: "pointer",
};
