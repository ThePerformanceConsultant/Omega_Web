"use client";

import { ChevronDown } from "lucide-react";
import type { MacroSplit, MacroSplitPreset } from "@/lib/types";
import { MACRO_SPLIT_PRESETS } from "@/lib/types";
import { computeGramTargets } from "@/lib/nutrition-utils";

const presetKeys = Object.keys(MACRO_SPLIT_PRESETS) as MacroSplitPreset[];

interface MacroSplitSelectorProps {
  calories: number;
  split: MacroSplit;
  preset: MacroSplitPreset | "Custom";
  onChange: (split: MacroSplit, preset: MacroSplitPreset | "Custom") => void;
}

export function MacroSplitSelector({
  calories,
  split,
  preset,
  onChange,
}: MacroSplitSelectorProps) {
  const grams = computeGramTargets(calories, split);
  const total = split.protein + split.carbs + split.fat;
  const isValid = Math.abs(total - 100) < 0.5;

  function handlePreset(key: string) {
    if (key === "Custom") {
      onChange(split, "Custom");
    } else {
      const p = key as MacroSplitPreset;
      const newSplit = { ...MACRO_SPLIT_PRESETS[p] };
      onChange(newSplit, p);
    }
  }

  function handleField(field: keyof MacroSplit, value: number) {
    const clamped = Math.max(0, Math.min(100, value));
    const newSplit = { ...split, [field]: clamped };
    onChange(newSplit, "Custom");
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-muted">
        Macro Split
      </label>

      {/* Preset dropdown */}
      <div className="relative">
        <select
          value={preset}
          onChange={(e) => handlePreset(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none pr-8"
        >
          {presetKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
          <option value="Custom">Custom</option>
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
      </div>

      {/* P / C / F inputs */}
      <div className="grid grid-cols-3 gap-3">
        <MacroInput
          label="Protein"
          color="text-red-500"
          value={split.protein}
          grams={grams.proteinGrams}
          onChange={(v) => handleField("protein", v)}
        />
        <MacroInput
          label="Carbs"
          color="text-blue-500"
          value={split.carbs}
          grams={grams.carbsGrams}
          onChange={(v) => handleField("carbs", v)}
        />
        <MacroInput
          label="Fat"
          color="text-amber-500"
          value={split.fat}
          grams={grams.fatGrams}
          onChange={(v) => handleField("fat", v)}
        />
      </div>

      {/* Validation */}
      {!isValid && (
        <p className="text-xs text-red-500">
          Split must total 100% (currently {total}%)
        </p>
      )}

      {/* Visual bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-black/5">
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${split.protein}%` }}
        />
        <div
          className="bg-blue-500 transition-all"
          style={{ width: `${split.carbs}%` }}
        />
        <div
          className="bg-amber-500 transition-all"
          style={{ width: `${split.fat}%` }}
        />
      </div>
    </div>
  );
}

function MacroInput({
  label,
  color,
  value,
  grams,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  grams: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className={`block text-[10px] font-semibold ${color} mb-1`}>
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground focus:outline-none focus:border-accent/50 pr-7"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">
          %
        </span>
      </div>
      <p className="text-[10px] text-muted mt-0.5">{grams}g</p>
    </div>
  );
}
