"use client";

import { useMemo, useState } from "react";

import { PANEL_ORDER } from "@/lib/canadianDV";
import { useDailyValues } from "@/hooks/useDailyValues";
import { scaleValues } from "@/lib/foodScaling";
import type { FoodUnit, LabelScanOut, MealType, NutrientPanel } from "@/lib/schemas";

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
  unit: FoodUnit;
  nutrients: NutrientPanel;
  meal_type: MealType;
};

// Macros live on typed columns, not in the JSONB nutrient panel.
const MACRO_KEYS = ["protein_g", "carbs_g", "fat_g"] as const;
// The combined sat+trans value is auto-derived backend-side (canadian_dv.py)
// for DV math. Canadian labels list saturated and trans on separate lines, so
// asking the user to fill a combined input here just creates a blank row that
// never gets touched. Hide it.
const HIDDEN_PANEL_KEYS = new Set<string>(["saturated_trans_g"]);

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
  const [protein, setProtein] = useState<string>(
    parsed.protein_g != null ? String(parsed.protein_g) : "",
  );
  const [carbs, setCarbs] = useState<string>(
    parsed.carbs_g != null ? String(parsed.carbs_g) : "",
  );
  const [fat, setFat] = useState<string>(parsed.fat_g != null ? String(parsed.fat_g) : "");
  const [servingG, setServingG] = useState<number | "">(parsed.serving_g ?? "");
  const [servingLabel, setServingLabel] = useState(parsed.serving_label ?? "");
  const [unit, setUnit] = useState<FoodUnit>(parsed.unit ?? "g");
  const [nutrients, setNutrients] = useState<NutrientPanel>(parsed.nutrients);
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [showRaw, setShowRaw] = useState(false);
  const [rescaleOpen, setRescaleOpen] = useState(false);
  const [rescaleTarget, setRescaleTarget] = useState<string>("");

  // Track which fields came pre-filled from the parser, so we can show a
  // small "from label" hint on those rows. Cleared field-by-field once the
  // user types anything new — anything they touched is "theirs", not OCR's.
  const parsedFromLabel = useMemo(() => {
    const s = new Set<string>();
    if (parsed.kcal != null) s.add("kcal");
    if (parsed.serving_g != null) s.add("serving_g");
    if (parsed.serving_label) s.add("serving_label");
    if (parsed.protein_g != null) s.add("protein_g");
    if (parsed.carbs_g != null) s.add("carbs_g");
    if (parsed.fat_g != null) s.add("fat_g");
    for (const [k, v] of Object.entries(parsed.nutrients)) {
      if (v != null) s.add(k);
    }
    return s;
  }, [parsed]);

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
      unit,
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

  function applyRescale() {
    const targetNum = Number(rescaleTarget);
    const current = servingG === "" ? null : Number(servingG);
    if (!current || !Number.isFinite(targetNum) || targetNum <= 0) return;
    const ratio = targetNum / current;
    const scaled = scaleValues(
      { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, nutrients },
      ratio,
    );
    setKcal(scaled.kcal);
    setProtein(scaled.protein_g);
    setCarbs(scaled.carbs_g);
    setFat(scaled.fat_g);
    setNutrients(scaled.nutrients);
    setServingG(targetNum);
    setRescaleOpen(false);
    setRescaleTarget("");
  }

  const canSave = name.trim().length > 0 && kcal !== "" && !busy;
  const unitLabel = unit === "ml" ? "mL" : "g";
  const parsedNutrientCount = Object.values(parsed.nutrients).filter((v) => v != null).length;
  const filledNutrientCount = Object.values(nutrients).filter((v) => v != null).length;
  const panelOpen = parsedNutrientCount > 0 || filledNutrientCount > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--wq-text-2)", margin: 0 }}>
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
            border: "1px solid var(--wq-surface-2)",
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <label>
          <span style={fieldLabel}>
            Serving size ({unitLabel})
            {parsedFromLabel.has("serving_g") ? (
              <span style={fromLabelChip}> · from label</span>
            ) : null}
          </span>
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
          <span style={fieldLabel}>Unit</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as FoodUnit)}
            style={inputStyle}
          >
            <option value="g">g</option>
            <option value="ml">mL</option>
          </select>
        </label>
        <label>
          <span style={fieldLabel}>Label</span>
          <input
            value={servingLabel}
            maxLength={64}
            placeholder="1 cup"
            onChange={(e) => setServingLabel(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setRescaleOpen((v) => !v)} style={linkBtn}>
          {rescaleOpen ? "Cancel rescale" : "Rescale all values to a different portion…"}
        </button>
      </div>

      {rescaleOpen ? (
        <div style={rescaleBox}>
          <p style={{ fontSize: 12, color: "var(--wq-muted)", margin: 0 }}>
            Current: {servingG === "" ? "—" : `${servingG} ${unitLabel}`}
            {kcal !== "" ? ` · ${kcal} kcal` : ""}
            {protein.trim() ? ` · P ${protein}` : ""}
            {carbs.trim() ? ` · C ${carbs}` : ""}
            {fat.trim() ? ` · F ${fat}` : ""}
            {filledNutrientCount ? ` · ${filledNutrientCount} nutrients` : ""}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label style={{ flex: 1 }}>
              <span style={fieldLabel}>New serving size ({unitLabel})</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={rescaleTarget}
                onChange={(e) => setRescaleTarget(e.target.value)}
                placeholder={servingG === "" ? "" : String(servingG)}
                style={inputStyle}
              />
            </label>
            <button
              type="button"
              onClick={applyRescale}
              disabled={!servingG || !Number(rescaleTarget)}
              style={primaryBtn(!servingG || !Number(rescaleTarget))}
            >
              Rescale
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--wq-muted-2)", margin: 0 }}>
            Multiplies kcal, macros, and all nutrient values by the new/old ratio.
          </p>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <label>
          <span style={fieldLabel}>
            Calories
            {parsedFromLabel.has("kcal") ? <span style={fromLabelChip}> ✓</span> : null}
          </span>
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
          <span style={fieldLabel}>
            Protein (g)
            {parsedFromLabel.has("protein_g") ? (
              <span style={fromLabelChip}> ✓</span>
            ) : null}
          </span>
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
          <span style={fieldLabel}>
            Carbs (g)
            {parsedFromLabel.has("carbs_g") ? <span style={fromLabelChip}> ✓</span> : null}
          </span>
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
          <span style={fieldLabel}>
            Fat (g)
            {parsedFromLabel.has("fat_g") ? <span style={fromLabelChip}> ✓</span> : null}
          </span>
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
        open={panelOpen}
        style={{
          border: "1px solid var(--wq-surface-2)",
          borderRadius: 6,
          padding: 10,
          background: "var(--wq-bg)",
        }}
      >
        <summary style={{ cursor: "pointer", color: "var(--wq-text-2)", fontSize: 13 }}>
          Nutrients ({parsedNutrientCount} read from label · {filledNutrientCount} set)
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
            (k) =>
              k !== "kcal" &&
              !MACRO_KEYS.includes(k as (typeof MACRO_KEYS)[number]) &&
              !HIDDEN_PANEL_KEYS.has(k),
          ).map((key) => {
            const meta = dv.meta[key];
            if (!meta) return null;
            const value = nutrients[key as keyof NutrientPanel] ?? "";
            return (
              <label key={key}>
                <span style={{ display: "block", color: "var(--wq-muted)" }}>
                  {meta.label} ({meta.unit})
                  {parsedFromLabel.has(key) ? (
                    <span style={fromLabelChip}> ✓</span>
                  ) : null}
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
          color: "var(--wq-muted-2)",
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
            background: "var(--wq-bg)",
            border: "1px solid var(--wq-surface-2)",
            borderRadius: 6,
            padding: 8,
            fontSize: 11,
            color: "var(--wq-muted-2)",
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
  color: "var(--wq-muted)",
  marginBottom: 4,
};

const fromLabelChip: React.CSSProperties = {
  color: "var(--wq-accent)",
  fontWeight: 600,
};

const hintStyle: React.CSSProperties = {
  color: "var(--wq-muted-2)",
  fontWeight: "normal",
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--wq-bg)",
  border: "1px solid var(--wq-surface-2)",
  borderRadius: 6,
  color: "var(--wq-text)",
  fontSize: 14,
};

const linkBtn: React.CSSProperties = {
  alignSelf: "flex-start",
  background: "transparent",
  border: "none",
  color: "var(--wq-accent)",
  fontSize: 12,
  cursor: "pointer",
  padding: 0,
};

const rescaleBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  background: "var(--wq-bg)",
  border: "1px solid var(--wq-surface-2)",
  borderRadius: 6,
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "var(--wq-surface-2)" : "var(--wq-accent)",
    color: disabled ? "var(--wq-muted-2)" : "white",
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
    color: disabled ? "var(--wq-muted-2)" : "var(--wq-accent)",
    border: "1px solid var(--wq-accent)",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--wq-muted)",
  border: "1px solid var(--wq-surface-2)",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 14,
  cursor: "pointer",
};
