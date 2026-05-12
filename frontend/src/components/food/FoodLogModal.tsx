"use client";

import { useEffect, useMemo, useState } from "react";

import { useAddFood } from "@/hooks/useAddFood";
import { useCreateFoodPreset } from "@/hooks/useFoodPresets";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import { ApiError } from "@/lib/api";
import type { FoodSearchHit, MealType } from "@/lib/schemas";
import { uuidv4 } from "@/lib/uuid";

function searchErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: string } | null;
    if (body && typeof body.detail === "string") return body.detail;
    return `API error ${err.status}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "unknown error";
}

const MEAL_OPTIONS: { label: string; value: MealType }[] = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Snack", value: "snack" },
];

function inferDefaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}

interface Props {
  onClose: () => void;
}

type Mode = "search" | "manual";

export function FoodLogModal({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>("search");
  const [meal, setMeal] = useState<MealType>(inferDefaultMeal());
  const [selected, setSelected] = useState<FoodSearchHit | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState<number | "">("");
  const [manualProtein, setManualProtein] = useState<number | "">("");
  const [manualCarbs, setManualCarbs] = useState<number | "">("");
  const [manualFat, setManualFat] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const addFood = useAddFood();
  const createPreset = useCreateFoodPreset();
  const { data, isLoading, isFetching, isError, error, refetch } = useFoodSearch(
    search,
    mode === "search",
  );

  function selectHit(hit: FoodSearchHit) {
    setSelected(hit);
    // Default the portion to the product's serving size when OFF gives us one;
    // fall back to 100 g (which is what the per-100g nutriments are normalised
    // against). Without this, "1 cup of milk" defaults to 100 g and badly
    // underestimates the entry.
    if (hit.serving_g && hit.serving_g > 0) {
      setGrams(Math.round(hit.serving_g));
    } else {
      setGrams(100);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const computed = useMemo(() => {
    if (!selected) return null;
    const factor = grams / 100;
    const scale = (v: number | null | undefined) =>
      v == null ? null : Math.round(v * factor * 10) / 10;
    const kcal = selected.kcal_per_100g != null
      ? Math.round(selected.kcal_per_100g * factor)
      : null;
    return {
      kcal,
      protein_g: scale(selected.protein_per_100g),
      carbs_g: scale(selected.carbs_per_100g),
      fat_g: scale(selected.fat_per_100g),
    };
  }, [selected, grams]);

  function logSelected() {
    if (!selected || computed?.kcal == null) return;
    addFood.mutate(
      {
        name: selected.name,
        brand: selected.brand ?? null,
        kcal: computed.kcal,
        protein_g: computed.protein_g,
        carbs_g: computed.carbs_g,
        fat_g: computed.fat_g,
        meal_type: meal,
        provider: selected.provider,
        provider_id: selected.provider_id,
        client_id: uuidv4(),
      },
      {
        onSuccess: () => {
          if (saveAsPreset && computed.kcal != null) {
            createPreset.mutate({
              label: selected.name,
              brand: selected.brand ?? null,
              kcal: computed.kcal,
              protein_g: computed.protein_g,
              carbs_g: computed.carbs_g,
              fat_g: computed.fat_g,
              meal_type: meal,
              provider: selected.provider,
              provider_id: selected.provider_id,
              icon_kind: "builtin",
              icon_key: "food-apple",
              sort_order: 0,
            });
          }
          onClose();
        },
      },
    );
  }

  function logManual() {
    if (!manualName.trim() || manualKcal === "" || manualKcal < 0) return;
    const kcal = Number(manualKcal);
    const protein = manualProtein === "" ? null : Number(manualProtein);
    const carbs = manualCarbs === "" ? null : Number(manualCarbs);
    const fat = manualFat === "" ? null : Number(manualFat);
    addFood.mutate(
      {
        name: manualName.trim(),
        kcal,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        meal_type: meal,
        client_id: uuidv4(),
      },
      {
        onSuccess: () => {
          if (saveAsPreset) {
            createPreset.mutate({
              label: manualName.trim(),
              brand: null,
              kcal,
              protein_g: protein,
              carbs_g: carbs,
              fat_g: fat,
              meal_type: meal,
              provider: null,
              provider_id: null,
              icon_kind: "builtin",
              icon_key: "food-apple",
              sort_order: 0,
            });
          }
          onClose();
        },
      },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log food"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
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
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Log food</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", color: "#94a3b8", border: "none", fontSize: 20 }}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setMode("search")}
            style={tabStyle(mode === "search")}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            style={tabStyle(mode === "manual")}
          >
            Manual
          </button>
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
            Meal
          </span>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealType)}
            style={inputStyle}
          >
            {MEAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {mode === "search" ? (
          <>
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                Search Open Food Facts
              </span>
              <input
                type="search"
                placeholder="e.g. greek yogurt"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected(null);
                }}
                style={inputStyle}
              />
            </label>
            {search.trim().length < 2 ? (
              <p style={{ fontSize: 12, color: "#64748b" }}>
                Type at least 2 characters to search.
              </p>
            ) : isError ? (
              <div style={{ fontSize: 13, color: "#fca5a5", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span>Search failed: {searchErrorMessage(error)}.</span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  style={{
                    background: "transparent",
                    color: "#10b981",
                    border: "1px solid #1e293b",
                    borderRadius: 6,
                    padding: "2px 8px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Retry
                </button>
              </div>
            ) : isLoading ? (
              <p style={{ fontSize: 13, color: "#94a3b8" }}>Searching…</p>
            ) : data && data.hits.length > 0 ? (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  maxHeight: 240,
                  overflowY: "auto",
                  borderTop: "1px solid #1e293b",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                {data.hits.map((h) => {
                  const isSel =
                    selected?.provider_id === h.provider_id &&
                    selected?.provider === h.provider;
                  return (
                    <li key={`${h.provider}-${h.provider_id}`}>
                      <button
                        type="button"
                        onClick={() => selectHit(h)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: isSel ? "#1e293b" : "transparent",
                          border: "none",
                          color: "#e2e8f0",
                          padding: "8px 6px",
                          borderBottom: "1px solid #1e293b",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 14 }}>
                          {h.name}
                          {h.brand ? (
                            <span style={{ color: "#64748b" }}> · {h.brand}</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          {h.kcal_per_100g != null
                            ? `${Math.round(h.kcal_per_100g)} kcal / 100 g`
                            : "no kcal data"}
                          {h.serving_label
                            ? ` · serving: ${h.serving_label}`
                            : h.serving_g
                              ? ` · serving: ${h.serving_g} g`
                              : ""}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : data && !isFetching ? (
              <p style={{ fontSize: 13, color: "#94a3b8" }}>No matches.</p>
            ) : null}

            {selected ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label>
                  <span
                    style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                  >
                    Grams eaten
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={grams}
                    onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
                    style={inputStyle}
                  />
                </label>
                {selected.serving_g ? (
                  <button
                    type="button"
                    onClick={() => setGrams(Math.round(selected.serving_g ?? grams))}
                    style={{
                      alignSelf: "start",
                      fontSize: 12,
                      color: "#10b981",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Use 1 serving ({selected.serving_label ?? `${selected.serving_g} g`})
                  </button>
                ) : null}
                <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                  {computed?.kcal != null
                    ? `${computed.kcal} kcal · P ${fmt(computed.protein_g)} · C ${fmt(
                        computed.carbs_g,
                      )} · F ${fmt(computed.fat_g)}`
                    : "No kcal data for this product."}
                </div>
                <SaveAsPresetCheckbox value={saveAsPreset} onChange={setSaveAsPreset} />
                <button
                  type="button"
                  onClick={logSelected}
                  disabled={addFood.isPending || computed?.kcal == null}
                  style={primaryBtnStyle}
                >
                  {addFood.isPending ? "Logging…" : "Log it"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label>
              <span style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                Name
              </span>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                Calories (kcal)
              </span>
              <input
                type="number"
                min={0}
                max={20000}
                value={manualKcal}
                onChange={(e) =>
                  setManualKcal(e.target.value === "" ? "" : Number(e.target.value))
                }
                style={inputStyle}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <label>
                <span
                  style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  Protein (g)
                </span>
                <input
                  type="number"
                  min={0}
                  value={manualProtein}
                  onChange={(e) =>
                    setManualProtein(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </label>
              <label>
                <span
                  style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  Carbs (g)
                </span>
                <input
                  type="number"
                  min={0}
                  value={manualCarbs}
                  onChange={(e) =>
                    setManualCarbs(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </label>
              <label>
                <span
                  style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  Fat (g)
                </span>
                <input
                  type="number"
                  min={0}
                  value={manualFat}
                  onChange={(e) =>
                    setManualFat(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </label>
            </div>
            <SaveAsPresetCheckbox value={saveAsPreset} onChange={setSaveAsPreset} />
            <button
              type="button"
              onClick={logManual}
              disabled={
                addFood.isPending || !manualName.trim() || manualKcal === "" || manualKcal < 0
              }
              style={primaryBtnStyle}
            >
              {addFood.isPending ? "Logging…" : "Log it"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SaveAsPresetCheckbox({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "#cbd5e1",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      Save as quick food
    </label>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v >= 10 ? `${Math.round(v)}g` : `${v.toFixed(1)}g`;
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 12px",
    background: active ? "#1e293b" : "transparent",
    color: active ? "#e2e8f0" : "#94a3b8",
    border: "1px solid #1e293b",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
};

const primaryBtnStyle: React.CSSProperties = {
  background: "#10b981",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
