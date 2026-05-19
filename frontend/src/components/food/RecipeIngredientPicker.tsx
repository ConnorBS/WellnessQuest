"use client";

import { useMemo, useState } from "react";

import { useFoodPresets } from "@/hooks/useFoodPresets";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import {
  resolvePortion,
  type IngredientUnit,
  type PerHundredSource,
} from "@/lib/food/portionMath";
import type { FoodPreset, FoodSearchHit } from "@/lib/schemas";

import type { RecipeIngredientInput } from "@/hooks/useFoodRecipes";

type Tab = "search" | "presets" | "manual";

interface Props {
  onAdd: (ingredient: RecipeIngredientInput) => void;
  onClose: () => void;
}

// Convert a stored preset (per-serving nutrients in `nutrients` field) into
// the per-100 shape `resolvePortion` expects. We back-compute per-100 from
// per-serving / serving_g so the same unit picker (g/ml/serving) works.
function presetToPer100(p: FoodPreset): PerHundredSource | null {
  const sg = p.serving_g;
  if (!sg || sg <= 0) return null;
  const factor = 100 / sg;
  const scale = (v: number | null | undefined) => (v == null ? null : v * factor);
  const nut: Record<string, number> | null = p.nutrients
    ? Object.fromEntries(
        Object.entries(p.nutrients).map(([k, v]) => [k, v * factor]),
      )
    : null;
  return {
    unit: "g",
    kcal_per_100g: scale(p.kcal),
    protein_per_100g: scale(p.protein_g),
    carbs_per_100g: scale(p.carbs_g),
    fat_per_100g: scale(p.fat_g),
    nutrients_per_100g: nut,
  };
}

