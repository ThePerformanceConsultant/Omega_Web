"use client";

import { useMemo, useState } from "react";
import { X, ChevronDown, ChevronRight, ChefHat, Clock, Users, Pencil } from "lucide-react";
import type { Recipe } from "@/lib/types";
import { getIngredientByFdcId } from "@/lib/nutrition-utils";
import { NUTRIENT_DEFINITIONS } from "@/lib/ingredient-data";
import { formatPercentRda } from "@/lib/nutrient-reference-values";

interface RecipeDetailPanelProps {
  recipe: Recipe;
  onClose: () => void;
  onEditForClient?: () => void;
}

export function RecipeDetailPanel({ recipe, onClose, onEditForClient }: RecipeDetailPanelProps) {
  const [showMicros, setShowMicros] = useState(false);

  // Compute aggregate micronutrients
  const micronutrients = useMemo(() => {
    const result: Record<string, number> = {};
    for (const ing of recipe.ingredients) {
      const usda = getIngredientByFdcId(ing.fdcId);
      if (!usda) continue;
      const scale = ing.gramWeight / 100;
      for (const [key, value] of Object.entries(usda.nutrients)) {
        if (typeof value === "number") {
          result[key] = (result[key] ?? 0) + value * scale;
        }
      }
    }
    return result;
  }, [recipe.ingredients]);

  const microGroups = useMemo(() => {
    const groups: Record<string, { key: string; label: string; unit: string; value: number }[]> = {
      mineral: [],
      vitamin: [],
      lipid: [],
    };
    for (const def of NUTRIENT_DEFINITIONS) {
      if (def.group === "mineral" || def.group === "vitamin" || def.group === "lipid") {
        const value = micronutrients[def.key] ?? 0;
        if (value > 0.001) {
          groups[def.group].push({ key: def.key, label: def.label, unit: def.unit, value });
        }
      }
    }
    return groups;
  }, [micronutrients]);

  return (
    <div className="w-80 shrink-0 border-l border-black/10 bg-white flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 shrink-0">
        <div className="flex items-center gap-2">
          <ChefHat size={14} className="text-accent" />
          <h3 className="text-sm font-bold text-foreground truncate">{recipe.name}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onEditForClient && (
            <button
              onClick={onEditForClient}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-accent hover:bg-accent/10 transition-colors"
            >
              <Pencil size={10} />
              Edit for client
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-black/5"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Image */}
        {recipe.imageUrl && (
          <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-32 object-cover rounded-lg" />
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
            {recipe.category}
          </span>
          {recipe.prepTimeMinutes && (
            <span className="flex items-center gap-1">
              <Clock size={10} /> {recipe.prepTimeMinutes} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={10} /> {recipe.servings} srv
          </span>
        </div>

        {recipe.description && (
          <p className="text-xs text-muted">{recipe.description}</p>
        )}

        {/* Macros per serving */}
        <div className="bg-accent/5 rounded-lg p-3">
          <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-2">Per Serving</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-foreground">{Math.round(recipe.perServingCalories)}</p>
              <p className="text-[9px] text-muted">kcal</p>
            </div>
            <div>
              <p className="text-sm font-bold text-red-500">{Math.round(recipe.perServingProtein)}g</p>
              <p className="text-[9px] text-muted">Protein</p>
            </div>
            <div>
              <p className="text-sm font-bold text-blue-500">{Math.round(recipe.perServingCarbs)}g</p>
              <p className="text-[9px] text-muted">Carbs</p>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-500">{Math.round(recipe.perServingFat)}g</p>
              <p className="text-[9px] text-muted">Fat</p>
            </div>
            <div>
              <p className="text-sm font-bold text-green-600">
                {Math.round((micronutrients.fiber ?? 0) / Math.max(1, recipe.servings))}g
              </p>
              <p className="text-[9px] text-muted">Fibre</p>
            </div>
          </div>
        </div>

        {/* Ingredients list */}
        <div>
          <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-2">
            Ingredients ({recipe.ingredients.length})
          </p>
          <div className="space-y-1">
            {recipe.ingredients.map((ing) => (
              <div key={ing.id} className="flex items-center justify-between py-1 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground truncate">{ing.name}</p>
                  <p className="text-[10px] text-muted">
                    {ing.quantity} × {ing.portionLabel} ({Math.round(ing.gramWeight)}g)
                  </p>
                </div>
                <div className="flex gap-2 text-[10px] font-medium shrink-0 ml-2">
                  <span className="text-red-500">P{ing.protein.toFixed(1)}</span>
                  <span className="text-blue-500">C{Math.max(0, ing.carbs).toFixed(1)}</span>
                  <span className="text-amber-500">F{ing.fat.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {recipe.instructions && (
          <div>
            <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-2">
              Instructions
            </p>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {recipe.instructions}
            </p>
          </div>
        )}

        {/* Full nutrition profile (expandable) */}
        <div>
          <button
            onClick={() => setShowMicros(!showMicros)}
            className="flex items-center gap-1.5 text-[10px] font-medium text-muted uppercase tracking-wider hover:text-foreground transition-colors"
          >
            {showMicros ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Full Nutrition Profile
          </button>

          {showMicros && (
            <div className="mt-2 space-y-3">
              {Object.entries(microGroups).map(([group, items]) =>
                items.length > 0 ? (
                  <div key={group}>
                    <h5 className="text-[9px] font-semibold text-muted uppercase tracking-wider mb-1 capitalize">
                      {group}
                    </h5>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const percentRda = formatPercentRda(item.key, item.value);
                        return (
                          <div key={item.key} className="flex items-center justify-between text-[10px] py-0.5">
                            <span className="text-muted">{item.label}</span>
                            <span className="font-medium tabular-nums inline-flex items-center gap-1">
                              <span>
                                {item.value < 1 ? item.value.toFixed(2) : item.value.toFixed(1)} {item.unit}
                              </span>
                              {percentRda && (
                                <span className="text-accent/90 text-[9px]">{percentRda}</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
