/**
 * Plan-level micronutrient computation utilities.
 * Separated from nutrition-utils.ts to avoid circular dependencies with recipe-store.
 */

import type { PlanMeal, MealSlotConfig } from "./types";
import { getIngredientByFdcId } from "./nutrition-utils";
import { recipeStore } from "./recipe-store";
import { NUTRIENT_DEFINITIONS } from "./ingredient-data";

/**
 * Compute aggregated micronutrients for all enabled slots in a day type.
 * Uses the active option per slot (or first option if unspecified).
 */
export function computePlanMicronutrients(
  planMeals: PlanMeal[],
  dayTypeId: string,
  enabledSlots: MealSlotConfig[],
  activeOptionBySlot: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const slot of enabledSlots) {
    const pm = planMeals.find(
      (m) => m.dayTypeId === dayTypeId && m.mealSlotId === slot.id
    );
    if (!pm) continue;

    const optNum = activeOptionBySlot[slot.id] ?? 1;
    const opt = pm.options.find((o) => o.optionNumber === optNum) ?? pm.options[0];
    if (!opt) continue;

    if (opt.recipeId) {
      // Recipe option: look up recipe, scale each ingredient
      const recipe = recipeStore.getById(opt.recipeId);
      if (recipe) {
        const servingsRatio =
          (opt.recipeServings || 1) / Math.max(1, recipe.servings);
        for (const ing of recipe.ingredients) {
          const usda = getIngredientByFdcId(ing.fdcId);
          if (!usda) continue;
          const scale = (ing.gramWeight / 100) * servingsRatio;
          for (const [key, value] of Object.entries(usda.nutrients)) {
            if (typeof value === "number") {
              result[key] = (result[key] ?? 0) + value * scale;
            }
          }
        }
      }
    } else {
      // Ingredient option: scale directly
      for (const ing of opt.ingredients) {
        const usda = getIngredientByFdcId(ing.fdcId);
        if (!usda) continue;
        const scale = ing.gramWeight / 100;
        for (const [key, value] of Object.entries(usda.nutrients)) {
          if (typeof value === "number") {
            result[key] = (result[key] ?? 0) + value * scale;
          }
        }
      }
    }
  }

  return result;
}

export interface MicronutrientGroupItem {
  key: string;
  label: string;
  unit: string;
  value: number;
}

export interface MicronutrientGroups {
  mineral: MicronutrientGroupItem[];
  vitamin: MicronutrientGroupItem[];
  lipid: MicronutrientGroupItem[];
}

/**
 * Group micronutrient totals by mineral / vitamin / lipid.
 * Filters out zero/trace values for cleaner display.
 */
export function groupMicronutrients(
  micros: Record<string, number>
): MicronutrientGroups {
  const groups: MicronutrientGroups = {
    mineral: [],
    vitamin: [],
    lipid: [],
  };

  for (const def of NUTRIENT_DEFINITIONS) {
    if (def.group === "mineral" || def.group === "vitamin" || def.group === "lipid") {
      const value = micros[def.key] ?? 0;
      if (value > 0.001) {
        groups[def.group].push({
          key: def.key,
          label: def.label,
          unit: def.unit,
          value,
        });
      }
    }
  }

  return groups;
}