export function RecipeIngredientPicker({ onAdd, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState<FoodSearchHit | null>(null);
  const [preset, setPreset] = useState<FoodPreset | null>(null);
  // Portion spec shared across all three tabs.
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<IngredientUnit>("serving");
  const [servingG, setServingG] = useState<number>(0);
  // Manual-entry fields.
  const [mName, setMName] = useState("");
  const [mKcal, setMKcal] = useState<number | "">("");
  const [mProtein, setMProtein] = useState<number | "">("");
  const [mCarbs, setMCarbs] = useState<number | "">("");
  const [mFat, setMFat] = useState<number | "">("");

  const search = useFoodSearch(query, tab === "search" && query.trim().length >= 2);
  const presets = useFoodPresets();

  function selectHit(h: FoodSearchHit) {
    setHit(h);
    setPreset(null);
    if (h.serving_g) {
      setUnit("serving");
      setServingG(h.serving_g);
    } else {
      setUnit(h.unit === "ml" ? "ml" : "g");
      setServingG(0);
    }
    setQuantity(1);
  }

  function selectPreset(p: FoodPreset) {
    setPreset(p);
    setHit(null);
    if (p.serving_g) {
      setUnit("serving");
      setServingG(p.serving_g);
    } else {
      // Preset with no serving definition — treat 1 "serving" = the preset's
      // raw kcal/macros. We hand-roll the math in the manual ingredient path
      // for that case below in buildSearchOrPreset.
      setUnit("serving");
      setServingG(0);
    }
    setQuantity(1);
  }

  const source: PerHundredSource | null = hit
    ? hit
    : preset
      ? presetToPer100(preset)
      : null;

  const preview = useMemo(() => {
    if (!source) return null;
    return resolvePortion(source, { quantity, unit, servingG });
  }, [source, quantity, unit, servingG]);

  function buildSearchOrPreset(): RecipeIngredientInput | null {
    if (!source || !preview) return null;
    const name = hit?.name ?? preset?.label ?? "";
    const brand = hit?.brand ?? preset?.brand ?? null;
    const provider = hit?.provider ?? (preset ? "preset" : null);
    const provider_id = hit?.provider_id ?? (preset ? preset.id : null);
    // Preset without serving_g: skip the per-100 round-trip — just use the
    // preset's stored per-serving values directly.
    if (preset && (!preset.serving_g || preset.serving_g <= 0)) {
      return {
        name,
        brand,
        provider,
        provider_id,
        quantity,
        unit: "serving",
        serving_g: null,
        serving_label: preset.serving_label ?? null,
        kcal: Math.round((preset.kcal ?? 0) * quantity),
        protein_g:
          preset.protein_g == null
            ? null
            : Math.round(preset.protein_g * quantity * 100) / 100,
        carbs_g:
          preset.carbs_g == null
            ? null
            : Math.round(preset.carbs_g * quantity * 100) / 100,
        fat_g:
          preset.fat_g == null
            ? null
            : Math.round(preset.fat_g * quantity * 100) / 100,
        nutrients: preset.nutrients
          ? Object.fromEntries(
              Object.entries(preset.nutrients).map(([k, v]) => [
                k,
                Math.round(v * quantity * 1000) / 1000,
              ]),
            )
          : null,
      };
    }
    return {
      name,
      brand,
      provider,
      provider_id,
      quantity,
      unit,
      serving_g: unit === "serving" ? servingG : null,
      serving_label:
        hit?.serving_label ?? preset?.serving_label ?? null,
      kcal: preview.kcal ?? 0,
      protein_g: preview.protein_g,
      carbs_g: preview.carbs_g,
      fat_g: preview.fat_g,
      nutrients:
        Object.keys(preview.nutrients).length > 0 ? preview.nutrients : null,
    };
  }

  function buildManual(): RecipeIngredientInput | null {
    if (!mName.trim() || mKcal === "" || Number(mKcal) < 0) return null;
    return {
      name: mName.trim(),
      brand: null,
      provider: null,
      provider_id: null,
      quantity,
      unit,
      serving_g: unit === "serving" ? servingG || null : null,
      serving_label: null,
      kcal: Number(mKcal),
      protein_g: mProtein === "" ? null : Number(mProtein),
      carbs_g: mCarbs === "" ? null : Number(mCarbs),
      fat_g: mFat === "" ? null : Number(mFat),
      nutrients: null,
    };
  }

  function submit() {
    const ing = tab === "manual" ? buildManual() : buildSearchOrPreset();
    if (!ing) return;
    onAdd(ing);
  }

  const canSubmit =
    (tab !== "manual" && source != null) ||
    (tab === "manual" && mName.trim().length > 0 && mKcal !== "");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add ingredient"
      onClick={onClose}
      style={overlayStyle}
    >
      <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
        <header style={headerStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Add ingredient</h3>
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

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button type="button" onClick={() => setTab("search")} style={tabStyle(tab === "search")}>
            Search
          </button>
          <button
            type="button"
            onClick={() => setTab("presets")}
            style={tabStyle(tab === "presets")}
          >
            Quick foods
          </button>
          <button type="button" onClick={() => setTab("manual")} style={tabStyle(tab === "manual")}>
            Manual
          </button>
        </div>

        {tab === "search" ? (
          <>
            <input
              type="search"
              placeholder="Search Open Food Facts (e.g. egg)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHit(null);
              }}
              style={inputStyle}
            />
            {query.trim().length < 2 ? (
              <p style={hint}>Type at least 2 characters.</p>
            ) : search.isLoading ? (
              <p style={hint}>Searching…</p>
            ) : search.data && search.data.hits.length > 0 ? (
              <ul style={listStyle}>
                {search.data.hits.slice(0, 12).map((h) => {
                  const sel =
                    hit?.provider === h.provider &&
                    hit?.provider_id === h.provider_id;
                  return (
                    <li key={`${h.provider}-${h.provider_id}`}>
                      <button
                        type="button"
                        onClick={() => selectHit(h)}
                        style={hitBtn(sel)}
                      >
                        <div style={{ fontSize: 13 }}>
                          {h.name}
                          {h.brand ? (
                            <span style={{ color: "#64748b" }}> · {h.brand}</span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : search.data ? (
              <p style={hint}>No matches.</p>
            ) : null}
          </>
        ) : tab === "presets" ? (
          <>
            {presets.isLoading ? (
              <p style={hint}>Loading…</p>
            ) : presets.data && presets.data.length > 0 ? (
              <ul style={listStyle}>
                {presets.data.map((p) => {
                  const sel = preset?.id === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => selectPreset(p)}
                        style={hitBtn(sel)}
                      >
                        <div style={{ fontSize: 13 }}>
                          {p.label}
                          {p.brand ? (
                            <span style={{ color: "#64748b" }}> · {p.brand}</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {p.kcal} kcal
                          {p.serving_label ? ` · ${p.serving_label}` : ""}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={hint}>No quick foods yet. Create one from the Log Food modal.</p>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label>
              <span style={fieldLabel}>Name</span>
              <input
                type="text"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={fieldLabel}>Calories (kcal)</span>
              <input
                type="number"
                min={0}
                max={20000}
                value={mKcal}
                onChange={(e) =>
                  setMKcal(e.target.value === "" ? "" : Number(e.target.value))
                }
                style={inputStyle}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <label>
                <span style={fieldLabel}>Protein (g)</span>
                <input
                  type="number"
                  min={0}
                  value={mProtein}
                  onChange={(e) =>
                    setMProtein(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={fieldLabel}>Carbs (g)</span>
                <input
                  type="number"
                  min={0}
                  value={mCarbs}
                  onChange={(e) =>
                    setMCarbs(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={fieldLabel}>Fat (g)</span>
                <input
                  type="number"
                  min={0}
                  value={mFat}
                  onChange={(e) =>
                    setMFat(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </label>
            </div>
          </div>
        )}

        {/* Portion selector — common across tabs */}
        {(tab !== "manual" && source) || tab === "manual" ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: "#0b1220",
              border: "1px solid #1e293b",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>
                <span style={fieldLabel}>Quantity</span>
                <input
                  type="number"
                  min={0}
                  step={unit === "serving" ? 0.25 : 1}
                  value={quantity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setQuantity(Number.isFinite(v) && v > 0 ? v : quantity);
                  }}
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={fieldLabel}>Unit</span>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as IngredientUnit)}
                  style={inputStyle}
                >
                  <option value="serving">serving</option>
                  <option value="g">g</option>
                  <option value="ml">mL</option>
                </select>
              </label>
            </div>
            {unit === "serving" ? (
              <label>
                <span style={fieldLabel}>1 serving = (g)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={servingG}
                  onChange={(e) => setServingG(Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </label>
            ) : null}
            {preview && tab !== "manual" ? (
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                {preview.kcal != null
                  ? `${preview.kcal} kcal · P ${fmt(preview.protein_g)} · C ${fmt(
                      preview.carbs_g,
                    )} · F ${fmt(preview.fat_g)}`
                  : "no nutrition data — switch to Manual"}
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={primaryBtn(!canSubmit)}
        >
          Add to recipe
        </button>
      </div>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v >= 10 ? `${Math.round(v)}g` : `${v.toFixed(1)}g`;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  zIndex: 60,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
};

const panelStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: 16,
  width: "100%",
  maxWidth: 520,
  maxHeight: "90vh",
  overflowY: "auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
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

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
};

const hint: React.CSSProperties = { fontSize: 12, color: "#64748b" };

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "8px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  maxHeight: 200,
  overflowY: "auto",
  borderTop: "1px solid #1e293b",
  borderBottom: "1px solid #1e293b",
};

function hitBtn(selected: boolean): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    background: selected ? "#1e293b" : "transparent",
    border: "none",
    color: "#e2e8f0",
    padding: "8px 6px",
    borderBottom: "1px solid #1e293b",
    cursor: "pointer",
  };
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "6px 8px",
    background: active ? "#1e293b" : "transparent",
    color: active ? "#e2e8f0" : "#94a3b8",
    border: "1px solid #1e293b",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  };
}

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
    marginTop: 12,
    width: "100%",
  };
}
