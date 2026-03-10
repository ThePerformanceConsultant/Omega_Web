"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  Save,
  Settings,
  ChefHat,
  Apple,
  Search,
  GripVertical,
  ChevronDown,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
// Link removed — back button now uses router
import type {
  MealPlanTemplate,
  PlanMeal,
  MealOption,
  Recipe,
} from "@/lib/types";
import { mealPlanStore } from "@/lib/meal-plan-store";
import { useRecipes, recipeStore } from "@/lib/recipe-store";
import { RECIPE_CATEGORIES } from "@/lib/types";
import {
  buildRecipeIngredient,
  getIngredientByFdcId,
  registerIngredient,
} from "@/lib/nutrition-utils";
import {
  USDA_INGREDIENTS,
  INGREDIENT_CATEGORIES,
} from "@/lib/ingredient-data";
import type { USDAIngredient } from "@/lib/ingredient-data";
import {
  createIngredientCatalogItem,
  fetchClientExtendedInfo,
  fetchIngredientCatalogCategories,
  fetchNutritionOnboardingData,
  isSupabaseConfigured,
  searchIngredientCatalog,
} from "@/lib/supabase/db";
import type { ClientExtendedInfo } from "@/lib/types";
import type { NutritionOnboardingData } from "@/lib/nutrition-questionnaire-data";
import { computePlanMicronutrients } from "@/lib/plan-nutrition-utils";
import { MealSlotCard, createEmptyOption } from "./meal-slot-card";
import { MealPlanDrawer } from "./meal-plan-drawer";
import { RecipeDetailPanel } from "./recipe-detail-panel";
import { MicronutrientCollapsible } from "./micronutrient-collapsible";

interface MealPlanBuilderProps {
  plan: MealPlanTemplate;
}

type SidebarMode = "recipes" | "ingredients";

interface DragData {
  type: "recipe" | "ingredient";
  recipe?: Recipe;
  ingredient?: USDAIngredient;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function MealPlanBuilder({ plan: initialPlan }: MealPlanBuilderProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<MealPlanTemplate>(initialPlan);
  const [activeDayTypeId, setActiveDayTypeId] = useState(
    plan.dayTypes[0]?.id ?? ""
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("recipes");
  const [activeOptionBySlot, setActiveOptionBySlot] = useState<
    Record<string, number>
  >({});
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  // Dirty state tracking (Phase 2)
  const [lastSavedJson, setLastSavedJson] = useState(() => JSON.stringify(initialPlan));
  const isDirty = JSON.stringify(plan) !== lastSavedJson;

  // Client info lookup
  const isClientPlan = !!plan.clientId;
  const [clientInfo, setClientInfo] = useState<ClientExtendedInfo | null>(null);
  const [onboardingData, setOnboardingData] = useState<NutritionOnboardingData | null>(null);

  useEffect(() => {
    if (isClientPlan && plan.clientId) {
      fetchClientExtendedInfo(plan.clientId).then(setClientInfo);
      fetchNutritionOnboardingData(plan.clientId).then(setOnboardingData);
    }
  }, [isClientPlan, plan.clientId]);

  // Sidebar search
  const recipes = useRecipes();
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeCategory, setRecipeCategory] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientCategory, setIngredientCategory] = useState("");
  const [remoteIngredients, setRemoteIngredients] = useState<USDAIngredient[] | null>(null);
  const [remoteIngredientCategories, setRemoteIngredientCategories] = useState<string[]>([]);
  const [isRemoteIngredientLoading, setIsRemoteIngredientLoading] = useState(false);

