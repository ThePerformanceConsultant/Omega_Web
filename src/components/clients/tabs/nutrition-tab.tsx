"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  ChevronDown,
  UtensilsCrossed,
  Trash2,
  Save,
  FileStack,
  FilePlus,
  ChefHat,
  Apple,
} from "lucide-react";
import type { MealPlanTemplate, PlanMeal, MealOption, MealSlotConfig } from "@/lib/types";
import {
  useMealPlans,
  mealPlanStore,
  createEmptyTemplate,
  deepCopyForClient,
} from "@/lib/meal-plan-store";
import { fetchClientExtendedInfo, fetchNutritionOnboardingData } from "@/lib/supabase/db";
import type { ClientExtendedInfo } from "@/lib/types";
import type { NutritionOnboardingData } from "@/lib/nutrition-questionnaire-data";
import { recipeStore } from "@/lib/recipe-store";
import { getIngredientByFdcId } from "@/lib/nutrition-utils";
import { computePlanMicronutrients } from "@/lib/plan-nutrition-utils";
import { MealPlanDrawer } from "@/components/nutrition/meal-plan-drawer";
import { TemplateSelectorModal } from "@/components/nutrition/template-selector-modal";
import { MicronutrientCollapsible } from "@/components/nutrition/micronutrient-collapsible";
import { FoodLogViewer } from "./food-log-viewer";

