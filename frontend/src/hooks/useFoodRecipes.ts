"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  FoodAddOutSchema,
  FoodRecipeListSchema,
  FoodRecipeSchema,
  type IngredientUnit,
  type MealType,
  type NutrientPanel,
} from "@/lib/schemas";

// Input shape for create/update. Mirrors backend RecipeIn — `id`/`position`
// are server-assigned, totals are server-computed.
export interface RecipeIngredientInput {
  name: string;
  brand?: string | null;
  provider?: string | null;
  provider_id?: string | null;
  quantity: number;
  unit: IngredientUnit;
  serving_g?: number | null;
  serving_label?: string | null;
  kcal: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  nutrients?: NutrientPanel | Record<string, number> | null;
}

export interface RecipeInput {
  label: string;
  brand?: string | null;
  yields_servings: number;
  serving_label?: string | null;
  meal_type?: MealType | null;
  sort_order?: number;
  ingredients: RecipeIngredientInput[];
}

export function useFoodRecipes() {
  return useQuery({
    queryKey: ["food-recipes"],
    queryFn: () => apiFetch("/food/recipes", FoodRecipeListSchema),
  });
}

export function useFoodRecipe(id: string | null) {
  return useQuery({
    queryKey: ["food-recipes", id],
    queryFn: () => apiFetch(`/food/recipes/${id}`, FoodRecipeSchema),
    enabled: id != null,
  });
}

export function useCreateFoodRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) =>
      apiPost("/food/recipes", FoodRecipeSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-recipes"] }),
  });
}

export function useUpdateFoodRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & RecipeInput) =>
      apiPatch(`/food/recipes/${id}`, FoodRecipeSchema, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["food-recipes"] });
      qc.invalidateQueries({ queryKey: ["food-recipes", vars.id] });
    },
  });
}

export function useDeleteFoodRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/food/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-recipes"] }),
  });
}

export interface LogRecipeInput {
  id: string;
  servings: number;
  meal_type?: MealType | null;
  occurred_at?: string | null;
  client_id?: string | null;
}

export function useLogFoodRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: LogRecipeInput) =>
      apiPost(`/food/recipes/${id}/log`, FoodAddOutSchema, payload),
    onSuccess: () => {
      // A recipe-log writes one food entry — invalidate today's food
      // panel, the recent-foods list, and the user (for XP/level updates).
      // The same key structure as the existing food-add flow.
      qc.invalidateQueries({ queryKey: ["food", "today"] });
      qc.invalidateQueries({ queryKey: ["food", "recent"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
