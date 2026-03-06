"use client";

import { useState } from "react";
import { Plus, Save, ChevronDown } from "lucide-react";
import type { MealPlanTemplate, DayType, ClientExtendedInfo } from "@/lib/types";
import type { NutritionOnboardingData } from "@/lib/nutrition-questionnaire-data";
import { createDefaultDayType } from "@/lib/meal-plan-store";
import { Drawer } from "@/components/ui/drawer";
import { DayTypeConfig } from "./day-type-config";
import { NutritionQuestionnaireSection } from "./nutrition-questionnaire-section";

interface MealPlanDrawerProps {
  open: boolean;
  onClose: () => void;
  template: MealPlanTemplate;
  onSave: (template: MealPlanTemplate) => void;
  clientInfo?: ClientExtendedInfo | null;
  onboardingData?: NutritionOnboardingData | null;
}

export function MealPlanDrawer({
  open,
  onClose,
  template,
  onSave,
  clientInfo,
  onboardingData,
}: MealPlanDrawerProps) {
  const [draft, setDraft] = useState<MealPlanTemplate>(template);

  // Reset draft when template changes (opening new/different plan)
  // We use key-based reset by passing template.id as key in the parent

  function updateField<K extends keyof MealPlanTemplate>(
    key: K,
    value: MealPlanTemplate[K]
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateDayType(idx: number, updated: DayType) {
    const newDayTypes = [...draft.dayTypes];
    newDayTypes[idx] = updated;
    setDraft((prev) => ({ ...prev, dayTypes: newDayTypes }));
  }

  function addDayType() {
    const names = ["Training Day", "Rest Day", "High Carb Day", "Low Carb Day", "Refeed Day"];
    const existingNames = new Set(draft.dayTypes.map((d) => d.name));
    const nextName = names.find((n) => !existingNames.has(n)) ?? `Day Type ${draft.dayTypes.length + 1}`;
    const newDayType = createDefaultDayType(nextName);
    setDraft((prev) => ({
      ...prev,
      dayTypes: [...prev.dayTypes, newDayType],
    }));
  }

  function removeDayType(idx: number) {
    if (draft.dayTypes.length <= 1) return;
    const newDayTypes = draft.dayTypes.filter((_, i) => i !== idx);
    setDraft((prev) => ({ ...prev, dayTypes: newDayTypes }));
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    onSave(draft);
  }

  const canSave = draft.name.trim().length > 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={draft.id.startsWith("mp-") && !template.name ? "New Meal Plan" : "Edit Meal Plan"}
      subtitle="Configure your meal plan structure"
      footer={
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-5 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} /> Save Plan
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Plan name + description */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Plan Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Cutting Plan - 2500 kcal"
              className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Description
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Optional notes about this plan..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>
        </div>

        {/* Max options per meal */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Max Options per Meal
          </label>
          <p className="text-[10px] text-muted/70 mb-1.5">
            How many recipe/ingredient alternatives per meal slot
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => updateField("maxOptionsPerMeal", n)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  draft.maxOptionsPerMeal === n
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "bg-black/5 text-muted border border-black/10 hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Status
          </label>
          <div className="relative">
            <select
              value={draft.status}
              onChange={(e) =>
                updateField(
                  "status",
                  e.target.value as "draft" | "active" | "template"
                )
              }
              className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none pr-8"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="template">Template</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-black/10" />

        {/* Day Types */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Day Types
              </h3>
              <p className="text-[10px] text-muted mt-0.5">
                Configure calories, macro split, and meal slots for each day type
              </p>
            </div>
            <button
              onClick={addDayType}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
            >
              <Plus size={12} /> Add Day Type
            </button>
          </div>

          <div className="space-y-3">
            {draft.dayTypes.map((dt, idx) => (
              <DayTypeConfig
                key={dt.id}
                dayType={dt}
                onChange={(updated) => updateDayType(idx, updated)}
                onRemove={() => removeDayType(idx)}
                canRemove={draft.dayTypes.length > 1}
                defaultExpanded={draft.dayTypes.length === 1 || idx === draft.dayTypes.length - 1}
              />
            ))}
          </div>
        </div>

        {/* Client nutrition questionnaire — shown when onboarding data available */}
        {onboardingData && (
          <>
            <div className="border-t border-black/10" />
            <NutritionQuestionnaireSection
              data={onboardingData}
              onApplyCalories={(kcal) => {
                // Apply TDEE to first day type target calories
                if (draft.dayTypes[0]) {
                  const split = draft.dayTypes[0].macroSplit;
                  const updated = {
                    ...draft.dayTypes[0],
                    targetCalories: kcal,
                    targetProteinGrams: Math.round((kcal * split.protein) / 100 / 4),
                    targetCarbsGrams: Math.round((kcal * split.carbs) / 100 / 4),
                    targetFatGrams: Math.round((kcal * split.fat) / 100 / 9),
                  };
                  const newDayTypes = [...draft.dayTypes];
                  newDayTypes[0] = updated;
                  setDraft((prev) => ({ ...prev, dayTypes: newDayTypes }));
                }
              }}
            />
          </>
        )}
      </div>
    </Drawer>
  );
}
