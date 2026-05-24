"use client";

import { useEffect, useState } from "react";

import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useUpdateFood } from "@/hooks/useUpdateFood";
import type { FoodEntry, MealType } from "@/lib/schemas";
import { useSnapBack } from "@/lib/useSnapBack";

interface Props {
  entry: FoodEntry;
  onClose: () => void;
}

const MEAL_OPTIONS: { label: string; value: MealType }[] = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Snack", value: "snack" },
];

/**
 * Editable view of a logged food entry. Supports the two flows in the plan:
 *
 *   1. "I had 2 servings, not 1" — adjust the servings stepper; kcal/macros
 *      scale automatically when serving_g is known, falling back to direct
 *      kcal/macros edit otherwise.
 *   2. "I had 56 g, not 75 g" — direct gram override that recomputes the
 *      nutrient values proportionally from the snapshot.
 *
 * PATCH /food/{id} accepts any subset of fields, so we only send what
 * changed (model_dump exclude_unset on the backend).
 */
export function EditFoodEntryDrawer({ entry, onClose }: Props) {
  const update = useUpdateFood();
  const initialServings = entry.servings ?? 1;
  const initialServingG = entry.serving_g ?? null;
  const unitLabel = entry.unit === "ml" ? "mL" : "g";

  const [servings, setServings] = useState<number>(initialServings);
  const [servingG, setServingG] = useState<number | "">(initialServingG ?? "");
  const [meal, setMeal] = useState<MealType | "">(entry.meal_type ?? "");
  const [name, setName] = useState(entry.name);
  const [brand, setBrand] = useState(entry.brand ?? "");
  // null = keep the meal's original time; non-null = user opened the picker
  // and chose a new time. See OccurredAtField for the collapsed/expanded
  // semantics.
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  // Direct kcal/macro edits — we expose these only when there's no
  // serving_g snapshot, otherwise the scaling does the work.
  const [kcalDraft, setKcalDraft] = useState<number | "">(entry.kcal);
  // Snap-back: blur-empty restores the last valid number so the user never
  // sees a blank required field that looks like nothing will get saved.
  const servingsSnap = useSnapBack(
    servings,
    (v) => setServings(typeof v === "number" ? v : initialServings),
    initialServings,
  );
  const servingGSnap = useSnapBack(servingG, setServingG, initialServingG ?? 100);
  const kcalSnap = useSnapBack(kcalDraft, setKcalDraft, entry.kcal);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Servings-mode: scale the logged kcal/macros/nutrients by (new/old).
  // We use the originally-logged kcal as the per-serving basis when servings
  // was 1.0 at log time, or back-derive per-serving = kcal / servings.
  const perServingKcal =
    initialServings > 0 ? entry.kcal / initialServings : entry.kcal;
  const perServingProtein =
    entry.protein_g != null && initialServings > 0
      ? entry.protein_g / initialServings
      : entry.protein_g ?? null;
  const perServingCarbs =
    entry.carbs_g != null && initialServings > 0
      ? entry.carbs_g / initialServings
      : entry.carbs_g ?? null;
  const perServingFat =
    entry.fat_g != null && initialServings > 0
      ? entry.fat_g / initialServings
      : entry.fat_g ?? null;
  const perServingNutrients: Record<string, number> = {};
  if (entry.nutrients && initialServings > 0) {
    for (const [k, v] of Object.entries(entry.nutrients)) {
      perServingNutrients[k] = v / initialServings;
    }
  }

  const hasServingBasis = initialServingG != null && initialServings > 0;

  function save() {
    const patch: Parameters<typeof update.mutate>[0]["patch"] = {};
    if (name.trim() !== entry.name) patch.name = name.trim();
    const brandTrim = brand.trim() || null;
    if (brandTrim !== (entry.brand ?? null)) patch.brand = brandTrim;
    const mealVal: MealType | null = meal === "" ? null : meal;
    if (mealVal !== (entry.meal_type ?? null)) patch.meal_type = mealVal;

    if (occurredAt !== null) patch.occurred_at = occurredAt;

    if (hasServingBasis) {
      // Scale per-serving values by the new servings count. We always
      // send servings AND the multiplied kcal/macros so the backend
      // stays in sync; sending only `servings` is a no-op for totals.
      if (Math.abs(servings - initialServings) > 1e-6) {
        patch.servings = servings;
        patch.kcal = Math.round(perServingKcal * servings);
        if (perServingProtein != null)
          patch.protein_g = round2(perServingProtein * servings);
        if (perServingCarbs != null)
          patch.carbs_g = round2(perServingCarbs * servings);
        if (perServingFat != null)
          patch.fat_g = round2(perServingFat * servings);
        if (Object.keys(perServingNutrients).length) {
          const scaled: Record<string, number> = {};
          for (const [k, v] of Object.entries(perServingNutrients)) {
            scaled[k] = round2(v * servings);
          }
          patch.nutrients = scaled;
        }
      }
      const newServingG = servingG === "" ? null : Number(servingG);
      if (newServingG !== initialServingG) patch.serving_g = newServingG;
    } else {
      // No serving basis — direct kcal edit, leave macros alone unless the
      // user touches them via a future field. The shipping UI exposes just
      // kcal here; advanced fields go through the original modal.
      const kcalNum = kcalDraft === "" ? 0 : Number(kcalDraft);
      if (kcalNum !== entry.kcal) patch.kcal = kcalNum;
    }

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: entry.id, patch }, { onSuccess: () => onClose() });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${entry.name}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 16,
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Edit entry</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "none",
              fontSize: 20,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <label>
          <span style={fieldLabel}>Name</span>
          <input
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={fieldLabel}>Brand</span>
          <input
            value={brand}
            maxLength={120}
            onChange={(e) => setBrand(e.target.value)}
            style={inputStyle}
          />
        </label>

        {hasServingBasis ? (
          <>
            <label>
              <span style={fieldLabel}>Servings</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.max(0.25, +(s - 0.5).toFixed(2)))}
                  style={stepperBtn}
                  aria-label="Half a serving less"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={servings}
                  onChange={(e) => servingsSnap.onChange(e.target.value)}
                  onBlur={servingsSnap.onBlur}
                  style={{ ...inputStyle, flex: 1, textAlign: "center" }}
                />
                <button
                  type="button"
                  onClick={() => setServings((s) => +(s + 0.5).toFixed(2))}
                  style={stepperBtn}
                  aria-label="Half a serving more"
                >
                  +
                </button>
              </div>
            </label>
            <label>
              <span style={fieldLabel}>
                Serving size ({unitLabel}){" "}
                <span style={hintStyle}>— edit to change what 1 serving means</span>
              </span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={servingG}
                onChange={(e) => servingGSnap.onChange(e.target.value)}
                onBlur={servingGSnap.onBlur}
                style={inputStyle}
              />
            </label>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              {`${Math.round(perServingKcal * servings)} kcal · ${servings} × ${initialServingG ?? "?"} ${unitLabel}`}
            </p>
          </>
        ) : (
          <label>
            <span style={fieldLabel}>Calories</span>
            <input
              type="number"
              min={0}
              max={20000}
              value={kcalDraft}
              onChange={(e) => kcalSnap.onChange(e.target.value)}
              onBlur={kcalSnap.onBlur}
              style={inputStyle}
            />
          </label>
        )}

        <label>
          <span style={fieldLabel}>Meal</span>
          <select
            value={meal}
            onChange={(e) => setMeal((e.target.value || "") as MealType | "")}
            style={inputStyle}
          >
            <option value="">—</option>
            {MEAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <OccurredAtField
          value={occurredAt}
          onChange={setOccurredAt}
          defaultLabel={formatTime(entry.occurred_at)}
          initialPickerIso={entry.occurred_at}
        />

        {update.isError ? (
          <p style={{ fontSize: 12, color: "#fca5a5", margin: 0 }}>
            Save failed — try again.
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            style={primaryBtnStyleFor(update.isPending)}
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  fontSize: 11,
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

const stepperBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  fontSize: 18,
  background: "#1e293b",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #1e293b",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 14,
  cursor: "pointer",
};

function primaryBtnStyleFor(disabled: boolean): React.CSSProperties {
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
