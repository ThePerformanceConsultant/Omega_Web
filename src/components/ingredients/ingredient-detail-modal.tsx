"use client";

import { useState, useMemo } from "react";
import { X, Flame, Droplets, Wheat, Beef, ChevronDown, Database } from "lucide-react";
import {
  USDAIngredient,
  USDANutrientDef,
  NUTRIENT_DEFINITIONS,
} from "@/lib/ingredient-data";
import { NUTRIENT_GROUPS, NutrientGroup } from "@/lib/types";

interface IngredientDetailModalProps {
  ingredient: USDAIngredient;
  onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  usda_survey: "USDA",
  mccance_widdowson: "McCance",
  open_food_facts: "Open Food Facts",
  coach_custom: "Custom",
};

/** Compute nutrient value scaled to a given portion gram weight.
 *  Stored values are per 100 g. */
function scaleNutrient(per100g: number | undefined, gramWeight: number): number | null {
  if (per100g == null) return null;
  return (per100g * gramWeight) / 100;
}

function fmt(value: number | null, decimals = 1): string {
  if (value == null) return "—";
  const clamped = Math.max(0, value); // USDA "by difference" can produce small negatives
  if (clamped < 0.005 && decimals <= 1) return "0";
  return clamped.toFixed(decimals);
}

// Macro keys for the summary ring at top
const MACRO_KEYS = ["protein", "totalFat", "carbohydrate", "fiber"] as const;

const MACRO_META: Record<string, { label: string; color: string; icon: typeof Beef }> = {
  protein: { label: "Protein", color: "#ef4444", icon: Beef },
  totalFat: { label: "Fat", color: "#f59e0b", icon: Droplets },
  carbohydrate: { label: "Carbs", color: "#3b82f6", icon: Wheat },
  fiber: { label: "Fiber", color: "#22c55e", icon: Wheat },
};

// Group nutrient definitions for display
function groupNutrients(defs: USDANutrientDef[]): Record<NutrientGroup, USDANutrientDef[]> {
  const groups: Record<NutrientGroup, USDANutrientDef[]> = {
    general: [],
    macro: [],
    lipid: [],
    mineral: [],
    vitamin: [],
  };
  for (const def of defs) {
    groups[def.group].push(def);
  }
  return groups;
}

export function IngredientDetailModal({ ingredient, onClose }: IngredientDetailModalProps) {
  const [portionIdx, setPortionIdx] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<NutrientGroup>>(
    new Set(["macro", "lipid", "mineral", "vitamin"])
  );

  const portion = ingredient.portions[portionIdx];
  const gramWeight = portion.gramWeight;

  // Scale all nutrients to current portion
  const scaled = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const def of NUTRIENT_DEFINITIONS) {
      result[def.key] = scaleNutrient(ingredient.nutrients[def.key], gramWeight);
    }
    return result;
  }, [ingredient.nutrients, gramWeight]);

  const calories = scaled.calories;

  const grouped = useMemo(() => groupNutrients(NUTRIENT_DEFINITIONS), []);
  const sourceLabel = SOURCE_LABELS[ingredient.source ?? "usda_survey"] ?? "USDA";

  function toggleGroup(group: NutrientGroup) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  // Calculate macro percentages for the bar
  const proteinCal = (scaled.protein ?? 0) * 4;
  const carbCal = (scaled.carbohydrate ?? 0) * 4;
  const fatCal = (scaled.totalFat ?? 0) * 9;
  const totalMacroCal = proteinCal + carbCal + fatCal || 1;
  const proteinPct = (proteinCal / totalMacroCal) * 100;
  const carbPct = (carbCal / totalMacroCal) * 100;
  const fatPct = (fatCal / totalMacroCal) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-black/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground leading-tight">{ingredient.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
                  <Database size={9} />
                  {sourceLabel}
                </span>
                <span className="text-xs text-muted">{ingredient.category}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 text-muted transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Portion selector */}
          <div className="mt-4">
            <label className="block text-[10px] font-medium text-muted uppercase tracking-wider mb-1">
              Serving Size
            </label>
            <div className="relative">
              <select
                value={portionIdx}
                onChange={(e) => setPortionIdx(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm text-foreground font-medium focus:outline-none focus:border-accent/50 appearance-none pr-8"
              >
                {ingredient.portions.map((p, i) => (
                  <option key={i} value={i}>
                    {p.label} ({p.gramWeight}g)
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Calorie hero card */}
          <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame size={16} className="text-accent" />
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Energy</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">{fmt(calories, 0)}</span>
              <span className="text-sm text-muted font-medium">kcal</span>
            </div>

            {/* Macro bar */}
            <div className="mt-3 h-2.5 rounded-full overflow-hidden flex bg-black/5">
              <div
                className="h-full transition-all"
                style={{ width: `${proteinPct}%`, backgroundColor: "#ef4444" }}
              />
              <div
                className="h-full transition-all"
                style={{ width: `${carbPct}%`, backgroundColor: "#3b82f6" }}
              />
              <div
                className="h-full transition-all"
                style={{ width: `${fatPct}%`, backgroundColor: "#f59e0b" }}
              />
            </div>

            {/* Macro summary row */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {MACRO_KEYS.map((key) => {
                const meta = MACRO_META[key];
                const value = scaled[key];
                return (
                  <div key={key} className="text-center">
                    <div className="text-lg font-bold" style={{ color: meta.color }}>
                      {fmt(value)}
                      <span className="text-[10px] font-medium text-muted ml-0.5">g</span>
                    </div>
                    <div className="text-[10px] text-muted font-medium">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nutrient groups */}
          {NUTRIENT_GROUPS.map(({ key: groupKey, label: groupLabel, color: groupColor }) => {
            const nutrients = grouped[groupKey];
            // Filter out nutrients that have no value for this food
            const available = nutrients.filter(
              (n) => ingredient.nutrients[n.key] != null
            );
            if (available.length === 0) return null;

            // Skip "general" display items already shown in the calorie card (calories, water, ash, alcohol)
            // but still show them in expandable group
            const isExpanded = expandedGroups.has(groupKey);

            return (
              <div key={groupKey}>
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full flex items-center justify-between py-1.5 group"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-4 rounded-full"
                      style={{ backgroundColor: groupColor }}
                    />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {groupLabel}
                    </span>
                    <span className="text-[10px] text-muted">({available.length})</span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-muted transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="mt-1 rounded-lg border border-black/5 overflow-hidden">
                    {available.map((n, i) => {
                      const value = scaled[n.key];
                      return (
                        <div
                          key={n.key}
                          className={`flex items-center justify-between px-3 py-2 ${
                            i % 2 === 0 ? "bg-black/[0.01]" : "bg-white"
                          }`}
                        >
                          <span className="text-xs text-foreground">{n.label}</span>
                          <span className="text-xs font-semibold text-foreground tabular-nums">
                            {fmt(value)} <span className="text-muted font-normal">{n.unit}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