  const supabaseEnabled = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const categories = await fetchIngredientCatalogCategories();
        if (!cancelled) {
          setRemoteIngredientCategories(categories);
        }
      } catch (error) {
        console.error("[MealPlanBuilder] Failed to load ingredient categories:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setRemoteIngredients(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setIsRemoteIngredientLoading(true);
          const ingredients = await searchIngredientCatalog(
            ingredientSearch,
            ingredientCategory || undefined,
            50
          );
          if (!cancelled) {
            setRemoteIngredients(ingredients);
          }
        } catch (error) {
          console.error("[MealPlanBuilder] Failed to search ingredient catalog:", error);
          if (!cancelled) {
            setRemoteIngredients(null);
          }
        } finally {
          if (!cancelled) {
            setIsRemoteIngredientLoading(false);
          }
        }
      })();
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [ingredientCategory, ingredientSearch, supabaseEnabled]);

  const activeDayType = plan.dayTypes.find((d) => d.id === activeDayTypeId);
  const enabledSlots = useMemo(
    () => activeDayType
      ? [...activeDayType.mealSlots]
          .filter((s) => s.enabled)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [],
    [activeDayType]
  );

  // dnd-kit sensors — 5px activation distance prevents accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Get or create PlanMeal for each slot
  const getPlanMeal = useCallback(
    (dayTypeId: string, slotId: string): PlanMeal => {
      const existing = plan.planMeals.find(
        (pm) => pm.dayTypeId === dayTypeId && pm.mealSlotId === slotId
      );
      if (existing) return existing;
      return {
        id: `pm-${dayTypeId}-${slotId}`,
        dayTypeId,
        mealSlotId: slotId,
        options: [createEmptyOption(1)],
      };
    },
    [plan.planMeals]
  );

  function updatePlanMeal(updated: PlanMeal) {
    setPlan((prev) => {
      const exists = prev.planMeals.some((pm) => pm.id === updated.id);
      const newMeals = exists
        ? prev.planMeals.map((pm) => (pm.id === updated.id ? updated : pm))
        : [...prev.planMeals, updated];
      return { ...prev, planMeals: newMeals };
    });
  }

  function handleSave() {
    mealPlanStore.save(plan);
    setLastSavedJson(JSON.stringify(plan));
  }

  function handleBack() {
    if (isClientPlan && plan.clientId) {
      router.push(`/clients?clientId=${plan.clientId}&tab=nutrition`);
    } else {
      router.push("/nutrition");
    }
  }

  function handleDrawerSave(updated: MealPlanTemplate) {
    setPlan((prev) => ({
      ...updated,
      planMeals: prev.planMeals,
      clientId: prev.clientId, // Preserve client ownership
    }));
    setDrawerOpen(false);
    if (!updated.dayTypes.find((d) => d.id === activeDayTypeId)) {
      setActiveDayTypeId(updated.dayTypes[0]?.id ?? "");
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveDrag(data);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || !activeDayType) return;

    const dragData = active.data.current as DragData | undefined;
    if (!dragData) return;

    const droppableId = over.id as string;
    if (!droppableId.startsWith("slot-")) return;
    const slotId = droppableId.replace("slot-", "");

    const pm = getPlanMeal(activeDayType.id, slotId);
    const optionNum = activeOptionBySlot[slotId] ?? 1;
    const activeOpt =
      pm.options.find((o) => o.optionNumber === optionNum) ?? pm.options[0];
    if (!activeOpt) return;

    if (dragData.type === "recipe" && dragData.recipe) {
      const recipe = dragData.recipe;
      const updatedOpt: MealOption = {
        ...activeOpt,
        type: "recipe",
        recipeId: recipe.id,
        recipeServings: 1,
        ingredients: [],
        totalCalories: recipe.perServingCalories,
        totalProtein: recipe.perServingProtein,
        totalCarbs: recipe.perServingCarbs,
        totalFat: recipe.perServingFat,
      };
      updatePlanMeal({
        ...pm,
        options: pm.options.map((o) =>
          o.id === activeOpt.id ? updatedOpt : o
        ),
      });
    } else if (dragData.type === "ingredient" && dragData.ingredient) {
      registerIngredient(dragData.ingredient);
      const recipeIng = buildRecipeIngredient(
        dragData.ingredient.fdcId,
        0,
        1
      );
      const newIngredients = [...activeOpt.ingredients, recipeIng];
      const totals = newIngredients.reduce(
        (acc, i) => ({
          totalCalories: acc.totalCalories + i.calories,
          totalProtein: acc.totalProtein + i.protein,
          totalCarbs: acc.totalCarbs + i.carbs,
          totalFat: acc.totalFat + i.fat,
        }),
        { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
      );
      const updatedOpt: MealOption = {
        ...activeOpt,
        type: "ingredients",
        recipeId: null,
        ingredients: newIngredients,
        ...totals,
      };
      updatePlanMeal({
        ...pm,
        options: pm.options.map((o) =>
          o.id === activeOpt.id ? updatedOpt : o
        ),
      });
    }
  }

  // ── Filtered lists ──────────────────────────────────────────────────────

  const filteredRecipes = useMemo(() => {
    let result = recipes;
    if (recipeSearch) {
      const q = recipeSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (recipeCategory) {
      result = result.filter((r) => r.category === recipeCategory);
    }
    return result;
  }, [recipes, recipeSearch, recipeCategory]);

  const filteredIngredients = useMemo(() => {
    if (supabaseEnabled && remoteIngredients !== null) {
      return remoteIngredients;
    }

    const normalizedSearch = normalizeSearch(ingredientSearch);
    const tokens = normalizedSearch.length > 0 ? normalizedSearch.split(" ") : [];
    let result = USDA_INGREDIENTS;
    if (tokens.length > 0) {
      result = result.filter(
        (i) => {
          const haystack = normalizeSearch(`${i.name} ${i.category}`);
          return tokens.every((token) => haystack.includes(token));
        }
      );
    }
    if (ingredientCategory) {
      result = result.filter((i) => i.category === ingredientCategory);
    }
    return result.slice(0, 50);
  }, [ingredientCategory, ingredientSearch, remoteIngredients, supabaseEnabled]);

  const ingredientCategories = useMemo(
    () =>
      supabaseEnabled && remoteIngredientCategories.length > 0
        ? remoteIngredientCategories
        : INGREDIENT_CATEGORIES,
    [remoteIngredientCategories, supabaseEnabled]
  );

  const handleCreateIngredientFromSearch = async () => {
    const name = ingredientSearch.trim();
    if (!name) return;

    const caloriesRaw = window.prompt("Calories per 100g", "0");
    if (caloriesRaw === null) return;
    const proteinRaw = window.prompt("Protein (g) per 100g", "0");
    if (proteinRaw === null) return;
    const carbsRaw = window.prompt("Carbs (g) per 100g", "0");
    if (carbsRaw === null) return;
    const fatRaw = window.prompt("Fat (g) per 100g", "0");
    if (fatRaw === null) return;
    const fiberRaw = window.prompt("Fibre (g) per 100g", "0");
    if (fiberRaw === null) return;
    const portionLabel = window.prompt("Portion label (optional, e.g. packet, scoop)", "") ?? "";
    const portionGramWeight =
      portionLabel.trim().length > 0
        ? Number(window.prompt(`Grams in 1 ${portionLabel.trim()} (optional)`, "0") ?? "0")
        : 0;

    const created = await createIngredientCatalogItem({
      name,
      category: ingredientCategory || "Custom",
      calories: Number(caloriesRaw),
      protein: Number(proteinRaw),
      carbs: Number(carbsRaw),
      fat: Number(fatRaw),
      fiber: Number(fiberRaw),
      portionLabel: portionLabel.trim().length > 0 ? portionLabel.trim() : null,
      portionGramWeight: Number.isFinite(portionGramWeight) ? portionGramWeight : 0,
    });

    setIngredientSearch(created.name);
    setIngredientCategory("");
    setRemoteIngredients((prev) => [created, ...(prev ?? [])]);
  };

  // ── Day totals (uses active option per slot) ───────────────────────────

  const dayTotals = useMemo(() => {
    if (!activeDayType)
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let fibre = 0;
    for (const slot of enabledSlots) {
      const pm = plan.planMeals.find(
        (m) => m.dayTypeId === activeDayType.id && m.mealSlotId === slot.id
      );
      if (pm) {
        const optNum = activeOptionBySlot[slot.id] ?? 1;
        const opt =
          pm.options.find((o) => o.optionNumber === optNum) ?? pm.options[0];
        if (opt) {
          calories += opt.totalCalories;
          protein += opt.totalProtein;
          carbs += opt.totalCarbs;
          fat += opt.totalFat;
          // Compute fibre from underlying ingredient USDA data
          if (opt.recipeId) {
            const recipe = recipeStore.getById(opt.recipeId);
            if (recipe) {
              const servingsRatio = (opt.recipeServings || 1) / Math.max(1, recipe.servings);
              for (const ing of recipe.ingredients) {
                const usdaIng = getIngredientByFdcId(ing.fdcId);
                if (usdaIng) {
                  fibre += (usdaIng.nutrients.fiber ?? 0) * (ing.gramWeight / 100) * servingsRatio;
                }
              }
            }
          } else {
            for (const ing of opt.ingredients) {
              const usdaIng = getIngredientByFdcId(ing.fdcId);
              if (usdaIng) {
                fibre += (usdaIng.nutrients.fiber ?? 0) * (ing.gramWeight / 100);
              }
            }
          }
        }
      }
    }
    return { calories, protein, carbs, fat, fibre };
  }, [plan.planMeals, activeDayType, enabledSlots, activeOptionBySlot]);

  // ── Plan-level micronutrients ─────────────────────────────────────────
  const planMicronutrients = useMemo(() => {
    if (!activeDayType) return {};
    return computePlanMicronutrients(
      plan.planMeals,
      activeDayType.id,
      enabledSlots,
      activeOptionBySlot
    );
  }, [plan.planMeals, activeDayType, enabledSlots, activeOptionBySlot]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex -m-8" style={{ height: "calc(100vh - 57px)" }}>
        {/* ── Left Sidebar — Recipe/Ingredient picker ─────────── */}
        <div className="w-64 shrink-0 flex flex-col bg-surface/30 border-r border-black/10">
          {/* Mode toggle */}
          <div className="flex border-b border-black/10 shrink-0">
            <button
              onClick={() => setSidebarMode("recipes")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                sidebarMode === "recipes"
                  ? "text-accent border-b-2 border-accent bg-accent/5"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <ChefHat size={12} /> Recipes
            </button>
            <button
              onClick={() => setSidebarMode("ingredients")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                sidebarMode === "ingredients"
                  ? "text-accent border-b-2 border-accent bg-accent/5"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Apple size={12} /> Ingredients
            </button>
          </div>

          {sidebarMode === "recipes" ? (
            <>
              {/* Recipe search */}
              <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                    placeholder="Search recipes..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-md bg-black/5 border border-black/10 text-xs text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div className="relative">
                  <select
                    value={recipeCategory}
                    onChange={(e) => setRecipeCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-black/5 border border-black/10 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none pr-7"
                  >
                    <option value="">All Categories</option>
                    {RECIPE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                </div>
              </div>

              {/* Drag hint */}
              <div className="px-3 pb-2 shrink-0">
                <p className="text-[10px] text-muted/60 text-center">
                  Drag items to a meal slot
                </p>
              </div>

              {/* Recipe list */}
              <div className="flex-1 overflow-y-auto">
                {filteredRecipes.map((recipe) => (
                  <DraggableRecipeItem key={recipe.id} recipe={recipe} />
                ))}
                {filteredRecipes.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted">No recipes found</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Ingredient search */}
              <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                    placeholder="Search ingredients..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-md bg-black/5 border border-black/10 text-xs text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div className="relative">
                  <select
                    value={ingredientCategory}
                    onChange={(e) => setIngredientCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-black/5 border border-black/10 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none pr-7"
                  >
                    <option value="">All Categories</option>
                    {ingredientCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                </div>
              </div>

              {/* Drag hint */}
              <div className="px-3 pb-2 shrink-0">
                <p className="text-[10px] text-muted/60 text-center">
                  Drag items to a meal slot
                </p>
              </div>

              {/* Ingredient list */}
              <div className="flex-1 overflow-y-auto">
                {filteredIngredients.map((ingredient) => (
                  <DraggableIngredientItem
                    key={ingredient.fdcId}
                    ingredient={ingredient}
                  />
                ))}
                {isRemoteIngredientLoading && (
                  <p className="text-xs text-muted text-center py-3">Searching...</p>
                )}
                {filteredIngredients.length === 0 && (
                  <div className="px-3 py-8 text-center space-y-2">
                    <p className="text-xs text-muted">No ingredients found</p>
                    {supabaseEnabled && ingredientSearch.trim().length > 1 && (
                      <button
                        onClick={() => {
                          void handleCreateIngredientFromSearch().catch((error) => {
                            console.error("[MealPlanBuilder] Failed to create ingredient:", error);
                            alert("Failed to create ingredient. Please try again.");
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg border border-dashed border-accent/35 bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
                      >
                        + Add &quot;{ingredientSearch.trim()}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Main content area ──────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-black/10 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {plan.name || "Untitled Plan"}
                </h2>
                <p className="text-[10px] text-muted">
                  {plan.dayTypes.length} day type
                  {plan.dayTypes.length !== 1 ? "s" : ""} ·{" "}
                  {plan.maxOptionsPerMeal} max options/meal
                  {isClientPlan && " · Client Plan"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
                title="Plan settings"
              >
                <Settings size={16} />
              </button>
              {isDirty ? (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
                >
                  <Save size={14} /> Save Changes
                </button>
              ) : (
                <span className="flex items-center gap-1.5 px-4 py-2 text-sm text-green-600 font-medium">
                  <Check size={14} /> Saved
                </span>
              )}
            </div>
          </div>

          {/* Day type tabs */}
          {plan.dayTypes.length > 1 && (
            <div className="flex border-b border-black/10 px-6 shrink-0">
              {plan.dayTypes.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => setActiveDayTypeId(dt.id)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    dt.id === activeDayTypeId
                      ? "text-accent border-accent"
                      : "text-muted border-transparent hover:text-foreground"
                  }`}
                >
                  {dt.name}
                  <span className="text-[10px] text-muted ml-1.5">
                    {dt.targetCalories} kcal
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Day totals — donut chart + macro progress bars */}
          {activeDayType && (() => {
            const target = activeDayType.targetCalories || 1;
            const calPct = Math.min((dayTotals.calories / target) * 100, 100);
            const circumference = 2 * Math.PI * 38;
            const dashOffset = circumference - (calPct / 100) * circumference;

            const macros = [
              {
                label: "Protein",
                current: dayTotals.protein,
                target: activeDayType.targetProteinGrams,
                color: "#ef4444",
                kcalPerG: 4,
              },
              {
                label: "Carbs",
                current: dayTotals.carbs,
                target: activeDayType.targetCarbsGrams,
                color: "#3b82f6",
                kcalPerG: 4,
              },
              {
                label: "Fat",
                current: dayTotals.fat,
                target: activeDayType.targetFatGrams,
                color: "#f59e0b",
                kcalPerG: 9,
              },
            ];
            const totalCurrentKcal = dayTotals.calories || 1;

            return (
              <div className="flex items-center gap-6 px-6 py-3 border-b border-black/5 bg-black/[0.01] shrink-0">
                {/* Donut chart */}
                <div className="relative w-[88px] h-[88px] shrink-0">
                  <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
                    <circle
                      cx="44" cy="44" r="38"
                      fill="none"
                      stroke="currentColor"
                      className="text-black/[0.06]"
                      strokeWidth="7"
                    />
                    <circle
                      cx="44" cy="44" r="38"
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
                    <span className="text-sm font-bold text-foreground leading-none">
                      {Math.round(dayTotals.calories)}
                    </span>
                    <span className="text-[9px] text-muted leading-tight">
                      / {activeDayType.targetCalories}
                    </span>
                    <span className="text-[8px] text-muted">kcal</span>
                  </div>
                </div>

                {/* Macro progress bars */}
                <div className="flex-1 space-y-2">
                  {macros.map((m) => {
                    const fillPct = m.target > 0 ? Math.min((m.current / m.target) * 100, 100) : 0;
                    const kcalPct = Math.round((m.current * m.kcalPerG / totalCurrentKcal) * 100);
                    return (
                      <div key={m.label} className="flex items-center gap-3">
                        <span
                          className="text-[10px] font-semibold w-[46px] shrink-0"
                          style={{ color: m.color }}
                        >
                          {m.label}
                        </span>
                        <span className="text-[10px] text-muted w-10 text-right tabular-nums shrink-0">
                          ~{Math.round(m.current)}g
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-black/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${fillPct}%`,
                              backgroundColor: m.color,
                              opacity: fillPct > 95 ? 1 : 0.7,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-foreground w-10 tabular-nums shrink-0">
                          {m.target}g
                        </span>
                        <span className="text-[9px] text-muted w-8 shrink-0 tabular-nums">
                          ({kcalPct}%)
                        </span>
                      </div>
                    );
                  })}
                  {/* Fibre total */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold w-[46px] shrink-0 text-green-600">
                      Fibre
                    </span>
                    <span className="text-[10px] text-muted tabular-nums">
                      ~{Math.round(dayTotals.fibre)}g
                    </span>
                  </div>
                  {/* Micronutrient collapsible */}
                  <MicronutrientCollapsible micronutrients={planMicronutrients} />
                </div>
              </div>
            );
          })()}

          {/* Meal slot cards */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3 max-w-3xl">
              {enabledSlots.map((slot) => {
                const pm = getPlanMeal(activeDayTypeId, slot.id);
                return (
                  <MealSlotCard
                    key={slot.id}
                    slot={slot}
                    targetCalories={activeDayType?.targetCalories ?? 0}
                    planMeal={pm}
                    maxOptions={plan.maxOptionsPerMeal}
                    activeOptionNum={activeOptionBySlot[slot.id] ?? 1}
                    onActiveOptionChange={(num) =>
                      setActiveOptionBySlot((prev) => ({
                        ...prev,
                        [slot.id]: num,
                      }))
                    }
                    onUpdateMeal={updatePlanMeal}
                    onRecipeClick={(recipe) => setDetailRecipe(recipe)}
                  />
                );
              })}

              {enabledSlots.length === 0 && (
                <div className="glass-card p-8 text-center text-muted">
                  <p className="text-sm font-medium">
                    No meal slots configured
                  </p>
                  <p className="text-xs mt-1">
                    Open settings to add meal slots to this day type
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Recipe Detail Panel ─────────────────────────────── */}
        {detailRecipe && (
          <RecipeDetailPanel
            recipe={detailRecipe}
            onClose={() => setDetailRecipe(null)}
          />
        )}

        {/* ── Settings drawer ─────────────────────────────────── */}
        {drawerOpen && (
          <MealPlanDrawer
            key={plan.id + "-settings"}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            template={plan}
            onSave={handleDrawerSave}
            clientInfo={clientInfo}
            onboardingData={onboardingData}
          />
        )}
      </div>

      {/* ── Drag Overlay — floating preview while dragging ─── */}
      <DragOverlay>
        {activeDrag?.type === "recipe" && activeDrag.recipe ? (
          <div className="px-3 py-2 rounded-lg bg-white border border-accent/30 shadow-lg max-w-48">
            <div className="flex items-center gap-1.5">
              <ChefHat size={10} className="text-accent shrink-0" />
              <p className="text-xs font-medium text-foreground truncate">
                {activeDrag.recipe.name}
              </p>
            </div>
            <p className="text-[10px] text-muted mt-0.5">
              {Math.round(activeDrag.recipe.perServingCalories)} kcal/srv
            </p>
          </div>
        ) : activeDrag?.type === "ingredient" && activeDrag.ingredient ? (
          <div className="px-3 py-2 rounded-lg bg-white border border-accent/30 shadow-lg max-w-48">
            <div className="flex items-center gap-1.5">
              <Apple size={10} className="text-muted shrink-0" />
              <p className="text-xs font-medium text-foreground truncate">
                {activeDrag.ingredient.name}
              </p>
            </div>
            <p className="text-[10px] text-muted mt-0.5">
              {activeDrag.ingredient.category}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Draggable sidebar components ───────────────────────────────────────────

function DraggableRecipeItem({ recipe }: { recipe: Recipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { type: "recipe", recipe } as DragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/[0.04] transition-colors border-b border-black/[0.03] group cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <GripVertical size={10} className="text-muted/30 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate group-hover:text-accent transition-colors">
          {recipe.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted">{recipe.category}</span>
          <span className="text-[10px] text-muted">·</span>
          <span className="text-[10px] text-muted">
            {Math.round(recipe.perServingCalories)} kcal/srv
          </span>
        </div>
        <div className="flex gap-2 mt-0.5 text-[10px] font-medium">
          <span className="text-red-500">
            P{Math.round(recipe.perServingProtein)}
          </span>
          <span className="text-blue-500">
            C{Math.round(recipe.perServingCarbs)}
          </span>
          <span className="text-amber-500">
            F{Math.round(recipe.perServingFat)}
          </span>
        </div>
      </div>
    </div>
  );
}

function DraggableIngredientItem({
  ingredient,
}: {
  ingredient: USDAIngredient;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ingredient-${ingredient.fdcId}`,
    data: { type: "ingredient", ingredient } as DragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/[0.04] transition-colors border-b border-black/[0.03] group cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <GripVertical size={10} className="text-muted/30 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground whitespace-normal break-words leading-snug group-hover:text-accent transition-colors">
          {ingredient.name}
        </p>
        <p className="text-[10px] text-muted">{ingredient.category}</p>
      </div>
      <span className="text-[10px] text-muted tabular-nums shrink-0">
        {ingredient.nutrients.calories != null
          ? `${Math.round(ingredient.nutrients.calories)} kcal`
          : "—"}
      </span>
    </div>
  );
}
