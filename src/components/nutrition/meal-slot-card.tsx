"use client";

import { useDroppable } from "@dnd-kit/core";
import { Trash2, ChefHat, Apple, Minus, Plus, ChevronDown } from "lucide-react";
import type {
  MealSlotConfig,
  PlanMeal,
  MealOption,
  Recipe,
  RecipeIngredient,
} from "@/lib/types";
import { recipeStore } from "@/lib/recipe-store";
import {
  getIngredientByFdcId,
  computeIngredientMacros,
} from "@/lib/nutrition-utils";
import { OptionCarousel } from "./option-carousel";

interface MealSlotCardProps {
  slot: MealSlotConfig;
  targetCalories: number;
  planMeal: PlanMeal;
  maxOptions: number;
  activeOptionNum: number;
  onActiveOptionChange: (optionNum: number) => void;
  onUpdateMeal: (updated: PlanMeal) => void;
  onRecipeClick?: (recipe: Recipe) => void;
}

const SLOT_COLORS: Record<string, string> = {
  Breakfast: "#f59e0b",
  "Morning Snack": "#fbbf24",
  Lunch: "#3b82f6",
  "Pre-Workout": "#8b5cf6",
  "Post-Workout": "#a78bfa",
  Dinner: "#ef4444",
  Snack: "#10b981",
  "Evening Snack": "#34d399",
};

