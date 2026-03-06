"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { DayType, MacroSplit, MacroSplitPreset, MealSlotConfig } from "@/lib/types";
import { computeGramTargets } from "@/lib/nutrition-utils";
import { MacroSplitSelector } from "./macro-split-selector";
import { MealSlotList } from "./meal-slot-list";
import { DistributionChart } from "./distribution-chart";

interface DayTypeConfigProps {
  dayType: DayType;
  onChange: (updated: DayType) => void;
  onRemove?: () => void;
  canRemove: boolean;
  defaultExpanded?: boolean;
}

export function DayTypeConfig({
  dayType,
  onChange,
  onRemove,
  canRemove,
  defaultExpanded = true,
}: DayTypeConfigProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  function updateField<K extends keyof DayType>(key: K, value: DayType[K]) {
    onChange({ ...dayType, [key]: value });
  }

  function handleCaloriesChange(cals: number) {
    const grams = computeGramTargets(cals, dayType.macroSplit);
    onChange({
      ...dayType,
      targetCalories: cals,
      targetProteinGrams: grams.proteinGrams,
      targetCarbsGrams: grams.carbsGrams,
      targetFatGrams: grams.fatGrams,
    });
  }

  function handleSplitChange(split: MacroSplit, preset: MacroSplitPreset | "Custom") {
    const grams = computeGramTargets(dayType.targetCalories, split);
    onChange({
      ...dayType,
      macroSplit: split,
      macroSplitPreset: preset,
      targetProteinGrams: grams.proteinGrams,
      targetCarbsGrams: grams.carbsGrams,
      targetFatGrams: grams.fatGrams,
    });
  }

  function handleSlotsChange(slots: MealSlotConfig[]) {
    updateField("mealSlots", slots);
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">
            {dayType.name}
          </span>
          <span className="text-xs text-muted ml-2">
            {dayType.targetCalories} kcal · {dayType.macroSplitPreset}
          </span>
        </div>
        {canRemove && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-5 border-t border-black/5">
          {/* Day type name + Calories */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Day Type Name
              </label>
              <input
                type="text"
                value={dayType.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Target Calories
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={dayType.targetCalories}
                  onChange={(e) =>
                    handleCaloriesChange(Number(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground focus:outline-none focus:border-accent/50 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                  kcal
                </span>
              </div>
            </div>
          </div>

          {/* Macro split */}
          <MacroSplitSelector
            calories={dayType.targetCalories}
            split={dayType.macroSplit}
            preset={dayType.macroSplitPreset}
            onChange={handleSplitChange}
          />

          {/* Gram targets summary */}
          <div className="grid grid-cols-3 gap-3">
            <GramTarget
              label="Protein"
              grams={dayType.targetProteinGrams}
              color="text-red-500"
            />
            <GramTarget
              label="Carbs"
              grams={dayType.targetCarbsGrams}
              color="text-blue-500"
            />
            <GramTarget
              label="Fat"
              grams={dayType.targetFatGrams}
              color="text-amber-500"
            />
          </div>

          {/* Meal slots */}
          <MealSlotList
            slots={dayType.mealSlots}
            onChange={handleSlotsChange}
          />

          {/* Distribution chart */}
          <DistributionChart
            slots={dayType.mealSlots}
            totalCalories={dayType.targetCalories}
          />
        </div>
      )}
    </div>
  );
}

function GramTarget({
  label,
  grams,
  color,
}: {
  label: string;
  grams: number;
  color: string;
}) {
  return (
    <div className="text-center px-3 py-2 rounded-lg bg-black/[0.02] border border-black/5">
      <p className={`text-lg font-bold ${color}`}>{grams}g</p>
      <p className="text-[10px] text-muted font-medium">{label}</p>
    </div>
  );
}
