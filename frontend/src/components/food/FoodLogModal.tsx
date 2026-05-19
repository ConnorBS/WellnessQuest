"use client";

import { useEffect, useMemo, useState } from "react";

import { useAddFood } from "@/hooks/useAddFood";
import { useFoodBarcode } from "@/hooks/useFoodBarcode";
import { useCreateFoodPreset } from "@/hooks/useFoodPresets";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import { ApiError } from "@/lib/api";
import { resolvePortion, type IngredientUnit } from "@/lib/food/portionMath";
import type {
  FoodSearchHit,
  FoodUnit,
  LabelScanOut,
  MealType,
  NutrientPanel,
} from "@/lib/schemas";
import { useSnapBack } from "@/lib/useSnapBack";
import { uuidv4 } from "@/lib/uuid";

import { BarcodeScanner } from "@/components/food/BarcodeScanner";
import { NutrientPanel as NutrientPanelView } from "@/components/food/NutrientPanel";
import { NutritionLabelScanner } from "@/components/food/NutritionLabelScanner";
import { ParsedLabelReview, type ReviewedLabel } from "@/components/food/ParsedLabelReview";
import { RecipeTab } from "@/components/food/RecipeTab";

// What unit set to show in the picker when OFF couldn't tell us the product's
// native unit. We default to solid (g/oz) — most packaged foods are mass-labelled.
const DEFAULT_NATIVE_UNIT: FoodUnit = "g";

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

type Mode = "search" | "manual" | "recipes" | "scan-review";

