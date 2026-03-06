"use client";

import type { MealSlotConfig } from "@/lib/types";

interface DistributionChartProps {
  slots: MealSlotConfig[];
  totalCalories: number;
}

const SLOT_COLORS: Record<string, string> = {
  "Breakfast": "#f59e0b",
  "Morning Snack": "#fbbf24",
  "Lunch": "#3b82f6",
  "Pre-Workout": "#8b5cf6",
  "Post-Workout": "#a78bfa",
  "Dinner": "#ef4444",
  "Snack": "#10b981",
  "Evening Snack": "#34d399",
};

function getSlotColor(name: string, idx: number): string {
  return SLOT_COLORS[name] ?? [
    "#f59e0b", "#3b82f6", "#ef4444", "#10b981",
    "#8b5cf6", "#ec4899", "#f97316", "#06b6d4",
  ][idx % 8];
}

export function DistributionChart({
  slots,
  totalCalories,
}: DistributionChartProps) {
  const enabled = slots
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (enabled.length === 0) {
    return (
      <div className="text-xs text-muted text-center py-3">
        No meal slots enabled
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted">
        Calorie Distribution
      </label>

      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden bg-black/5">
        {enabled.map((slot, idx) => {
          const pct = slot.caloriePercentage;
          if (pct <= 0) return null;
          const color = getSlotColor(slot.name, idx);
          const kcal = Math.round((totalCalories * pct) / 100);

          return (
            <div
              key={slot.id}
              className="relative flex items-center justify-center transition-all group"
              style={{
                width: `${pct}%`,
                backgroundColor: color,
                minWidth: pct > 0 ? "24px" : 0,
              }}
              title={`${slot.name}: ${pct}% · ${kcal} kcal`}
            >
              {pct >= 12 && (
                <span className="text-[9px] font-bold text-white drop-shadow-sm truncate px-1">
                  {pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {enabled.map((slot, idx) => {
          const color = getSlotColor(slot.name, idx);
          const kcal = Math.round((totalCalories * slot.caloriePercentage) / 100);

          return (
            <div key={slot.id} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] font-medium text-foreground">
                {slot.name}
              </span>
              <span className="text-[10px] text-muted">
                {slot.caloriePercentage}% · {kcal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
