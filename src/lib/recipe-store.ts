/**
 * Recipe store — useSyncExternalStore pattern.
 * Supabase-backed with optimistic local updates.
 */

import { useSyncExternalStore, useMemo } from "react";
import type { Recipe, RecipeIngredient, RecipeCategory } from "./types";
import {
  computeIngredientMacros,
  computeRecipeTotals,
  computePerServingMacros,
} from "./nutrition-utils";
import { fetchRecipes, saveRecipe, deleteRecipe } from "./supabase/db";

// ── State ──────────────────────────────────────────────────────────────────

let recipes: Recipe[] = [];
const listeners = new Set<() => void>();
let snapshot: Recipe[] = recipes;
const cacheById = new Map<string, Recipe | undefined>();
let _hydrated = false;

function emitChange() {
  snapshot = [...recipes];
  cacheById.clear();
  for (const listener of listeners) listener();
}

// ── Hydration from Supabase ──────────────────────────────────────────────

function fromDbRecipe(row: Record<string, unknown>): Recipe {
  const rawIngredients = row.recipe_ingredients as Record<string, unknown>[] | undefined;
  const ingredients: RecipeIngredient[] = (rawIngredients ?? [])
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((ing: Record<string, unknown>) => ({
      id: ing.id as string,
      fdcId: Number(ing.fdc_id ?? 0),
      name: (ing.name as string) ?? "",
      portionIndex: Number(ing.portion_index ?? 0),
      portionLabel: (ing.portion_label as string) ?? "100 g",
      quantity: Number(ing.quantity ?? 1),
      gramWeight: Number(ing.gram_weight ?? 0),
      calories: Number(ing.calories ?? 0),
      protein: Number(ing.protein ?? 0),
      carbs: Number(ing.carbs ?? 0),
      fat: Number(ing.fat ?? 0),
    }));

  const totalCalories = Number(row.total_calories ?? 0);
  const totalProtein = Number(row.total_protein ?? 0);
  const totalCarbs = Number(row.total_carbs ?? 0);
  const totalFat = Number(row.total_fat ?? 0);
  const servings = Number(row.servings ?? 1);

  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    category: (row.category as RecipeCategory) ?? "Other",
    description: (row.description as string) ?? "",
    imageUrl: (row.image_url as string | null) ?? null,
    servings,
    prepTimeMinutes: (row.prep_time as number | null) ?? null,
    instructions: (row.instructions as string | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    ingredients,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    perServingCalories: servings > 0 ? totalCalories / servings : 0,
    perServingProtein: servings > 0 ? totalProtein / servings : 0,
    perServingCarbs: servings > 0 ? totalCarbs / servings : 0,
    perServingFat: servings > 0 ? totalFat / servings : 0,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

// ── Store API ──────────────────────────────────────────────────────────────

export const recipeStore = {
  getAll(): Recipe[] {
    return snapshot;
  },

  getById(id: string): Recipe | undefined {
    if (!cacheById.has(id)) {
      cacheById.set(id, recipes.find((r) => r.id === id));
    }
    return cacheById.get(id);
  },

  /** Hydrate recipes from Supabase */
  async hydrate(): Promise<void> {
    if (_hydrated) return;
    try {
      const rows = await fetchRecipes();
      if (rows && rows.length > 0) {
        recipes = rows.map(fromDbRecipe);
      }
      _hydrated = true;
      emitChange();
    } catch (err) {
      console.error("[recipeStore] hydrate error:", err);
    }
  },

  add(recipe: Recipe) {
    recipes = [recipe, ...recipes];
    emitChange();
    // Persist to Supabase
    saveRecipe(recipe).catch((err) =>
      console.error("[recipeStore] save failed:", err)
    );
  },

  update(recipeId: string, updates: Partial<Recipe>) {
    recipes = recipes.map((r) => (r.id === recipeId ? { ...r, ...updates } : r));
    emitChange();
    // Persist to Supabase
    const updated = recipes.find((r) => r.id === recipeId);
    if (updated) {
      saveRecipe(updated).catch((err) =>
        console.error("[recipeStore] save failed:", err)
      );
    }
  },

  remove(recipeId: string) {
    recipes = recipes.filter((r) => r.id !== recipeId);
    emitChange();
    // Delete from Supabase
    deleteRecipe(recipeId).catch((err) =>
      console.error("[recipeStore] delete failed:", err)
    );
  },

  /** Add an ingredient to a recipe and recompute totals. */
  addIngredient(recipeId: string, ingredient: RecipeIngredient) {
    recipes = recipes.map((r) => {
      if (r.id !== recipeId) return r;
      const newIngredients = [...r.ingredients, ingredient];
      return recompute({ ...r, ingredients: newIngredients });
    });
    emitChange();
    persistRecipe(recipeId);
  },

  /** Update an ingredient within a recipe (e.g. portion or quantity change). */
  updateIngredient(
    recipeId: string,
    ingredientId: string,
    updates: Partial<RecipeIngredient>
  ) {
    recipes = recipes.map((r) => {
      if (r.id !== recipeId) return r;
      const newIngredients = r.ingredients.map((ing) => {
        if (ing.id !== ingredientId) return ing;
        const merged = { ...ing, ...updates };
        // Recompute macros if portion or quantity changed
        if (updates.portionIndex != null || updates.quantity != null) {
          const macros = computeIngredientMacros(
            merged.fdcId,
            merged.portionIndex,
            merged.quantity
          );
          return { ...merged, ...macros };
        }
        return merged;
      });
      return recompute({ ...r, ingredients: newIngredients });
    });
    emitChange();
    persistRecipe(recipeId);
  },

  /** Remove an ingredient from a recipe and recompute totals. */
  removeIngredient(recipeId: string, ingredientId: string) {
    recipes = recipes.map((r) => {
      if (r.id !== recipeId) return r;
      const newIngredients = r.ingredients.filter((ing) => ing.id !== ingredientId);
      return recompute({ ...r, ingredients: newIngredients });
    });
    emitChange();
    persistRecipe(recipeId);
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Fire-and-forget save of a recipe to Supabase */
function persistRecipe(recipeId: string) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (recipe) {
    saveRecipe(recipe).catch((err) =>
      console.error("[recipeStore] save failed:", err)
    );
  }
}

/** Recompute total + per-serving macros for a recipe. */
function recompute(recipe: Recipe): Recipe {
  const totals = computeRecipeTotals(recipe.ingredients);
  const perServing = computePerServingMacros(totals, recipe.servings);
  return { ...recipe, ...totals, ...perServing };
}

// ── React hooks ────────────────────────────────────────────────────────────

export function useRecipes(): Recipe[] {
  return useSyncExternalStore(
    recipeStore.subscribe,
    () => recipeStore.getAll(),
    () => recipeStore.getAll()
  );
}

export function useRecipe(id: string): Recipe | undefined {
  const getSnapshot = useMemo(() => () => recipeStore.getById(id), [id]);
  return useSyncExternalStore(recipeStore.subscribe, getSnapshot, getSnapshot);
}
