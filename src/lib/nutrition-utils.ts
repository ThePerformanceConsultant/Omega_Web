/**
 * Pure utility functions for nutrition macro computation.
 * No state, no React — just math.
 */

import { USDA_INGREDIENTS, USDAIngredient } from "./ingredient-data";
import type { MacroSplit, MealSlotConfig, RecipeIngredient } from "./types";

// ── Ingredient lookup ──────────────────────────────────────────────────────

const ingredientMap = new Map<number, USDAIngredient>();
for (const ing of USDA_INGREDIENTS) {
  ingredientMap.set(ing.fdcId, ing);
}

export function getIngredientByFdcId(fdcId: number): USDAIngredient | undefined {
  return ingredientMap.get(fdcId);
}

export function registerIngredient(ingredient: USDAIngredient) {
  ingredientMap.set(ingredient.fdcId, ingredient);
}

// ── Ingredient macro computation ───────────────────────────────────────────

/** Compute macros for a recipe ingredient (portion × quantity, scaled from per-100g). */
export function computeIngredientMacros(
  fdcId: number,
  portionIndex: number,
  quantity: number
): {
  gramWeight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const ingredient = ingredientMap.get(fdcId);
  if (!ingredient) {
    return { gramWeight: 0, calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const portion = ingredient.portions[portionIndex] ?? ingredient.portions[0];
  const totalGrams = portion.gramWeight * quantity;
  const scale = totalGrams / 100;

  return {
    gramWeight: round(totalGrams),
    calories: round((ingredient.nutrients.calories ?? 0) * scale),
    protein: round((ingredient.nutrients.protein ?? 0) * scale),
    carbs: round(Math.max(0, (ingredient.nutrients.carbohydrate ?? 0)) * scale),
    fat: round((ingredient.nutrients.totalFat ?? 0) * scale),
  };
}

/** Build a full RecipeIngredient object from an fdcId + portion + quantity. */
export function buildRecipeIngredient(
  fdcId: number,
  portionIndex: number,
  quantity: number,
  id?: string
): RecipeIngredient {
  const ingredient = ingredientMap.get(fdcId);
  const portion = ingredient?.portions[portionIndex] ?? ingredient?.portions[0];
  const macros = computeIngredientMacros(fdcId, portionIndex, quantity);

  return {
    id: id ?? `ri-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fdcId,
    name: ingredient?.name ?? "Unknown",
    portionIndex,
    portionLabel: portion?.label ?? "100 g",
    quantity,
    ...macros,
  };
}

// ── Recipe totals ──────────────────────────────────────────────────────────

export function computeRecipeTotals(ingredients: RecipeIngredient[]) {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const ing of ingredients) {
    totalCalories += ing.calories;
    totalProtein += ing.protein;
    totalCarbs += ing.carbs;
    totalFat += ing.fat;
  }

  return {
    totalCalories: round(totalCalories),
    totalProtein: round(totalProtein),
    totalCarbs: round(totalCarbs),
    totalFat: round(totalFat),
  };
}

export function computePerServingMacros(
  totals: { totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number },
  servings: number
) {
  const s = Math.max(1, servings);
  return {
    perServingCalories: round(totals.totalCalories / s),
    perServingProtein: round(totals.totalProtein / s),
    perServingCarbs: round(totals.totalCarbs / s),
    perServingFat: round(totals.totalFat / s),
  };
}

// ── Macro split ↔ gram conversions ─────────────────────────────────────────

/** Convert calorie target + macro split percentages → gram targets. */
export function computeGramTargets(
  calories: number,
  split: MacroSplit
): { proteinGrams: number; carbsGrams: number; fatGrams: number } {
  return {
    proteinGrams: Math.round((calories * split.protein) / 100 / 4),
    carbsGrams: Math.round((calories * split.carbs) / 100 / 4),
    fatGrams: Math.round((calories * split.fat) / 100 / 9),
  };
}

// ── Percentage distribution ────────────────────────────────────────────────

/** Validate that enabled slot percentages sum to 100. */
export function validatePercentageSum(slots: MealSlotConfig[]): {
  valid: boolean;
  total: number;
} {
  const enabled = slots.filter((s) => s.enabled);
  const total = enabled.reduce((sum, s) => sum + s.caloriePercentage, 0);
  return { valid: Math.abs(total - 100) < 0.5, total: Math.round(total) };
}

/** Auto-balance: distribute evenly among enabled slots. */
export function autoBalancePercentages(slots: MealSlotConfig[]): MealSlotConfig[] {
  const enabledCount = slots.filter((s) => s.enabled).length;
  if (enabledCount === 0) return slots;

  const each = Math.floor(100 / enabledCount);
  const remainder = 100 - each * enabledCount;
  let idx = 0;

  return slots.map((s) => {
    if (!s.enabled) return { ...s, caloriePercentage: 0 };
    const pct = each + (idx === 0 ? remainder : 0);
    idx++;
    return { ...s, caloriePercentage: pct };
  });
}

/** Adjust percentages after one slot changes — proportionally redistribute among others. */
export function redistributePercentages(
  slots: MealSlotConfig[],
  changedSlotId: string,
  newValue: number
): MealSlotConfig[] {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const enabled = slots.filter((s) => s.enabled);
  const others = enabled.filter((s) => s.id !== changedSlotId);

  if (others.length === 0) {
    return slots.map((s) =>
      s.id === changedSlotId ? { ...s, caloriePercentage: 100 } : s
    );
  }

  const remaining = 100 - clamped;
  const oldOtherTotal = others.reduce((sum, s) => sum + s.caloriePercentage, 0) || 1;

  return slots.map((s) => {
    if (s.id === changedSlotId) return { ...s, caloriePercentage: clamped };
    if (!s.enabled) return { ...s, caloriePercentage: 0 };
    const ratio = s.caloriePercentage / oldOtherTotal;
    return { ...s, caloriePercentage: Math.round(remaining * ratio) };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function round(n: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
