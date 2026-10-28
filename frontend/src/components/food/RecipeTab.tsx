"use client";

import { useState } from "react";

import {
  useDeleteFoodRecipe,
  useFoodRecipe,
  useFoodRecipes,
  useLogFoodRecipe,
} from "@/hooks/useFoodRecipes";
import { ApiError } from "@/lib/api";
import type { FoodRecipeListItem, MealType } from "@/lib/schemas";
import { uuidv4 } from "@/lib/uuid";

import { RecipeBuilder } from "@/components/food/RecipeBuilder";

interface Props {
  meal: MealType;
  onLogged: () => void;
}

export function RecipeTab({ meal, onLogged }: Props) {
  const recipes = useFoodRecipes();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  function openNew() {
    setEditingId(null);
    setBuilderOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setBuilderOpen(true);
  }

  // We only fetch the full recipe (with ingredients) once the user opens
  // edit — list rows already carry totals + meal_type, no need to GET
  // until then.
  const editingRecipe = useFoodRecipe(editingId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        onClick={openNew}
        style={{
          background: "transparent",
          color: "var(--wq-accent)",
          border: "1px dashed var(--wq-surface-2)",
          borderRadius: 6,
          padding: "10px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        + New recipe
      </button>

      {recipes.isLoading ? (
        <p style={{ fontSize: 13, color: "var(--wq-muted)" }}>Loading recipes…</p>
      ) : recipes.isError ? (
        <p style={{ fontSize: 13, color: "#fca5a5" }}>
          Could not load recipes.
        </p>
      ) : !recipes.data || recipes.data.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--wq-muted-2)" }}>
          No recipes yet. Build one to log multi-ingredient dishes (like
          “my scrambled eggs”) in a single tap.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {recipes.data.map((r) => (
            <RecipeRow
              key={r.id}
              recipe={r}
              expanded={expandedId === r.id}
              meal={meal}
              onToggle={() =>
                setExpandedId((cur) => (cur === r.id ? null : r.id))
              }
              onEdit={() => openEdit(r.id)}
              onLogged={onLogged}
            />
          ))}
        </ul>
      )}

      {builderOpen ? (
        <RecipeBuilder
          existing={editingId ? (editingRecipe.data ?? null) : null}
          onClose={() => {
            setBuilderOpen(false);
            setEditingId(null);
          }}
        />
      ) : null}
    </div>
  );
}

interface RowProps {
  recipe: FoodRecipeListItem;
  expanded: boolean;
  meal: MealType;
  onToggle: () => void;
  onEdit: () => void;
  onLogged: () => void;
}

function RecipeRow({ recipe, expanded, meal, onToggle, onEdit, onLogged }: RowProps) {
  const [servings, setServings] = useState<number>(1);
  const [err, setErr] = useState<string | null>(null);
  const log = useLogFoodRecipe();
  const del = useDeleteFoodRecipe();

  const yields = Number(recipe.yields_servings) || 1;
  const perServingKcal = Math.round(recipe.total_kcal / yields);
  const loggedKcal = Math.round(perServingKcal * servings);

  function doLog() {
    setErr(null);
    log.mutate(
      {
        id: recipe.id,
        servings,
        meal_type: meal,
        client_id: uuidv4(),
      },
      {
        onSuccess: () => onLogged(),
        onError: (e) => {
          if (e instanceof ApiError) {
            const body = e.body as { detail?: string } | null;
            setErr(body?.detail ?? `Log failed (${e.status}).`);
          } else if (e instanceof Error) {
            setErr(e.message);
          } else {
            setErr("Log failed.");
          }
        },
      },
    );
  }

  function doDelete() {
    if (!confirm(`Delete recipe "${recipe.label}"? Logged entries are kept.`)) {
      return;
    }
    del.mutate(recipe.id);
  }

  return (
    <li
      style={{
        background: "var(--wq-bg)",
        border: "1px solid var(--wq-surface-2)",
        borderRadius: 6,
        padding: 0,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          color: "var(--wq-text)",
          padding: "10px",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{recipe.label}</span>
          <span style={{ fontSize: 12, color: "var(--wq-muted)" }}>{perServingKcal} kcal/serving</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--wq-muted-2)", marginTop: 2 }}>
          Serves {yields}
          {recipe.serving_label ? ` · ${recipe.serving_label}` : ""}
        </div>
      </button>

      {expanded ? (
        <div
          style={{
            borderTop: "1px solid var(--wq-surface-2)",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <label>
            <span style={{ display: "block", fontSize: 12, color: "var(--wq-muted)", marginBottom: 4 }}>
              How many servings?
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(0.25, +(s - 0.5).toFixed(2)))}
                style={stepper}
                aria-label="Half a serving less"
              >
                −
              </button>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value) || servings)}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  background: "var(--wq-bg)",
                  border: "1px solid var(--wq-surface-2)",
                  borderRadius: 6,
                  color: "var(--wq-text)",
                  fontSize: 14,
                  textAlign: "center",
                }}
              />
              <button
                type="button"
                onClick={() => setServings((s) => +(s + 0.5).toFixed(2))}
                style={stepper}
                aria-label="Half a serving more"
              >
                +
              </button>
            </div>
          </label>
          <div style={{ fontSize: 12, color: "var(--wq-text-2)" }}>
            Logs {loggedKcal} kcal
          </div>
          {err ? <div style={{ fontSize: 13, color: "#fca5a5" }}>{err}</div> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={doLog}
              disabled={log.isPending}
              style={{
                flex: 1,
                background: log.isPending ? "var(--wq-surface-2)" : "var(--wq-accent)",
                color: log.isPending ? "var(--wq-muted-2)" : "white",
                border: "none",
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 600,
                cursor: log.isPending ? "not-allowed" : "pointer",
              }}
            >
              {log.isPending ? "Logging…" : "Log it"}
            </button>
            <button
              type="button"
              onClick={onEdit}
              style={{
                background: "transparent",
                color: "var(--wq-text-2)",
                border: "1px solid var(--wq-surface-2)",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={doDelete}
              disabled={del.isPending}
              style={{
                background: "transparent",
                color: "#fca5a5",
                border: "1px solid var(--wq-surface-2)",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                cursor: del.isPending ? "not-allowed" : "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

const stepper: React.CSSProperties = {
  width: 40,
  height: 40,
  fontSize: 18,
  background: "var(--wq-surface-2)",
  color: "var(--wq-text)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};
