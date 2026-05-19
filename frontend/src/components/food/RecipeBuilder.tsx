"use client";

import { useEffect, useMemo, useState } from "react";

import {
  useCreateFoodRecipe,
  useUpdateFoodRecipe,
  type RecipeIngredientInput,
} from "@/hooks/useFoodRecipes";
import { ApiError } from "@/lib/api";
import type { FoodRecipe, MealType } from "@/lib/schemas";

import { RecipeIngredientPicker } from "@/components/food/RecipeIngredientPicker";

const MEAL_OPTIONS: { label: string; value: MealType }[] = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Snack", value: "snack" },
];

interface Props {
  // When provided, the builder pre-fills from this existing recipe and
  // PATCHes on save. When null, a new recipe is created.
  existing: FoodRecipe | null;
  onClose: () => void;
}

interface DraftIngredient extends RecipeIngredientInput {
  // Stable client-side key for React reconciliation — the server-side `id`
  // doesn't exist yet on new rows.
  _key: string;
}

function newKey(): string {
  return `ing-${Math.random().toString(36).slice(2, 10)}`;
}

function toDraft(i: RecipeIngredientInput): DraftIngredient {
  return { ...i, _key: newKey() };
}

export function RecipeBuilder({ existing, onClose }: Props) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [yields, setYields] = useState<number>(
    existing ? Number(existing.yields_servings) : 1,
  );
  const [servingLabel, setServingLabel] = useState(existing?.serving_label ?? "");
  const [meal, setMeal] = useState<MealType | "">(existing?.meal_type ?? "");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(
    existing
      ? existing.ingredients.map((i) => ({
          name: i.name,
          brand: i.brand ?? null,
          provider: i.provider ?? null,
          provider_id: i.provider_id ?? null,
          quantity: Number(i.quantity),
          unit: i.unit,
          serving_g: i.serving_g ?? null,
          serving_label: i.serving_label ?? null,
          kcal: i.kcal,
          protein_g: i.protein_g ?? null,
          carbs_g: i.carbs_g ?? null,
          fat_g: i.fat_g ?? null,
          nutrients: i.nutrients ?? null,
          _key: newKey(),
        }))
      : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateFoodRecipe();
  const update = useUpdateFoodRecipe();
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pickerOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pickerOpen]);

  const totals = useMemo(() => {
    let kcal = 0;
    let p = 0;
    let c = 0;
    let f = 0;
    let pAny = false;
    let cAny = false;
    let fAny = false;
    for (const i of ingredients) {
      kcal += i.kcal;
      if (i.protein_g != null) {
        p += i.protein_g;
        pAny = true;
      }
      if (i.carbs_g != null) {
        c += i.carbs_g;
        cAny = true;
      }
      if (i.fat_g != null) {
        f += i.fat_g;
        fAny = true;
      }
    }
    return {
      kcal,
      protein_g: pAny ? Math.round(p * 10) / 10 : null,
      carbs_g: cAny ? Math.round(c * 10) / 10 : null,
      fat_g: fAny ? Math.round(f * 10) / 10 : null,
    };
  }, [ingredients]);

  const perServingKcal =
    yields > 0 ? Math.round(totals.kcal / yields) : totals.kcal;

  function addIngredient(i: RecipeIngredientInput) {
    setIngredients((prev) => [...prev, toDraft(i)]);
    setPickerOpen(false);
  }

  function removeIngredient(key: string) {
    setIngredients((prev) => prev.filter((i) => i._key !== key));
  }

  function move(key: string, delta: number) {
    setIngredients((prev) => {
      const idx = prev.findIndex((i) => i._key === key);
      if (idx === -1) return prev;
      const next = idx + delta;
      if (next < 0 || next >= prev.length) return prev;
      const a = prev[idx];
      const b = prev[next];
      if (!a || !b) return prev;
      const out = [...prev];
      out[idx] = b;
      out[next] = a;
      return out;
    });
  }

  async function save() {
    setError(null);
    if (!label.trim()) {
      setError("Recipe needs a name.");
      return;
    }
    if (yields <= 0) {
      setError("Yields must be > 0.");
      return;
    }
    if (ingredients.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    const payload = {
      label: label.trim(),
      yields_servings: yields,
      serving_label: servingLabel.trim() || null,
      meal_type: meal === "" ? null : meal,
      sort_order: existing?.sort_order ?? 0,
      ingredients: ingredients.map(({ _key: _ignored, ...rest }) => rest),
    };
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { detail?: string } | null;
        setError(body?.detail ?? `Save failed (${err.status}).`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Save failed.");
      }
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Recipe builder" style={overlay}>
      <div style={panel}>
        <header style={hdr}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>
            {existing ? "Edit recipe" : "New recipe"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "none",
              fontSize: 20,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label>
            <span style={fieldLabel}>Recipe name</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My scrambled eggs"
              style={input}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>
              <span style={fieldLabel}>Yields (servings)</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setYields((y) => Math.max(0.25, +(y - 1).toFixed(2)))}
                  style={stepper}
                  aria-label="One serving less"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0.25}
                  step={1}
                  value={yields}
                  onChange={(e) => setYields(Number(e.target.value) || yields)}
                  style={{ ...input, textAlign: "center" }}
                />
                <button
                  type="button"
                  onClick={() => setYields((y) => +(y + 1).toFixed(2))}
                  style={stepper}
                  aria-label="One serving more"
                >
                  +
                </button>
              </div>
            </label>
            <label>
              <span style={fieldLabel}>Serving label (optional)</span>
              <input
                type="text"
                value={servingLabel}
                onChange={(e) => setServingLabel(e.target.value)}
                placeholder="bowl, plate, slice"
                style={input}
              />
            </label>
          </div>

          <label>
            <span style={fieldLabel}>Meal (optional)</span>
            <select
              value={meal}
              onChange={(e) => setMeal((e.target.value as MealType) || "")}
              style={input}
            >
              <option value="">—</option>
              {MEAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={fieldLabel}>Ingredients</span>
              <button type="button" onClick={() => setPickerOpen(true)} style={linkBtn}>
                + Add ingredient
              </button>
            </div>
            {ingredients.length === 0 ? (
              <p style={{ fontSize: 12, color: "#64748b" }}>
                No ingredients yet. Tap “Add ingredient” to start.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {ingredients.map((i, idx) => (
                  <li
                    key={i._key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: 8,
                      background: "#0b1220",
                      border: "1px solid #1e293b",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{i.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        {fmtQty(i.quantity, i.unit)} · {i.kcal} kcal
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => move(i._key, -1)}
                      disabled={idx === 0}
                      style={iconBtn(idx === 0)}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i._key, 1)}
                      disabled={idx === ingredients.length - 1}
                      style={iconBtn(idx === ingredients.length - 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIngredient(i._key)}
                      style={iconBtn(false)}
                      aria-label="Remove ingredient"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {ingredients.length > 0 ? (
            <div
              style={{
                padding: 10,
                background: "#0b1220",
                border: "1px solid #1e293b",
                borderRadius: 6,
                fontSize: 13,
                color: "#cbd5e1",
              }}
            >
              Total: {totals.kcal} kcal · P {fmt(totals.protein_g)} · C{" "}
              {fmt(totals.carbs_g)} · F {fmt(totals.fat_g)}
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Serves {yields} · {perServingKcal} kcal per serving
              </div>
            </div>
          ) : null}

          {error ? (
            <div style={{ fontSize: 13, color: "#fca5a5" }}>{error}</div>
          ) : null}

          <button type="button" onClick={save} disabled={busy} style={primary(busy)}>
            {busy ? "Saving…" : existing ? "Save changes" : "Save recipe"}
          </button>
        </div>
      </div>

      {pickerOpen ? (
        <RecipeIngredientPicker
          onAdd={addIngredient}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v >= 10 ? `${Math.round(v)}g` : `${v.toFixed(1)}g`;
}

function fmtQty(quantity: number, unit: "g" | "ml" | "serving"): string {
  if (unit === "serving") return `${quantity}× serving`;
  return `${quantity} ${unit === "ml" ? "mL" : "g"}`;
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 55,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
};

const panel: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: 16,
  width: "100%",
  maxWidth: 560,
  maxHeight: "90vh",
  overflowY: "auto",
};

const hdr: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
};

const stepper: React.CSSProperties = {
  width: 36,
  height: 36,
  fontSize: 18,
  background: "#1e293b",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

const linkBtn: React.CSSProperties = {
  fontSize: 12,
  color: "#10b981",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    background: "transparent",
    color: disabled ? "#475569" : "#cbd5e1",
    border: "1px solid #1e293b",
    borderRadius: 4,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
  };
}

function primary(disabled: boolean): React.CSSProperties {
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