function getSlotColor(name: string): string {
  return SLOT_COLORS[name] ?? "#6b7280";
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createEmptyOption(optionNumber: number): MealOption {
  return {
    id: `opt-${uid()}`,
    optionNumber,
    type: "recipe",
    recipeId: null,
    recipeServings: 1,
    ingredients: [],
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  };
}

export function MealSlotCard({
  slot,
  targetCalories,
  planMeal,
  maxOptions,
  activeOptionNum,
  onActiveOptionChange,
  onUpdateMeal,
  onRecipeClick,
}: MealSlotCardProps) {
  const slotKcal = Math.round((targetCalories * slot.caloriePercentage) / 100);
  const color = getSlotColor(slot.name);

  // Drop target
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${slot.id}`,
    data: { slotId: slot.id },
  });

  const activeOpt =
    planMeal.options.find((o) => o.optionNumber === activeOptionNum) ??
    planMeal.options[0];

  const fillPct = activeOpt
    ? Math.min((activeOpt.totalCalories / Math.max(slotKcal, 1)) * 100, 100)
    : 0;

  function addOption() {
    const nextNum =
      planMeal.options.length > 0
        ? Math.max(...planMeal.options.map((o) => o.optionNumber)) + 1
        : 1;
    const newOpt = createEmptyOption(nextNum);
    onUpdateMeal({
      ...planMeal,
      options: [...planMeal.options, newOpt],
    });
    onActiveOptionChange(nextNum);
  }

  function removeOption(optionNumber: number) {
    const remaining = planMeal.options.filter(
      (o) => o.optionNumber !== optionNumber
    );
    const renumbered = remaining.map((o, i) => ({
      ...o,
      optionNumber: i + 1,
    }));
    onUpdateMeal({ ...planMeal, options: renumbered });
    onActiveOptionChange(1);
  }

  function updateActiveOption(updates: Partial<MealOption>) {
    if (!activeOpt) return;
    const newOptions = planMeal.options.map((o) =>
      o.id === activeOpt.id ? { ...o, ...updates } : o
    );
    onUpdateMeal({ ...planMeal, options: newOptions });
  }

  function handleServingsChange(delta: number) {
    if (!activeOpt || !activeOpt.recipeId) return;
    const recipe = recipeStore.getById(activeOpt.recipeId);
    if (!recipe) return;
    const newServings = Math.max(0.5, (activeOpt.recipeServings || 1) + delta);
    updateActiveOption({
      recipeServings: newServings,
      totalCalories: recipe.perServingCalories * newServings,
      totalProtein: recipe.perServingProtein * newServings,
      totalCarbs: recipe.perServingCarbs * newServings,
      totalFat: recipe.perServingFat * newServings,
    });
  }

  function handleRemoveRecipe() {
    updateActiveOption({
      type: "recipe",
      recipeId: null,
      recipeServings: 1,
      ingredients: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    });
  }

  function handleRemoveIngredient(ingredientId: string) {
    if (!activeOpt) return;
    const newIngredients = activeOpt.ingredients.filter(
      (i) => i.id !== ingredientId
    );
    const totals = recomputeTotals(newIngredients);
    updateActiveOption({ ingredients: newIngredients, ...totals });
  }

  function handleUpdateIngredient(
    ingredientId: string,
    updates: Partial<RecipeIngredient>
  ) {
    if (!activeOpt) return;
    const newIngredients = activeOpt.ingredients.map((i) => {
      if (i.id !== ingredientId) return i;
      const merged = { ...i, ...updates };
      if (updates.portionIndex != null || updates.quantity != null) {
        const macros = computeIngredientMacros(
          merged.fdcId,
          merged.portionIndex,
          merged.quantity
        );
        const usdaIng = getIngredientByFdcId(merged.fdcId);
        const portion = usdaIng?.portions[merged.portionIndex];
        return {
          ...merged,
          portionLabel: portion?.label ?? "100 g",
          ...macros,
        };
      }
      return merged;
    });
    const totals = recomputeTotals(newIngredients);
    onUpdateMeal({
      ...planMeal,
      options: planMeal.options.map((o) =>
        o.id === activeOpt.id
          ? { ...o, ingredients: newIngredients, ...totals }
          : o
      ),
    });
  }

  const recipe = activeOpt?.recipeId
    ? recipeStore.getById(activeOpt.recipeId)
    : null;

  return (
    <div
      ref={setNodeRef}
      className={`glass-card overflow-hidden transition-all ${
        isOver
          ? "ring-2 ring-accent/50 bg-accent/[0.03] scale-[1.005]"
          : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5">
        <div
          className="w-1 h-8 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {slot.name}
            </h4>
            <span className="text-[10px] text-muted font-medium">
              {slot.caloriePercentage}% · {slotKcal} kcal target
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${fillPct}%`,
                  backgroundColor:
                    fillPct > 105
                      ? "#ef4444"
                      : fillPct > 90
                      ? color
                      : color + "80",
                }}
              />
            </div>
            <span className="text-[10px] font-medium text-muted tabular-nums shrink-0">
              {activeOpt ? Math.round(activeOpt.totalCalories) : 0} /{" "}
              {slotKcal}
            </span>
          </div>
        </div>
      </div>

      {/* Options carousel */}
      <div className="px-4 py-2 border-b border-black/5 bg-black/[0.01]">
        <OptionCarousel
          options={planMeal.options}
          activeOption={activeOptionNum}
          maxOptions={maxOptions}
          onSelectOption={onActiveOptionChange}
          onAddOption={addOption}
          onRemoveOption={removeOption}
        />
      </div>

      {/* Option content */}
      <div className="px-4 py-3 min-h-[60px]">
        {!activeOpt ? (
          <p className="text-xs text-muted text-center py-4">
            No options configured
          </p>
        ) : activeOpt.recipeId && recipe ? (
          /* ── Recipe option ──────────────────────────────────── */
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <ChefHat size={14} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onRecipeClick?.(recipe)}
                  className="text-sm font-medium text-foreground truncate hover:text-accent transition-colors text-left block w-full"
                >
                  {recipe.name}
                </button>
                <p className="text-[10px] text-muted">
                  {recipe.category} · {recipe.ingredients.length} ingredients
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveRecipe();
                }}
                className="p-1 rounded text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Servings control */}
            <div className="flex items-center gap-3 pl-11">
              <span className="text-[10px] text-muted">Servings:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServingsChange(-0.5);
                  }}
                  className="w-5 h-5 rounded bg-black/5 flex items-center justify-center text-muted hover:text-foreground"
                >
                  <Minus size={10} />
                </button>
                <span className="text-xs font-medium w-8 text-center tabular-nums">
                  {activeOpt.recipeServings}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServingsChange(0.5);
                  }}
                  className="w-5 h-5 rounded bg-black/5 flex items-center justify-center text-muted hover:text-foreground"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>

            {/* Macro summary */}
            <div className="flex items-center gap-3 pl-11 text-[10px] font-medium">
              <span className="text-foreground">
                {Math.round(activeOpt.totalCalories)} kcal
              </span>
              <span className="text-red-500">
                P{Math.round(activeOpt.totalProtein)}g
              </span>
              <span className="text-blue-500">
                C{Math.round(activeOpt.totalCarbs)}g
              </span>
              <span className="text-amber-500">
                F{Math.round(activeOpt.totalFat)}g
              </span>
            </div>
          </div>
        ) : activeOpt.ingredients.length > 0 ? (
          /* ── Ingredients list with editing ───────────────────── */
          <div className="space-y-2">
            {activeOpt.ingredients.map((ing) => (
              <IngredientRow
                key={ing.id}
                ing={ing}
                onUpdate={(updates) =>
                  handleUpdateIngredient(ing.id, updates)
                }
                onRemove={() => handleRemoveIngredient(ing.id)}
              />
            ))}
            {/* Totals */}
            <div className="flex items-center gap-3 pt-1.5 border-t border-black/5 text-[10px] font-medium">
              <span className="text-foreground">
                {Math.round(activeOpt.totalCalories)} kcal
              </span>
              <span className="text-red-500">
                P{Math.round(activeOpt.totalProtein)}g
              </span>
              <span className="text-blue-500">
                C{Math.round(activeOpt.totalCarbs)}g
              </span>
              <span className="text-amber-500">
                F{Math.round(activeOpt.totalFat)}g
              </span>
            </div>
          </div>
        ) : (
          /* ── Empty state — drop zone hint ────────────────────── */
          <div
            className={`text-center py-4 rounded-lg border-2 border-dashed transition-colors ${
              isOver
                ? "border-accent/40 bg-accent/[0.03]"
                : "border-transparent"
            }`}
          >
            <p className="text-xs text-muted">
              Drag a recipe or ingredient here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ingredient Row with editing ────────────────────────────────────────────

function IngredientRow({
  ing,
  onUpdate,
  onRemove,
}: {
  ing: RecipeIngredient;
  onUpdate: (updates: Partial<RecipeIngredient>) => void;
  onRemove: () => void;
}) {
  const usdaIng = getIngredientByFdcId(ing.fdcId);
  const portions = usdaIng?.portions ?? [];

  return (
    <div className="flex items-start gap-2 py-1.5">
      <Apple size={10} className="text-muted shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {ing.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {/* Quantity input */}
          <input
            type="number"
            value={ing.quantity}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) onUpdate({ quantity: val });
            }}
            min={0.1}
            step={0.1}
            className="w-14 px-1.5 py-0.5 rounded-l bg-black/5 border border-black/10 border-r-0 text-[10px] text-foreground text-center focus:outline-none focus:border-accent/50 tabular-nums"
          />
          {/* Portion dropdown */}
          <div className="relative">
            <select
              value={ing.portionIndex}
              onChange={(e) =>
                onUpdate({ portionIndex: parseInt(e.target.value) })
              }
              className="px-1.5 py-0.5 pr-5 rounded-r bg-black/5 border border-black/10 text-[10px] text-foreground focus:outline-none focus:border-accent/50 appearance-none"
            >
              {portions.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={8}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
          <span className="text-[10px] text-muted tabular-nums">
            ({Math.round(ing.gramWeight)}g)
          </span>
        </div>
      </div>
      {/* Macros */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[10px] font-medium text-foreground tabular-nums">
          {Math.round(ing.calories)} kcal
        </span>
        <div className="flex gap-1.5 text-[9px] font-medium">
          <span className="text-red-500">P{ing.protein.toFixed(1)}</span>
          <span className="text-blue-500">
            C{Math.max(0, ing.carbs).toFixed(1)}
          </span>
          <span className="text-amber-500">F{ing.fat.toFixed(1)}</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-0.5 rounded text-muted hover:text-red-500 transition-colors shrink-0 mt-0.5"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function recomputeTotals(ingredients: RecipeIngredient[]) {
  return ingredients.reduce(
    (acc, i) => ({
      totalCalories: acc.totalCalories + i.calories,
      totalProtein: acc.totalProtein + i.protein,
      totalCarbs: acc.totalCarbs + i.carbs,
      totalFat: acc.totalFat + i.fat,
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
  );
}

export { createEmptyOption };