export function FoodLogModal({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>("search");
  const [meal, setMeal] = useState<MealType>(inferDefaultMeal());
  const [selected, setSelected] = useState<FoodSearchHit | null>(null);
  // Servings-first portion model: user types "2", we resolve grams from
  // selected.serving_g. The legacy gram-amount input is now a collapsible
  // override for foods without a serving size or volumetric items.
  const [servings, setServings] = useState<number>(1);
  // The gram-weight of ONE serving. Editable: OFF's value is just a default,
  // and labels often disagree (e.g. preset says 320g but the user only ate
  // half the tub). Total grams logged = servings × servingG. When this is
  // null, the product has no serving size from OFF and we fall back to a
  // raw-grams input below.
  const [servingG, setServingG] = useState<number | "">("");
  // Raw-grams escape hatch for foods where "1 serving" is meaningless (bulk
  // items, foods without a serving size, "I ate half of what was in the pan").
  const [rawGrams, setRawGrams] = useState<number | "">("");
  // Manual-mode kcal/macros for foods without OFF nutrition data.
  const [overrideKcal, setOverrideKcal] = useState<number | "">("");
  const [overrideProtein, setOverrideProtein] = useState<number | "">("");
  const [overrideCarbs, setOverrideCarbs] = useState<number | "">("");
  const [overrideFat, setOverrideFat] = useState<number | "">("");
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState<number | "">("");
  const [manualProtein, setManualProtein] = useState<number | "">("");
  const [manualCarbs, setManualCarbs] = useState<number | "">("");
  const [manualFat, setManualFat] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // Label-scan review state
  const [scanResult, setScanResult] = useState<LabelScanOut | null>(null);
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [expandNutrients, setExpandNutrients] = useState(false);
  // Snap-back wrappers for the three inputs that decide what gets logged.
  // Empty/zero on blur restores the user's most recent valid number, so a
  // grayed-out placeholder never leaves you wondering if anything will save.
  const servingsSnap = useSnapBack(
    servings,
    (v) => setServings(typeof v === "number" ? v : 1),
    1,
  );
  const servingGSnap = useSnapBack(
    servingG,
    setServingG,
    selected?.serving_g ?? 100,
  );
  const rawGramsSnap = useSnapBack(rawGrams, setRawGrams, 100);
  const addFood = useAddFood();
  const createPreset = useCreateFoodPreset();
  const barcodeLookup = useFoodBarcode();
  const { data, isLoading, isFetching, isError, error, refetch } = useFoodSearch(
    search,
    mode === "search",
  );

  function onBarcodeDetected(code: string) {
    setScannerOpen(false);
    setScanError(null);
    barcodeLookup.mutate(code, {
      onSuccess: (hit) => {
        // Barcode bypasses the search-result list (the user never sees a
        // name + brand line above the detail panel), so expand the full
        // nutrient panel by default — that's the "drop down of nutrition"
        // operators expect to see after a scan.
        selectHit(hit, { expandNutrients: true });
      },
      onError: (err) => {
        const body = err instanceof ApiError ? (err.body as { detail?: string } | null) : null;
        setScanError(body?.detail ?? `Lookup failed for barcode ${code}.`);
      },
    });
  }

  function selectHit(
    hit: FoodSearchHit,
    opts: { expandNutrients?: boolean } = {},
  ) {
    setSelected(hit);
    setServings(1);
    setServingG(hit.serving_g ?? "");
    setRawGrams(hit.serving_g ? "" : 100);
    setOverrideKcal("");
    setOverrideProtein("");
    setOverrideCarbs("");
    setOverrideFat("");
    if (opts.expandNutrients) setExpandNutrients(true);
  }

  function onLabelScanned(parsed: LabelScanOut, file: File) {
    setScanResult(parsed);
    if (scanImageUrl) URL.revokeObjectURL(scanImageUrl);
    setScanImageUrl(URL.createObjectURL(file));
    setMode("scan-review");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(
    () => () => {
      if (scanImageUrl) URL.revokeObjectURL(scanImageUrl);
    },
    [scanImageUrl],
  );

  // Whether the product has a meaningful "1 serving" definition (from OFF or
  // user input). Foods without one drop the servings field and use rawGrams.
  const hasServingBasis = servingG !== "" && Number(servingG) > 0;

  const computed = useMemo(() => {
    if (!selected) return null;
    // Pick a spec for the shared portion math: serving-based when the user
    // has a serving-g, raw-amount when they're logging by g/mL only.
    const nativeUnit: FoodUnit = selected.unit ?? DEFAULT_NATIVE_UNIT;
    const spec = hasServingBasis
      ? {
          quantity: servings,
          unit: "serving" as IngredientUnit,
          servingG: Number(servingG),
        }
      : {
          quantity: rawGrams === "" ? 100 : Number(rawGrams),
          unit: nativeUnit as IngredientUnit,
          servingG: null,
        };
    return resolvePortion(selected, spec);
  }, [selected, servings, servingG, rawGrams, hasServingBasis]);

  // When OFF returned no per-100 nutriments, we fall back to whatever the user
  // typed in the override fields. Leaving them blank is valid — it logs the
  // entry with kcal=0 and null macros, so the user has a record of "I ate X"
  // even when they don't know the numbers. Better than no entry at all.
  const finalKcal: number = computed
    ? computed.hasNutritionData
      ? (computed.kcal ?? 0)
      : overrideKcal === "" ? 0 : Number(overrideKcal)
    : 0;
  const finalProtein: number | null = computed
    ? computed.hasNutritionData
      ? computed.protein_g
      : overrideProtein === "" ? null : Number(overrideProtein)
    : null;
  const finalCarbs: number | null = computed
    ? computed.hasNutritionData
      ? computed.carbs_g
      : overrideCarbs === "" ? null : Number(overrideCarbs)
    : null;
  const finalFat: number | null = computed
    ? computed.hasNutritionData
      ? computed.fat_g
      : overrideFat === "" ? null : Number(overrideFat)
    : null;

  function logSelected() {
    if (!selected || !computed || finalKcal < 0) return;
    addFood.mutate(
      {
        name: selected.name,
        brand: selected.brand ?? null,
        kcal: finalKcal,
        protein_g: finalProtein,
        carbs_g: finalCarbs,
        fat_g: finalFat,
        // Snapshot what "1 serving" meant at log time. The user may have
        // edited servingG away from OFF's default — record what they actually
        // logged against so the entry-edit flow scales correctly later.
        servings: hasServingBasis ? servings : null,
        serving_g: hasServingBasis ? Number(servingG) : null,
        serving_label: selected.serving_label ?? null,
        nutrients:
          computed.hasNutritionData && Object.keys(computed.nutrients).length
            ? computed.nutrients
            : null,
        meal_type: meal,
        provider: selected.provider,
        provider_id: selected.provider_id,
        client_id: uuidv4(),
      },
      {
        onSuccess: () => {
          if (saveAsPreset && finalKcal != null) {
            // Preset stores the PER-SERVING values, not the multiplied ones,
            // so re-logging the preset gives a stable starting point. We
            // resolve per-serving from the per-100g and the product's
            // serving_g.
            const presetKcal = perServing(selected.kcal_per_100g, selected.serving_g);
            const presetProtein = perServing(selected.protein_per_100g, selected.serving_g);
            const presetCarbs = perServing(selected.carbs_per_100g, selected.serving_g);
            const presetFat = perServing(selected.fat_per_100g, selected.serving_g);
            const presetNutrients: Record<string, number> = {};
            for (const [key, v] of Object.entries(selected.nutrients_per_100g ?? {})) {
              const ps = perServing(v, selected.serving_g);
              if (ps != null) presetNutrients[key] = ps;
            }
            createPreset.mutate({
              label: selected.name,
              brand: selected.brand ?? null,
              kcal: presetKcal ?? finalKcal,
              protein_g: presetProtein ?? finalProtein,
              carbs_g: presetCarbs ?? finalCarbs,
              fat_g: presetFat ?? finalFat,
              serving_g: selected.serving_g ?? null,
              serving_label: selected.serving_label ?? null,
              nutrients: Object.keys(presetNutrients).length ? presetNutrients : null,
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
              serving_g: null,
              serving_label: null,
              nutrients: null,
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

  function saveReviewed(values: ReviewedLabel, alsoLog: boolean) {
    // From the OCR review screen: always save as a preset so the scanned label
    // is reusable. Optionally also log 1 serving now.
    createPreset.mutate(
      {
        label: values.name,
        brand: values.brand,
        kcal: values.kcal,
        protein_g: values.protein_g,
        carbs_g: values.carbs_g,
        fat_g: values.fat_g,
        serving_g: values.serving_g,
        serving_label: values.serving_label,
        nutrients: emptyToNull(values.nutrients),
        meal_type: values.meal_type,
        provider: null,
        provider_id: null,
        icon_kind: "builtin",
        icon_key: "food-apple",
        sort_order: 0,
      },
      {
        onSuccess: () => {
          if (!alsoLog) {
            onClose();
            return;
          }
          addFood.mutate(
            {
              name: values.name,
              brand: values.brand,
              kcal: values.kcal,
              protein_g: values.protein_g,
              carbs_g: values.carbs_g,
              fat_g: values.fat_g,
              servings: 1,
              serving_g: values.serving_g,
              serving_label: values.serving_label,
              nutrients: emptyToNull(values.nutrients),
              meal_type: values.meal_type,
              client_id: uuidv4(),
            },
            { onSuccess: () => onClose() },
          );
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
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>
            {mode === "scan-review" ? "Confirm label" : "Log food"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", color: "#94a3b8", border: "none", fontSize: 20 }}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {mode === "scan-review" && scanResult ? (
          <ParsedLabelReview
            parsed={scanResult}
            imageUrl={scanImageUrl}
            defaultMeal={meal}
            onCancel={() => {
              setMode("search");
              setScanResult(null);
              if (scanImageUrl) URL.revokeObjectURL(scanImageUrl);
              setScanImageUrl(null);
            }}
            onSave={(v) => saveReviewed(v, false)}
            onSaveAndLog={(v) => saveReviewed(v, true)}
            busy={createPreset.isPending || addFood.isPending}
          />
        ) : (
          <>
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
              <button
                type="button"
                onClick={() => setMode("recipes")}
                style={tabStyle(mode === "recipes")}
              >
                Recipes
              </button>
            </div>

            {mode !== "recipes" ? (
              <div style={{ marginBottom: 12 }}>
                <NutritionLabelScanner
                  onScanned={onLabelScanned}
                  label="Scan a nutrition label"
                />
              </div>
            ) : null}

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

            {mode === "recipes" ? (
              <RecipeTab meal={meal} onLogged={onClose} />
            ) : mode === "search" ? (
              <>
                <label style={{ display: "block", marginBottom: 8 }}>
                  <span style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                    Search Open Food Facts
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="search"
                      placeholder="e.g. greek yogurt"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setSelected(null);
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setScanError(null);
                        setScannerOpen(true);
                      }}
                      disabled={barcodeLookup.isPending}
                      title="Scan a barcode"
                      style={{
                        padding: "0 12px",
                        background: "transparent",
                        color: "#10b981",
                        border: "1px solid #1e293b",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {barcodeLookup.isPending ? "Looking up…" : "Barcode"}
                    </button>
                  </div>
                </label>
                {scanError && (
                  <p style={{ fontSize: 13, color: "#fca5a5", marginBottom: 8 }}>{scanError}</p>
                )}
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
                              {(() => {
                                const native = h.unit ?? DEFAULT_NATIVE_UNIT;
                                const per100 =
                                  native === "ml"
                                    ? h.kcal_per_100ml ?? h.kcal_per_100g
                                    : h.kcal_per_100g ?? h.kcal_per_100ml;
                                const unitLabel = native === "ml" ? "mL" : "g";
                                return per100 != null
                                  ? `${Math.round(per100)} kcal / 100 ${unitLabel}`
                                  : "no kcal data";
                              })()}
                              {h.serving_label
                                ? ` · serving: ${h.serving_label}`
                                : h.serving_g
                                  ? ` · serving: ${h.serving_g} ${h.unit === "ml" ? "mL" : "g"}`
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

                {selected
                  ? (() => {
                      const servingUnitLabel =
                        selected.unit === "ml" ? "mL" : "g";
                      const totalAmount = computed?.nativeAmount ?? 0;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={selectedHeaderStyle}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                              {selected.name}
                            </div>
                            {selected.brand ? (
                              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                {selected.brand}
                              </div>
                            ) : null}
                            {selected.serving_label ? (
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                OFF serving: {selected.serving_label}
                              </div>
                            ) : null}
                          </div>
                          {hasServingBasis ? (
                            <>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: 8,
                                }}
                              >
                                <label>
                                  <span style={fieldLabel}>Servings</span>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setServings((s) =>
                                          Math.max(0.25, +(s - 0.5).toFixed(2)),
                                        )
                                      }
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
                                      onClick={() =>
                                        setServings((s) => +(s + 0.5).toFixed(2))
                                      }
                                      style={stepperBtn}
                                      aria-label="Half a serving more"
                                    >
                                      +
                                    </button>
                                  </div>
                                </label>
                                <label>
                                  <span style={fieldLabel}>
                                    1 serving = ({servingUnitLabel})
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
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#64748b",
                                  display: "block",
                                }}
                              >
                                Logging {fmtAmount(totalAmount)} {servingUnitLabel}
                                {selected.serving_label
                                  ? ` · OFF says 1 serving = ${selected.serving_label}`
                                  : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setServingG("");
                                  setRawGrams(Math.round(totalAmount) || 100);
                                }}
                                style={linkBtn}
                              >
                                No serving — log by {servingUnitLabel} only
                              </button>
                            </>
                          ) : (
                            <>
                              <label>
                                <span style={fieldLabel}>
                                  Amount ({servingUnitLabel})
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  max={5000}
                                  value={rawGrams}
                                  onChange={(e) => rawGramsSnap.onChange(e.target.value)}
                                  onBlur={rawGramsSnap.onBlur}
                                  style={inputStyle}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setServingG(
                                    selected.serving_g ?? (rawGrams === "" ? 100 : Number(rawGrams)),
                                  );
                                  setRawGrams("");
                                  setServings(1);
                                }}
                                style={linkBtn}
                              >
                                Use servings instead
                              </button>
                            </>
                          )}

                          {computed?.hasNutritionData ? (
                            <>
                              <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                                {`${computed.kcal} kcal · P ${fmt(computed.protein_g)} · C ${fmt(
                                  computed.carbs_g,
                                )} · F ${fmt(computed.fat_g)}`}
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandNutrients((v) => !v)}
                                style={linkBtn}
                              >
                                {expandNutrients ? "Hide" : "Show"} full nutrient panel
                              </button>
                              {expandNutrients ? (
                                <NutrientPanelView
                                  totals={{
                                    kcal: computed.kcal ?? 0,
                                    protein_g: computed.protein_g ?? null,
                                    carbs_g: computed.carbs_g ?? null,
                                    fat_g: computed.fat_g ?? null,
                                    ...computed.nutrients,
                                  }}
                                />
                              ) : null}
                            </>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                padding: 10,
                                background: "#0b1220",
                                border: "1px solid #1e293b",
                                borderRadius: 6,
                              }}
                            >
                              <p style={{ fontSize: 12, color: "#fcd34d", margin: 0 }}>
                                Open Food Facts doesn&apos;t have nutrition data for this
                                product. Enter the values from the package below, or use
                                &quot;Scan a nutrition label&quot; above.
                              </p>
                              <label>
                                <span style={fieldLabel}>Calories (kcal) for this portion</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={20000}
                                  value={overrideKcal}
                                  onChange={(e) =>
                                    setOverrideKcal(
                                      e.target.value === "" ? "" : Number(e.target.value),
                                    )
                                  }
                                  style={inputStyle}
                                />
                              </label>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr 1fr",
                                  gap: 8,
                                }}
                              >
                                <label>
                                  <span style={fieldLabel}>Protein (g)</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={overrideProtein}
                                    onChange={(e) =>
                                      setOverrideProtein(
                                        e.target.value === "" ? "" : Number(e.target.value),
                                      )
                                    }
                                    style={inputStyle}
                                  />
                                </label>
                                <label>
                                  <span style={fieldLabel}>Carbs (g)</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={overrideCarbs}
                                    onChange={(e) =>
                                      setOverrideCarbs(
                                        e.target.value === "" ? "" : Number(e.target.value),
                                      )
                                    }
                                    style={inputStyle}
                                  />
                                </label>
                                <label>
                                  <span style={fieldLabel}>Fat (g)</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={overrideFat}
                                    onChange={(e) =>
                                      setOverrideFat(
                                        e.target.value === "" ? "" : Number(e.target.value),
                                      )
                                    }
                                    style={inputStyle}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                          <SaveAsPresetCheckbox value={saveAsPreset} onChange={setSaveAsPreset} />
                          {(() => {
                            const disabled = addFood.isPending || finalKcal < 0;
                            return (
                              <button
                                type="button"
                                onClick={logSelected}
                                disabled={disabled}
                                style={primaryBtnStyleFor(disabled)}
                              >
                                {addFood.isPending
                                  ? "Logging…"
                                  : computed?.hasNutritionData || overrideKcal !== ""
                                    ? "Log it"
                                    : "Log without nutrition"}
                              </button>
                            );
                          })()}
                        </div>
                      );
                    })()
                  : null}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label>
                  <span style={fieldLabel}>Name</span>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label>
                  <span style={fieldLabel}>Calories (kcal)</span>
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
                    <span style={fieldLabel}>Protein (g)</span>
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
                    <span style={fieldLabel}>Carbs (g)</span>
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
                    <span style={fieldLabel}>Fat (g)</span>
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
                {(() => {
                  const manualDisabled =
                    addFood.isPending || !manualName.trim() || manualKcal === "" || manualKcal < 0;
                  return (
                    <button
                      type="button"
                      onClick={logManual}
                      disabled={manualDisabled}
                      style={primaryBtnStyleFor(manualDisabled)}
                    >
                      {addFood.isPending ? "Logging…" : "Log it"}
                    </button>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
      {scannerOpen && (
        <BarcodeScanner
          onDetected={onBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}
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

function fmtAmount(v: number): string {
  if (v === 0) return "0";
  if (v < 10) return v.toFixed(1).replace(/\.0$/, "");
  return String(Math.round(v));
}

function perServing(
  per100: number | null | undefined,
  servingG: number | null | undefined,
): number | null {
  if (per100 == null || !servingG) return null;
  return Math.round((per100 * (servingG / 100)) * 100) / 100;
}

function emptyToNull(n: NutrientPanel): Record<string, number> | null {
  if (!n) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(n)) {
    if (v != null) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
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

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
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

const linkBtn: React.CSSProperties = {
  alignSelf: "start",
  fontSize: 12,
  color: "#10b981",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const selectedHeaderStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "#0b1220",
  border: "1px solid #1e293b",
  borderRadius: 6,
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
    opacity: disabled ? 0.7 : 1,
  };
}