export function NutritionTab({ clientId }: { clientId: string }) {
  const router = useRouter();
  const allPlans = useMealPlans();
  const clientPlan = allPlans.find((p) => p.clientId === clientId);

  // Hydrate store from Supabase on mount (no-op if already hydrated)
  useEffect(() => { mealPlanStore.hydrate(); }, []);
  const templates = allPlans.filter(
    (p) => p.status === "template" && !p.clientId
  );

  const [clientInfo, setClientInfo] = useState<ClientExtendedInfo | null>(null);
  const [onboardingData, setOnboardingData] = useState<NutritionOnboardingData | null>(null);

  useEffect(() => {
    fetchClientExtendedInfo(clientId).then(setClientInfo);
    fetchNutritionOnboardingData(clientId).then(setOnboardingData);
  }, [clientId]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MealPlanTemplate | null>(
    null
  );
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [innerTab, setInnerTab] = useState<"meal-plan" | "food-log">("meal-plan");

  // ── Actions ───────────────────────────────────────────────────────────

  function handleCreateNew() {
    // Remove existing client plan if any
    if (clientPlan) mealPlanStore.remove(clientPlan.id);
    const template = createEmptyTemplate(clientId);
    // Pre-fill with client's recommended kcal if available
    if (clientInfo?.recommended_kcal && template.dayTypes[0]) {
      const kcal = clientInfo.recommended_kcal;
      template.dayTypes[0].targetCalories = kcal;
      // Recompute gram targets from existing split
      const split = template.dayTypes[0].macroSplit;
      template.dayTypes[0].targetProteinGrams = Math.round(
        (kcal * split.protein) / 100 / 4
      );
      template.dayTypes[0].targetCarbsGrams = Math.round(
        (kcal * split.carbs) / 100 / 4
      );
      template.dayTypes[0].targetFatGrams = Math.round(
        (kcal * split.fat) / 100 / 9
      );
    }
    setEditingPlan(template);
    setDrawerOpen(true);
    setShowActions(false);
  }

  function handleCreateFromTemplate() {
    setShowTemplateSelector(true);
    setShowActions(false);
  }

  function handleSelectTemplate(template: MealPlanTemplate) {
    // Remove existing client plan if any
    if (clientPlan) mealPlanStore.remove(clientPlan.id);
    const copy = deepCopyForClient(template, clientId);
    mealPlanStore.save(copy);
    setShowTemplateSelector(false);
  }

  function handleSaveAsTemplate() {
    if (!clientPlan) return;
    mealPlanStore.saveAsTemplate(clientPlan.id);
    setShowActions(false);
  }

  function handleDeletePlan() {
    if (!clientPlan) return;
    mealPlanStore.remove(clientPlan.id);
    setShowActions(false);
  }

  function handleSavePlan(template: MealPlanTemplate) {
    mealPlanStore.save(template);
    setDrawerOpen(false);
    setEditingPlan(null);
  }

  // ── Inner tab toggle ──────────────────────────────────────────────────

  const innerTabToggle = (
    <div className="flex items-center gap-1 mb-4">
      <button
        onClick={() => setInnerTab("meal-plan")}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          innerTab === "meal-plan"
            ? "bg-accent/15 text-accent"
            : "text-muted hover:text-foreground hover:bg-black/5"
        }`}
      >
        Meal Plan
      </button>
      <button
        onClick={() => setInnerTab("food-log")}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          innerTab === "food-log"
            ? "bg-accent/15 text-accent"
            : "text-muted hover:text-foreground hover:bg-black/5"
        }`}
      >
        Food Log
      </button>
    </div>
  );

  // ── Food Log view ─────────────────────────────────────────────────────

  if (innerTab === "food-log") {
    return (
      <div className="space-y-4">
        {innerTabToggle}
        <FoodLogViewer clientId={clientId} plan={clientPlan ?? null} />
      </div>
    );
  }

  // ── Empty state — no plan assigned ────────────────────────────────────

  if (!clientPlan) {
    return (
      <div className="space-y-4">
        {innerTabToggle}
        <div className="glass-card p-10 text-center">
          <UtensilsCrossed
            size={40}
            className="mx-auto mb-4 text-muted/30"
          />
          <p className="text-sm font-semibold text-foreground">
            No meal plan assigned
          </p>
          <p className="text-xs text-muted mt-1 mb-5">
            Create a new plan or assign one from your template library
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
            >
              <Plus size={14} /> Create New Plan
            </button>
            {templates.length > 0 && (
              <button
                onClick={handleCreateFromTemplate}
                className="px-4 py-2 rounded-lg bg-black/5 border border-black/10 text-sm font-medium text-foreground hover:bg-black/10 transition-colors flex items-center gap-2"
              >
                <FileStack size={14} /> From Template
              </button>
            )}
          </div>
        </div>

        {/* Drawer */}
        {editingPlan && (
          <MealPlanDrawer
            key={editingPlan.id}
            open={drawerOpen}
            onClose={() => {
              setDrawerOpen(false);
              setEditingPlan(null);
            }}
            template={editingPlan}
            onSave={handleSavePlan}
            clientInfo={clientInfo}
            onboardingData={onboardingData}
          />
        )}

        {/* Template Selector */}
        {showTemplateSelector && (
          <TemplateSelectorModal
            templates={templates}
            onSelect={handleSelectTemplate}
            onClose={() => setShowTemplateSelector(false)}
          />
        )}
      </div>
    );
  }

  // ── Plan exists — show summary + actions ──────────────────────────────

  const dt = clientPlan.dayTypes[0];
  const statusColor = {
    draft: "bg-yellow-500/15 text-yellow-700",
    active: "bg-green-500/15 text-green-700",
    template: "bg-accent/15 text-accent",
  }[clientPlan.status];

  return (
    <div className="space-y-4">
      {innerTabToggle}

      {/* Header with edit + actions */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground truncate">
              {clientPlan.name || "Untitled Plan"}
            </h3>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}
            >
              {clientPlan.status}
            </span>
          </div>
          <p className="text-[10px] text-muted mt-0.5">
            {clientPlan.dayTypes.length} day type
            {clientPlan.dayTypes.length !== 1 ? "s" : ""} ·{" "}
            {clientPlan.maxOptionsPerMeal} max options/meal
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push(`/nutrition/${clientPlan.id}`)}
            className="px-3 py-1.5 rounded-lg border border-black/10 text-xs font-medium text-foreground hover:bg-black/5 transition-colors flex items-center gap-1.5"
          >
            <Pencil size={12} /> Edit Plan
          </button>

          {/* Actions dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-medium hover:bg-foreground/90 transition-colors flex items-center gap-1.5"
            >
              Actions <ChevronDown size={10} />
            </button>
            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 mt-1 w-48 rounded-lg bg-white border border-black/10 shadow-lg z-20 py-1">
                  <button
                    onClick={handleCreateNew}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-black/5"
                  >
                    <FilePlus size={12} /> Create new plan
                  </button>
                  {templates.length > 0 && (
                    <button
                      onClick={handleCreateFromTemplate}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-black/5"
                    >
                      <FileStack size={12} /> Create from template
                    </button>
                  )}
                  <button
                    onClick={handleSaveAsTemplate}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-black/5"
                  >
                    <Save size={12} /> Save as template
                  </button>
                  <div className="border-t border-black/5 my-1" />
                  <button
                    onClick={handleDeletePlan}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={12} /> Delete plan
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Plan summary card — donut + macros */}
      {dt && <PlanSummaryCard plan={clientPlan} dayType={dt} />}

      {/* Meal content per day type */}
      {clientPlan.dayTypes.map((dayType) => (
        <div key={dayType.id} className="space-y-2">
          {clientPlan.dayTypes.length > 1 && (
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-foreground">
                {dayType.name}
              </h4>
              <span className="text-[10px] text-muted">
                {dayType.targetCalories} kcal · P{dayType.targetProteinGrams}g · C{dayType.targetCarbsGrams}g · F{dayType.targetFatGrams}g
              </span>
            </div>
          )}
          <div className="space-y-2">
            {dayType.mealSlots
              .filter((s) => s.enabled)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((slot) => (
                <MealSlotSummary
                  key={slot.id}
                  slot={slot}
                  planMeals={clientPlan.planMeals}
                  dayTypeId={dayType.id}
                  targetCalories={dayType.targetCalories}
                />
              ))}
          </div>
        </div>
      ))}

      {/* Drawer */}
      {editingPlan && (
        <MealPlanDrawer
          key={editingPlan.id}
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditingPlan(null);
          }}
          template={editingPlan}
          onSave={handleSavePlan}
          clientInfo={clientInfo}
        />
      )}

      {/* Template Selector */}
      {showTemplateSelector && (
        <TemplateSelectorModal
          templates={templates}
          onSelect={handleSelectTemplate}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}

// ── Meal Slot Summary (read-only view) ────────────────────────────────────

function MealSlotSummary({
  slot,
  planMeals,
  dayTypeId,
  targetCalories,
}: {
  slot: MealSlotConfig;
  planMeals: PlanMeal[];
  dayTypeId: string;
  targetCalories: number;
}) {
  const [activeOptionIdx, setActiveOptionIdx] = useState(0);

  const slotKcal = Math.round((targetCalories * slot.caloriePercentage) / 100);
  const pm = planMeals.find(
    (m) => m.dayTypeId === dayTypeId && m.mealSlotId === slot.id
  );
  const options = pm?.options ?? [];
  const hasContent = options.some(
    (o) => o.type === "recipe" || o.ingredients.length > 0
  );
  const activeOpt = options[activeOptionIdx] ?? options[0];

  return (
    <div className="glass-card overflow-hidden">
      {/* Slot header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {slot.name}
          </span>
          <span className="text-[10px] text-muted">
            {slot.caloriePercentage}% · {slotKcal} kcal
          </span>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            hasContent
              ? "bg-green-500/10 text-green-600"
              : "bg-black/5 text-muted"
          }`}
        >
          {hasContent
            ? `${options.length} option${options.length !== 1 ? "s" : ""}`
            : "Empty"}
        </span>
      </div>

      {/* Option tabs (read-only) */}
      {hasContent && options.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-black/5 bg-black/[0.01]">
          {options.map((opt, idx) => (
            <button
              key={opt.id}
              onClick={() => setActiveOptionIdx(idx)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                idx === activeOptionIdx
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-black/5"
              }`}
            >
              Option {opt.optionNumber}
            </button>
          ))}
        </div>
      )}

      {/* Option content */}
      {hasContent && activeOpt && (
        <OptionContent option={activeOpt} />
      )}
    </div>
  );
}

function OptionContent({ option }: { option: MealOption }) {
  // Route by option type — recipeId may be null when hydrated from Supabase
  // (recipe data is stored directly on the option row instead)
  if (option.type === "recipe") {
    return <RecipeOptionContent option={option} />;
  }
  if (option.ingredients.length > 0) {
    return <IngredientOptionContent option={option} />;
  }
  return (
    <div className="px-4 py-3 text-xs text-muted italic">
      No content configured
    </div>
  );
}

function RecipeOptionContent({ option }: { option: MealOption }) {
  // Try local recipe store first (works for mock / in-memory plans)
  const recipe = option.recipeId ? recipeStore.getById(option.recipeId) : null;

  // Display name: local recipe → stored name on option → fallback
  const displayName = recipe?.name ?? option.name ?? "Unnamed Recipe";
  // Category: only available from local recipe store
  const category = recipe?.category ?? null;
  // Ingredients: local recipe store → option's own ingredients (from Supabase)
  const ingredients = recipe?.ingredients ?? option.ingredients;

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <ChefHat size={12} className="text-accent shrink-0" />
        <span className="text-xs font-medium text-foreground">{displayName}</span>
        <span className="text-[10px] text-muted ml-auto">
          {option.recipeServings ?? 1} serving{(option.recipeServings ?? 1) !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        {category && (
          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
            {category}
          </span>
        )}
        <span className="text-muted">
          {Math.round(option.totalCalories)} kcal
        </span>
        <span className="font-medium text-red-500">P{Math.round(option.totalProtein)}g</span>
        <span className="font-medium text-blue-500">C{Math.round(option.totalCarbs)}g</span>
        <span className="font-medium text-amber-500">F{Math.round(option.totalFat)}g</span>
      </div>
      {/* Ingredient breakdown */}
      {ingredients.length > 0 && (
        <div className="mt-1 space-y-0.5 pl-5">
          {ingredients.map((ing) => {
            const usda = getIngredientByFdcId(ing.fdcId);
            return (
              <div key={ing.id} className="flex items-center gap-2 text-[9px] text-muted">
                <span className="flex-1 truncate">{usda?.name ?? ing.name ?? `FDC#${ing.fdcId}`}</span>
                <span className="tabular-nums shrink-0">{Math.round(ing.gramWeight)}g</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IngredientOptionContent({ option }: { option: MealOption }) {
  return (
    <div className="px-4 py-3 space-y-1">
      <div className="flex items-center gap-2 mb-1.5">
        <Apple size={12} className="text-muted shrink-0" />
        <span className="text-xs font-medium text-foreground">
          {option.name || "Custom Ingredients"}
        </span>
      </div>
      {option.ingredients.map((ing) => {
        const usda = getIngredientByFdcId(ing.fdcId);
        return (
          <div key={ing.id} className="flex items-center gap-2 text-[10px]">
            <span className="flex-1 text-foreground truncate">
              {usda?.name ?? `FDC#${ing.fdcId}`}
            </span>
            <span className="text-muted tabular-nums shrink-0">
              {Math.round(ing.gramWeight)}g
            </span>
            <span className="text-red-500 font-medium tabular-nums shrink-0 w-7 text-right">
              P{Math.round(ing.protein)}
            </span>
            <span className="text-blue-500 font-medium tabular-nums shrink-0 w-7 text-right">
              C{Math.round(ing.carbs)}
            </span>
            <span className="text-amber-500 font-medium tabular-nums shrink-0 w-7 text-right">
              F{Math.round(ing.fat)}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-2 text-[10px] pt-1 border-t border-black/5 mt-1">
        <span className="flex-1 font-medium text-foreground">Total</span>
        <span className="text-muted tabular-nums">{Math.round(option.totalCalories)} kcal</span>
        <span className="text-red-500 font-medium tabular-nums w-7 text-right">
          P{Math.round(option.totalProtein)}
        </span>
        <span className="text-blue-500 font-medium tabular-nums w-7 text-right">
          C{Math.round(option.totalCarbs)}
        </span>
        <span className="text-amber-500 font-medium tabular-nums w-7 text-right">
          F{Math.round(option.totalFat)}
        </span>
      </div>
    </div>
  );
}

// ── Plan Summary Card ─────────────────────────────────────────────────────

function PlanSummaryCard({
  plan,
  dayType,
}: {
  plan: MealPlanTemplate;
  dayType: (typeof plan.dayTypes)[0];
}) {
  const target = dayType.targetCalories || 1;
  const circumference = 2 * Math.PI * 38;

  // Calculate actual totals from planMeals for this day type
  const slots = dayType.mealSlots.filter((s) => s.enabled);
  let totalCal = 0;
  let totalP = 0;
  let totalC = 0;
  let totalF = 0;

  // Build activeOptionBySlot mapping (first option for all slots)
  const activeOptionBySlot: Record<string, number> = {};
  for (const slot of slots) {
    activeOptionBySlot[slot.id] = 1;
    const pm = plan.planMeals.find(
      (m) => m.dayTypeId === dayType.id && m.mealSlotId === slot.id
    );
    if (pm) {
      const opt = pm.options[0];
      if (opt) {
        totalCal += opt.totalCalories;
        totalP += opt.totalProtein;
        totalC += opt.totalCarbs;
        totalF += opt.totalFat;
      }
    }
  }

  // Compute micronutrients for this day type
  const micronutrients = computePlanMicronutrients(
    plan.planMeals,
    dayType.id,
    slots,
    activeOptionBySlot
  );

  const calPct = Math.min((totalCal / target) * 100, 100);
  const dashOffset = circumference - (calPct / 100) * circumference;

  const macros = [
    {
      label: "Protein",
      current: totalP,
      target: dayType.targetProteinGrams,
      color: "#ef4444",
    },
    {
      label: "Carbs",
      current: totalC,
      target: dayType.targetCarbsGrams,
      color: "#3b82f6",
    },
    {
      label: "Fat",
      current: totalF,
      target: dayType.targetFatGrams,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-5">
        {/* Donut chart */}
        <div className="relative w-[80px] h-[80px] shrink-0">
          <svg
            viewBox="0 0 88 88"
            className="w-full h-full -rotate-90"
          >
            <circle
              cx="44"
              cy="44"
              r="38"
              fill="none"
              stroke="currentColor"
              className="text-black/[0.06]"
              strokeWidth="7"
            />
            <circle
              cx="44"
              cy="44"
              r="38"
              fill="none"
              stroke="#B8860B"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-bold text-foreground leading-none">
              {Math.round(totalCal)}
            </span>
            <span className="text-[8px] text-muted leading-tight">
              / {target}
            </span>
            <span className="text-[7px] text-muted">kcal</span>
          </div>
        </div>

        {/* Macro bars */}
        <div className="flex-1 space-y-1.5">
          {macros.map((m) => {
            const fillPct =
              m.target > 0
                ? Math.min((m.current / m.target) * 100, 100)
                : 0;
            return (
              <div key={m.label} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold w-10 shrink-0"
                  style={{ color: m.color }}
                >
                  {m.label}
                </span>
                <span className="text-[10px] text-muted w-8 text-right tabular-nums shrink-0">
                  {Math.round(m.current)}g
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: m.color,
                      opacity: fillPct > 95 ? 1 : 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted w-8 tabular-nums shrink-0">
                  {m.target}g
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Micronutrient collapsible */}
      <MicronutrientCollapsible micronutrients={micronutrients} compact />
    </div>
  );
}
