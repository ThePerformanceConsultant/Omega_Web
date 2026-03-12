/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Supabase database helpers for the coaching web app.
 * Each store can import these and call them when Supabase is configured.
 * Falls back gracefully when Supabase is not available.
 */

import { createClient } from "./client";
import { getIngredientByFdcId } from "../nutrition-utils";
import type { USDAIngredient } from "../ingredient-data";
import { normalizeYouTubeUrl, youtubeThumbnailUrl } from "../youtube";

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Get a client instance (lazy singleton)
let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!_client) _client = createClient();
  return _client;
}

// Get the authenticated coach's UUID from the current Supabase session
export async function getCoachId(): Promise<string | null> {
  const client = getClient();
  const { data: { user } } = await client.auth.getUser();
  return user?.id ?? null;
}

type IngredientCatalogRow = {
  source: "usda_survey" | "mccance_widdowson" | "open_food_facts";
  fdc_id: number;
  name: string;
  category: string | null;
  data_type: string | null;
  nutrients: Record<string, unknown> | null;
  portions: Array<{ label?: string; gramWeight?: number }> | null;
};

export type CreateIngredientCatalogInput = {
  name: string;
  category?: string | null;
  nutrients?: Record<string, number | string | null | undefined>;
  portions?: Array<{
    label: string;
    gramWeight: number | string | null | undefined;
  }>;
};

function toFiniteNumber(value: number | null | undefined, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toOptionalFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeIngredientSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function ingredientMatchScore(
  row: IngredientCatalogRow,
  normalizedQuery: string,
  tokens: string[]
): number {
  const normalizedName = normalizeIngredientSearch(row.name ?? "");
  const normalizedCategory = normalizeIngredientSearch(row.category ?? "");

  let score = 0;
  if (normalizedQuery.length > 0) {
    if (normalizedName === normalizedQuery) score += 120;
    if (normalizedName.startsWith(normalizedQuery)) score += 70;
    if (` ${normalizedName} `.includes(` ${normalizedQuery} `)) score += 45;
    if (normalizedCategory.includes(normalizedQuery)) score += 20;
  }

  for (const token of tokens) {
    if (normalizedName.startsWith(token)) score += 18;
    else if (` ${normalizedName} `.includes(` ${token} `)) score += 12;
    else if (normalizedName.includes(token)) score += 8;

    if (normalizedCategory.includes(token)) score += 5;
  }

  const nutrientKeys = Object.keys(row.nutrients ?? {}).length;
  if (nutrientKeys >= 6) score += 8;
  else if (nutrientKeys >= 3) score += 4;

  if (row.source === "open_food_facts") score += 6;
  if (row.source === "mccance_widdowson") score += 3;
  return score;
}

function toIngredientCatalogItem(row: IngredientCatalogRow): USDAIngredient {
  const nutrients: Record<string, number> = {};
  for (const [key, value] of Object.entries(row.nutrients ?? {})) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      nutrients[key] = numeric;
    }
  }

  const portions = Array.isArray(row.portions)
    ? row.portions
      .map((portion) => ({
        label: portion.label ?? "100 g",
        gramWeight: Number(portion.gramWeight ?? 100),
      }))
      .filter((portion) => Number.isFinite(portion.gramWeight) && portion.gramWeight > 0)
    : [];

  if (portions.length === 0) {
    portions.push({ label: "100 g", gramWeight: 100 });
  }

  return {
    fdcId: Number(row.fdc_id),
    name: row.name ?? "",
    category: row.category ?? "Uncategorized",
    source: row.data_type === "coach_custom" ? "coach_custom" : row.source,
    nutrients,
    portions,
  };
}

export async function fetchIngredientCatalogCategories(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getClient();

  const { data, error } = await client
    .from("ingredient_catalog")
    .select("category")
    .not("category", "is", null)
    .order("category");

  if (error) throw error;

  return [...new Set((data ?? []).map((row: any) => row.category).filter(Boolean))];
}

export async function fetchIngredientCatalogCount(category?: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const client = getClient();

  let request = client
    .from("ingredient_catalog")
    .select("fdc_id", { count: "exact", head: true });

  if (category) {
    request = request.eq("category", category);
  }

  const { count, error } = await request;
  if (error) throw error;
  return count ?? 0;
}

export async function searchIngredientCatalog(
  query: string,
  category?: string,
  limit = 50
): Promise<USDAIngredient[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getClient();

  const normalized = normalizeIngredientSearch(query);
  const tokens = normalized.length > 0 ? normalized.split(" ") : [];
  const fetchLimit = Math.max(limit * 5, 100);
  let request = client
    .from("ingredient_catalog")
    .select("source,fdc_id,name,category,data_type,nutrients,portions")
    .order("name")
    .limit(fetchLimit);

  if (category) {
    request = request.eq("category", category);
  }
  for (const token of tokens) {
    request = request.ilike("search_text", `%${token}%`);
  }

  const { data, error } = await request;
  if (error) throw error;

  const rows = (data ?? []) as IngredientCatalogRow[];
  return rows
    .map((row) => ({
      row,
      score: ingredientMatchScore(row, normalized, tokens),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.name.localeCompare(b.row.name);
    })
    .slice(0, limit)
    .map(({ row }) => toIngredientCatalogItem(row));
}

export async function createIngredientCatalogItem(
  input: CreateIngredientCatalogInput
): Promise<USDAIngredient> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("Ingredient name is required.");
  }

  const client = getClient();
  const coachId = (await getCoachId()) ?? "unknown";
  const timestamp = Date.now();
  const nonce = Math.floor(Math.random() * 1000);
  const idSeed = `${timestamp}${String(nonce).padStart(3, "0")}`;
  const fdcId = Number(`9${idSeed}`);

  const nutrientInput = input.nutrients ?? {};
  const normalizedNutrients: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(nutrientInput)) {
    const numeric = toOptionalFiniteNumber(rawValue);
    if (numeric != null) {
      normalizedNutrients[key] = numeric;
    }
  }

  const calories = toOptionalFiniteNumber(normalizedNutrients.calories);
  const protein = toOptionalFiniteNumber(normalizedNutrients.protein);
  const carbs = toOptionalFiniteNumber(normalizedNutrients.carbohydrate);
  const fat = toOptionalFiniteNumber(normalizedNutrients.totalFat);
  const fiber = toOptionalFiniteNumber(normalizedNutrients.fiber);
  const normalizedCategory = (input.category ?? "").trim() || "Custom";

  const portions: Array<{ label: string; gramWeight: number }> = [{ label: "100 g", gramWeight: 100 }];
  for (const portion of input.portions ?? []) {
    const label = (portion.label ?? "").trim();
    const gramWeight = toOptionalFiniteNumber(portion.gramWeight);
    if (!label || gramWeight == null || gramWeight <= 0) continue;
    const duplicate = portions.some(
      (existing) => existing.label.toLowerCase() === label.toLowerCase()
        && Math.abs(existing.gramWeight - gramWeight) < 0.0001
    );
    if (!duplicate) {
      portions.push({ label, gramWeight });
    }
  }

  const row = {
    id: `open_food_facts:coach:${coachId}:${idSeed}`,
    source: "open_food_facts",
    source_ref: `coach:${coachId}:${idSeed}`,
    fdc_id: fdcId,
    name,
    category: normalizedCategory,
    data_type: "coach_custom",
    calories: calories ?? 0,
    protein_g: protein ?? 0,
    carbs_g: carbs ?? 0,
    fat_g: fat ?? 0,
    fiber_g: fiber ?? 0,
    nutrients: normalizedNutrients,
    portions,
  };

  const { data, error } = await client
    .from("ingredient_catalog")
    .insert(row)
    .select("source,fdc_id,name,category,data_type,nutrients,portions")
    .single();
  if (error) throw error;
  return toIngredientCatalogItem(data as IngredientCatalogRow);
}

// ── Meal Plans ──────────────────────────────────────────

// -- camelCase → snake_case transforms for writing to Supabase --

import type {
  MealPlanTemplate,
  DayType,
  MealSlotConfig,
  PlanMeal,
  MealOption,
  RecipeIngredient,
  Recipe,
  Exercise,
  WorkoutLogEntry,
  ExerciseLogEntry,
  SetLogEntry,
  NotificationItem,
  NotificationKind,
  NotificationPrefs,
  UserSettings,
  AccountProfile,
  FormAnswer,
  FormQuestion,
  FormType,
  ClientCheckInTemplate,
  ClientCheckInHistoryItem,
  CheckInHistoryStatus,
} from "../types";

/** Optional function that resolves a recipe by ID (from the in-memory recipe store). */
export type RecipeResolver = (id: string) => Recipe | undefined;

function toDbTemplate(t: MealPlanTemplate, coachId: string) {
  // client_id is a UUID column — must be a valid UUID or null, never empty string
  const clientId = t.clientId && t.clientId.length > 8 ? t.clientId : null;
  return {
    id: t.id,
    coach_id: coachId,
    client_id: clientId,
    name: t.name || "Untitled",
    description: t.description || "",
    image_url: t.imageUrl ?? null,
    status: t.status,
    max_options_per_meal: t.maxOptionsPerMeal,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function toDbDayType(dt: DayType, templateId: string, idx: number) {
  return {
    id: dt.id,
    meal_plan_template_id: templateId,
    name: dt.name,
    target_calories: dt.targetCalories,
    macro_split_protein: dt.macroSplit.protein,
    macro_split_carbs: dt.macroSplit.carbs,
    macro_split_fat: dt.macroSplit.fat,
    macro_split_preset: dt.macroSplitPreset,
    target_protein_grams: dt.targetProteinGrams,
    target_carbs_grams: dt.targetCarbsGrams,
    target_fat_grams: dt.targetFatGrams,
    sort_order: idx,
  };
}

function toDbSlot(slot: MealSlotConfig, dayTypeId: string) {
  return {
    id: slot.id,
    day_type_id: dayTypeId,
    name: slot.name,
    calorie_percentage: slot.caloriePercentage,
    sort_order: slot.sortOrder,
    enabled: slot.enabled,
  };
}

function toDbPlanMeal(pm: PlanMeal, templateId: string) {
  return {
    id: pm.id,
    meal_plan_template_id: templateId,
    day_type_id: pm.dayTypeId,
    meal_slot_id: pm.mealSlotId,
  };
}

function toDbOption(opt: MealOption, planMealId: string, recipe?: Recipe) {
  return {
    id: opt.id,
    plan_meal_id: planMealId,
    option_number: opt.optionNumber,
    name: recipe?.name ?? opt.name ?? null,
    image_url: recipe?.imageUrl ?? opt.imageUrl ?? null,
    instructions: recipe?.instructions ?? opt.instructions ?? null,
    type: opt.type,
    recipe_id: opt.recipeId,
    recipe_servings: opt.recipeServings,
    total_calories: opt.totalCalories,
    total_protein: opt.totalProtein,
    total_carbs: opt.totalCarbs,
    total_fat: opt.totalFat,
  };
}

function toDbIngredient(ing: RecipeIngredient, optionId: string) {
  // Compute per-ingredient micronutrients from USDA data, scaled to actual gram weight
  const usda = getIngredientByFdcId(ing.fdcId);
  const scale = ing.gramWeight / 100;
  const micronutrients: Record<string, number> = {};
  if (usda && scale > 0) {
    const skipKeys = new Set(["calories", "protein", "carbohydrate", "totalFat"]);
    for (const [key, per100g] of Object.entries(usda.nutrients)) {
      if (!skipKeys.has(key)) {
        const val = per100g * scale;
        if (val > 0) micronutrients[key] = Math.round(val * 100) / 100;
      }
    }
  }

  return {
    id: ing.id,
    meal_option_id: optionId,
    fdc_id: ing.fdcId,
    name: ing.name,
    portion_index: ing.portionIndex,
    portion_label: ing.portionLabel,
    quantity: ing.quantity,
    gram_weight: ing.gramWeight,
    calories: ing.calories,
    protein: ing.protein,
    carbs: ing.carbs,
    fat: ing.fat,
    fiber: 0,
    sort_order: 0,
    micronutrients,
  };
}

// -- snake_case → camelCase transforms for reading from Supabase --

function fromDbTemplate(row: any): MealPlanTemplate {
  const dayTypes: DayType[] = (row.day_types ?? [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((dt: any) => fromDbDayType(dt));

  const planMeals: PlanMeal[] = (row.plan_meals ?? []).map((pm: any) => fromDbPlanMeal(pm));

  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    imageUrl: row.image_url ?? null,
    status: row.status ?? "draft",
    clientId: row.client_id ?? null,
    maxOptionsPerMeal: row.max_options_per_meal ?? 3,
    dayTypes,
    planMeals,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

function fromDbDayType(row: any): DayType {
  const slots: MealSlotConfig[] = (row.meal_slot_configs ?? [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s: any) => ({
      id: s.id,
      name: s.name,
      caloriePercentage: Number(s.calorie_percentage ?? 0),
      sortOrder: s.sort_order ?? 0,
      enabled: s.enabled ?? true,
    }));

  return {
    id: row.id,
    name: row.name ?? "",
    targetCalories: Number(row.target_calories ?? 0),
    macroSplit: {
      protein: Number(row.macro_split_protein ?? 30),
      carbs: Number(row.macro_split_carbs ?? 40),
      fat: Number(row.macro_split_fat ?? 30),
    },
    macroSplitPreset: row.macro_split_preset ?? "Custom",
    targetProteinGrams: Number(row.target_protein_grams ?? 0),
    targetCarbsGrams: Number(row.target_carbs_grams ?? 0),
    targetFatGrams: Number(row.target_fat_grams ?? 0),
    mealSlots: slots,
  };
}

function fromDbPlanMeal(row: any): PlanMeal {
  const options: MealOption[] = (row.meal_options ?? [])
    .sort((a: any, b: any) => (a.option_number ?? 0) - (b.option_number ?? 0))
    .map((opt: any) => fromDbOption(opt));

  return {
    id: row.id,
    dayTypeId: row.day_type_id ?? "",
    mealSlotId: row.meal_slot_id ?? "",
    options,
  };
}

function fromDbOption(row: any): MealOption {
  return {
    id: row.id,
    optionNumber: row.option_number ?? 1,
    type: row.type ?? "ingredients",
    recipeId: row.recipe_id ?? null,
    recipeServings: Number(row.recipe_servings ?? 1),
    name: row.name ?? null,
    imageUrl: row.image_url ?? null,
    instructions: row.instructions ?? null,
    ingredients: (row.meal_option_ingredients ?? [])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((ing: any) => ({
        id: ing.id,
        fdcId: ing.fdc_id ?? 0,
        name: ing.name ?? "",
        portionIndex: ing.portion_index ?? 0,
        portionLabel: ing.portion_label ?? "",
        quantity: Number(ing.quantity ?? 0),
        gramWeight: Number(ing.gram_weight ?? 0),
        calories: Number(ing.calories ?? 0),
        protein: Number(ing.protein ?? 0),
        carbs: Number(ing.carbs ?? 0),
        fat: Number(ing.fat ?? 0),
      })),
    totalCalories: Number(row.total_calories ?? 0),
    totalProtein: Number(row.total_protein ?? 0),
    totalCarbs: Number(row.total_carbs ?? 0),
    totalFat: Number(row.total_fat ?? 0),
  };
}

/** Exported for use by meal-plan-store hydration */
export { fromDbTemplate };

// -- Fetch --

export async function fetchMealPlanTemplates(coachId?: string): Promise<MealPlanTemplate[]> {
  const client = getClient();
  let query = client.from("meal_plan_templates").select(`
    *,
    day_types (
      *,
      meal_slot_configs (*)
    ),
    plan_meals (
      *,
      meal_options (
        *,
        meal_option_ingredients (*)
      )
    )
  `);
  if (coachId) query = query.eq("coach_id", coachId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbTemplate);
}

// -- Save (delete children + re-insert for clean updates) --

export async function saveMealPlanTemplate(
  template: MealPlanTemplate,
  coachId: string,
  resolveRecipe?: RecipeResolver,
) {
  const client = getClient();

  // Helper: extract readable error from Supabase response
  function throwIfError(label: string, error: any) {
    if (!error) return;
    const msg = error?.message ?? JSON.stringify(error);
    console.error(`[saveMealPlan] ${label}:`, msg, error?.code, error?.details);
    throw error;
  }

  // 1. Upsert the template row
  const { error: templateError } = await client
    .from("meal_plan_templates")
    .upsert(toDbTemplate(template, coachId));
  throwIfError("upsert template", templateError);

  // 2. Delete existing children — plan_meals first (FK → meal_slot_configs)
  const { error: delPmErr } = await client
    .from("plan_meals")
    .delete()
    .eq("meal_plan_template_id", template.id);
  throwIfError("delete plan_meals", delPmErr);

  const { error: delDtErr } = await client
    .from("day_types")
    .delete()
    .eq("meal_plan_template_id", template.id);
  throwIfError("delete day_types", delDtErr);

  // 3. Insert day types + ALL meal slot configs (including disabled ones
  //    so plan_meals FK references remain valid)
  for (let i = 0; i < template.dayTypes.length; i++) {
    const dt = template.dayTypes[i];
    const { error: dtError } = await client
      .from("day_types")
      .insert(toDbDayType(dt, template.id, i));
    throwIfError(`insert day_type[${i}]`, dtError);

    if (dt.mealSlots.length > 0) {
      const { error: slotError } = await client
        .from("meal_slot_configs")
        .insert(dt.mealSlots.map((s) => toDbSlot(s, dt.id)));
      throwIfError(`insert slots for day_type[${i}]`, slotError);
    }
  }

  // 4. Insert plan meals + meal options + ingredients
  //    Use upsert to handle edge cases (shared ingredient IDs across options,
  //    or stale rows surviving cascade deletes)
  for (const pm of template.planMeals) {
    const { error: pmError } = await client
      .from("plan_meals")
      .upsert(toDbPlanMeal(pm, template.id));
    throwIfError(`upsert plan_meal ${pm.id}`, pmError);

    for (const opt of pm.options) {
      // Resolve recipe for name, image, instructions + ingredients
      const recipe = opt.recipeId && resolveRecipe ? resolveRecipe(opt.recipeId) : undefined;

      const { error: optError } = await client
        .from("meal_options")
        .upsert(toDbOption(opt, pm.id, recipe));
      throwIfError(`upsert meal_option ${opt.id}`, optError);

      // Use the option's own ingredients, OR fall back to the resolved recipe's ingredients
      const ingredients = opt.ingredients.length > 0
        ? opt.ingredients
        : recipe?.ingredients ?? [];

      if (ingredients.length > 0) {
        const { error: ingError } = await client
          .from("meal_option_ingredients")
          .upsert(ingredients.map((ing, idx) => ({
            ...toDbIngredient(ing, opt.id),
            sort_order: idx,
          })));
        throwIfError(`upsert ingredients for option ${opt.id}`, ingError);
      }
    }
  }
}

export async function deleteMealPlanTemplate(id: string) {
  const client = getClient();
  const { error } = await client.from("meal_plan_templates").delete().eq("id", id);
  if (error) throw error;
}

// ── Clients ─────────────────────────────────────────────

export async function fetchClients() {
  const client = getClient();
  const { data, error } = await client
    .from("client_profiles")
    .select(`
      id,
      tag,
      current_weight,
      current_phase,
      compliance_pct,
      streak_days,
      profiles!client_profiles_id_fkey!inner (
        full_name,
        avatar_initials,
        email
      )
    `);

  if (error) throw error;

  // Flatten the nested profiles join into the Client shape
  return (data ?? []).map((row: any) => ({
    id: row.id,
    full_name: row.profiles.full_name ?? "",
    avatar_initials: row.profiles.avatar_initials ?? "",
    email: row.profiles.email ?? "",
    tag: row.tag ?? "",
    current_weight: row.current_weight ? Number(row.current_weight) : 0,
    current_phase: row.current_phase ?? "",
    compliance_pct: row.compliance_pct ?? 0,
    streak_days: row.streak_days ?? 0,
  }));
}

// ── Recipes ─────────────────────────────────────────────

export async function fetchRecipes(coachId?: string) {
  const client = getClient();
  let query = client.from("recipes").select("*, recipe_ingredients(*)");
  if (coachId) query = query.eq("coach_id", coachId);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return data;
}

export async function saveRecipe(recipe: any) {
  const client = getClient();
  const { recipe_ingredients, ...recipeData } = recipe;
  await client.from("recipes").upsert(recipeData);
  if (recipe_ingredients) {
    // Delete old ingredients and re-insert
    await client.from("recipe_ingredients").delete().eq("recipe_id", recipe.id);
    for (const ing of recipe_ingredients) {
      await client.from("recipe_ingredients").insert({ ...ing, recipe_id: recipe.id });
    }
  }
}

export async function deleteRecipe(id: string) {
  const client = getClient();
  await client.from("recipes").delete().eq("id", id);
}

// ── Forms ───────────────────────────────────────────────

export async function fetchFormTemplatesWithQuestions(coachId?: string) {
  const client = getClient();
  let query = client.from("form_templates").select("*, form_questions(*), form_assignments(client_id)");
  if (coachId) query = query.eq("coach_id", coachId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbFormTemplate);
}

function fromDbFormTemplate(row: any) {
  // Deduplicate questions by sort_order (safety net for concurrent save races)
  const seenSortOrders = new Set<number>();
  const questions = (row.form_questions ?? [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .filter((q: any) => {
      const so = q.sort_order ?? 0;
      if (seenSortOrders.has(so)) return false;
      seenSortOrders.add(so);
      return true;
    })
    .map((q: any) => ({
      id: q.id,
      questionText: q.question_text ?? "",
      questionType: q.question_type ?? "short_text",
      sortOrder: q.sort_order ?? 0,
      isRequired: q.is_required ?? false,
      choices: q.choices ?? null,
      allowsMultipleSelection: q.allows_multiple_selection ?? false,
      metricsConfig: q.metrics_config ?? null,
      sliderMin: q.slider_min != null ? Number(q.slider_min) : null,
      sliderMax: q.slider_max != null ? Number(q.slider_max) : null,
      sliderStep: q.slider_step != null ? Number(q.slider_step) : null,
      placeholder: q.placeholder ?? null,
    }));

  return {
    id: row.id,
    coachId: row.coach_id ?? "",
    name: row.name ?? "",
    formType: row.form_type ?? "check_in",
    questions,
    schedule: row.schedule_days && row.schedule_days.length > 0
      ? { days: row.schedule_days, time: row.schedule_time ?? "09:00" }
      : null,
    assignedClientIds: [...new Set((row.form_assignments ?? []).map((a: any) => a.client_id).filter(Boolean))] as string[],
    createdAt: row.created_at ?? new Date().toISOString(),
    displayDays: row.display_days ?? null,
  };
}

export async function saveFormTemplateWithQuestions(template: any, coachId: string) {
  const client = getClient();

  let resolvedCoachId = coachId;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(coachId)) {
    const realId = await getCoachId();
    if (!realId) throw new Error("[saveFormTemplate] No authenticated coach session");
    resolvedCoachId = realId;
  }

  const TEMP_ID_THRESHOLD = 1_000_000_000;
  const isNew = !template.id || template.id > TEMP_ID_THRESHOLD;

  let templateId: number;

  if (isNew) {
    const { data, error } = await client
      .from("form_templates")
      .insert({
        coach_id: resolvedCoachId,
        name: template.name,
        form_type: template.formType,
        frequency: template.schedule ? "recurring" : "one_time",
        schedule_days: template.schedule?.days ?? null,
        schedule_time: template.schedule?.time ?? null,
        display_days: template.displayDays ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    templateId = data.id;
  } else {
    templateId = template.id;
    const { error } = await client
      .from("form_templates")
      .update({
        name: template.name,
        form_type: template.formType,
        frequency: template.schedule ? "recurring" : "one_time",
        schedule_days: template.schedule?.days ?? null,
        schedule_time: template.schedule?.time ?? null,
        display_days: template.displayDays ?? null,
      })
      .eq("id", templateId);
    if (error) throw error;

    await client.from("form_questions").delete().eq("template_id", templateId);
  }

  if (template.questions && template.questions.length > 0) {
    const questionsToInsert = template.questions.map((q: any, idx: number) => ({
      template_id: templateId,
      question_text: q.questionText,
      question_type: q.questionType,
      sort_order: idx,
      is_required: q.isRequired ?? false,
      choices: q.choices ?? null,
      allows_multiple_selection: q.allowsMultipleSelection ?? false,
      metrics_config: q.metricsConfig ?? null,
      slider_min: q.sliderMin ?? null,
      slider_max: q.sliderMax ?? null,
      slider_step: q.sliderStep ?? null,
      placeholder: q.placeholder ?? null,
    }));
    const { error: qError } = await client
      .from("form_questions")
      .insert(questionsToInsert);
    if (qError) throw qError;
  }

  return templateId;
}

export async function deleteFormTemplate(id: number) {
  const client = getClient();
  await client.from("form_templates").delete().eq("id", id);
}

export async function createFormAssignment(templateId: number, clientId: string, dueDate: string, displayDays?: number) {
  const client = getClient();
  const { data, error } = await client
    .from("form_assignments")
    .insert({
      template_id: templateId,
      client_id: clientId,
      due_date: dueDate,
      status: "pending",
      ...(displayDays != null && { display_days: displayDays }),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchFormAssignmentsForTemplate(templateId: number): Promise<string[]> {
  const client = getClient();
  const { data, error } = await client
    .from("form_assignments")
    .select("client_id")
    .eq("template_id", templateId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r: any) => r.client_id))];
}

export async function removeFormAssignment(templateId: number, clientId: string) {
  const client = getClient();
  await client
    .from("form_assignments")
    .delete()
    .eq("template_id", templateId)
    .eq("client_id", clientId);
}

export async function fetchFormSubmissions() {
  const client = getClient();
  const { data, error } = await client
    .from("form_responses")
    .select(`
      *,
      form_answers(*),
      form_assignments!inner(
        *,
        form_templates(name, form_type),
        profiles:client_id(full_name)
      )
    `)
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const assignment = row.form_assignments;
    return {
      id: row.id,
      templateId: assignment?.template_id ?? 0,
      templateName: assignment?.form_templates?.name ?? "Unknown Form",
      clientId: assignment?.client_id ?? "",
      clientName: assignment?.profiles?.full_name ?? "Unknown Client",
      submittedAt: row.submitted_at ?? new Date().toISOString(),
      reviewed: row.reviewed ?? false,
      answers: (row.form_answers ?? []).map(normalizeFormAnswer),
    };
  });
}

function normalizeFormQuestion(row: any): FormQuestion {
  return {
    id: row.id,
    questionText: row.question_text ?? "",
    questionType: row.question_type ?? "short_text",
    sortOrder: row.sort_order ?? 0,
    isRequired: row.is_required ?? false,
    choices: row.choices ?? null,
    allowsMultipleSelection: row.allows_multiple_selection ?? false,
    metricsConfig: row.metrics_config ?? null,
    sliderMin: row.slider_min != null ? Number(row.slider_min) : null,
    sliderMax: row.slider_max != null ? Number(row.slider_max) : null,
    sliderStep: row.slider_step != null ? Number(row.slider_step) : null,
    placeholder: row.placeholder ?? null,
  };
}

function normalizeFormAnswer(row: any): FormAnswer {
  let metricsValues: Record<string, string> | null = null;
  if (row.metrics_values && typeof row.metrics_values === "object") {
    metricsValues = row.metrics_values as Record<string, string>;
  } else if (typeof row.metrics_values === "string") {
    try {
      const parsed = JSON.parse(row.metrics_values);
      if (parsed && typeof parsed === "object") {
        metricsValues = parsed as Record<string, string>;
      }
    } catch {
      metricsValues = null;
    }
  }

  const selectedChoiceIds = Array.isArray(row.selected_choice_ids)
    ? row.selected_choice_ids
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isFinite(value))
    : null;

  const answerText = row.answer_text
    ?? row.answer
    ?? row.value
    ?? "";

  return {
    id: row.id,
    questionId: row.question_id,
    answerText: typeof answerText === "string" ? answerText : String(answerText),
    selectedChoiceIds,
    numericValue: row.numeric_value != null ? Number(row.numeric_value) : null,
    boolValue: row.bool_value ?? null,
    metricsValues,
  };
}

function getCheckInStatus(input: {
  assignmentStatus: string | null;
  dueDate: string | null;
  hasSubmission: boolean;
  now: Date;
}): CheckInHistoryStatus {
  if (input.hasSubmission) return "completed";

  const status = (input.assignmentStatus ?? "").toLowerCase();
  if (status === "completed" || status === "submitted") return "completed";
  if (status === "missed" || status === "overdue") return "missed";

  if (!input.dueDate) return "pending";
  const due = new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) return "pending";

  // Date-only due dates become due by end-of-day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    due.setHours(23, 59, 59, 999);
  }
  return due < input.now ? "missed" : "pending";
}

export async function fetchClientCheckInPanelData(clientId: string): Promise<{
  templates: ClientCheckInTemplate[];
  history: ClientCheckInHistoryItem[];
}> {
  const client = getClient();
  const { data, error } = await client
    .from("form_assignments")
    .select(`
      id,
      template_id,
      due_date,
      status,
      form_templates!inner(
        id,
        name,
        form_type,
        form_questions(*)
      ),
      form_responses(
        id,
        submitted_at,
        reviewed,
        form_answers(*)
      )
    `)
    .eq("client_id", clientId)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) throw error;

  const now = new Date();
  const templatesById = new Map<number, ClientCheckInTemplate>();
  const history: ClientCheckInHistoryItem[] = (data ?? []).map((row: any) => {
    const template = row.form_templates;
    const templateId = Number(template?.id ?? row.template_id ?? 0);
    const templateName = template?.name ?? "Untitled Form";
    const formType = (template?.form_type ?? "check_in") as FormType;
    const questions = (template?.form_questions ?? [])
      .map(normalizeFormQuestion)
      .sort((a: FormQuestion, b: FormQuestion) => a.sortOrder - b.sortOrder);

    if (!templatesById.has(templateId)) {
      templatesById.set(templateId, {
        id: templateId,
        name: templateName,
        formType,
        questions,
      });
    }

    const latestResponse = [...(row.form_responses ?? [])]
      .sort((a: any, b: any) =>
        new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime()
      )[0];

    const answers = (latestResponse?.form_answers ?? []).map(normalizeFormAnswer);
    return {
      assignmentId: String(row.id),
      templateId,
      templateName,
      formType,
      dueDate: row.due_date ?? null,
      assignedAt: row.due_date ?? latestResponse?.submitted_at ?? new Date().toISOString(),
      status: getCheckInStatus({
        assignmentStatus: row.status ?? null,
        dueDate: row.due_date ?? null,
        hasSubmission: !!latestResponse,
        now,
      }),
      responseId: latestResponse?.id ?? null,
      submittedAt: latestResponse?.submitted_at ?? null,
      reviewed: latestResponse?.reviewed ?? false,
      answers,
    };
  });

  history.sort((a, b) => {
    const aDate = new Date(a.submittedAt ?? a.dueDate ?? a.assignedAt).getTime();
    const bDate = new Date(b.submittedAt ?? b.dueDate ?? b.assignedAt).getTime();
    return bDate - aDate;
  });

  return {
    templates: Array.from(templatesById.values()).sort((a, b) => a.name.localeCompare(b.name)),
    history,
  };
}

export async function markSubmissionReviewed(responseId: number) {
  const client = getClient();
  const { error } = await client
    .from("form_responses")
    .update({ reviewed: true })
    .eq("id", responseId);
  if (error) throw error;
}

export async function fetchNutritionOnboardingData(
  clientId: string
): Promise<import("@/lib/nutrition-questionnaire-data").NutritionOnboardingData | null> {
  const client = getClient();
  // Find the nutrition_intake form response for this client, including question texts
  const { data, error } = await client
    .from("form_responses")
    .select(`
      *,
      form_answers(*, form_questions(question_text)),
      form_assignments!inner(
        client_id,
        form_templates!inner(form_type)
      )
    `)
    .eq("form_assignments.client_id", clientId)
    .eq("form_assignments.form_templates.form_type", "nutrition_intake")
    .order("submitted_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[fetchNutritionOnboardingData] error:", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  // Build question_text → answer_text map
  const response = data[0];
  const qa: Record<string, string> = {};
  for (const a of response.form_answers ?? []) {
    const qText = (a as Record<string, unknown>).form_questions as { question_text?: string } | null;
    const questionText = qText?.question_text;
    if (questionText && a.answer_text) {
      qa[questionText.toLowerCase().trim()] = a.answer_text;
    }
  }

  // Helper: find answer by keyword match
  const find = (keywords: string[]): string => {
    for (const [qText, answer] of Object.entries(qa)) {
      if (keywords.some(kw => qText.includes(kw))) return answer;
    }
    return "";
  };
  const parseList = (v: string): string[] => {
    if (!v) return [];
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {}
    return v.split(",").map(s => s.trim()).filter(Boolean);
  };

  // Extract required biometric fields — return null if missing
  const heightCm = parseFloat(find(["height"])) || 0;
  const weightKg = parseFloat(find(["weight"])) || 0;
  const dateOfBirth = find(["date of birth", "dob", "birthday"]);
  const gender = (find(["gender", "sex"]).toLowerCase() || "") as "male" | "female" | "other";
  if (!heightCm || !weightKg || !dateOfBirth || !gender) return null;

  return {
    clientId,
    dateOfBirth,
    gender,
    heightCm,
    weightKg,
    occupation: find(["occupation"]),
    activityLevel: (find(["activity level"]) || "Moderately Active") as "Sedentary" | "Lightly Active" | "Moderately Active" | "Very Active" | "Extremely Active",
    dailyStepCount: find(["step"]),
    trainingDaysDescription: find(["training days", "training schedule"]),
    trainingStyle: find(["training style"]),
    competitionInfo: find(["competition"]) || null,
    exerciseReasons: parseList(find(["exercise reasons", "reasons"])),
    primaryGoal: find(["primary goal"]),
    motivationLevel: parseInt(find(["motivation"])) || 5,
    sixMonthVision: find(["6 month", "six month", "vision"]),
    previousCoachingExperience: find(["previous coaching"]) || null,
    top3Goals: parseList(find(["top 3", "top three"])),
    medicalConditions: find(["medical"]) || null,
    medications: find(["medication"]) || null,
    menstrualCycle: find(["menstrual"]) || null,
    dailyWaterLitres: parseFloat(find(["water"])) || 2,
    dietaryPreferences: parseList(find(["dietary preference"])),
    restrictionsAllergies: find(["restriction", "allerg"]) || null,
    favouriteFoods: find(["favourite food", "favorite food"]),
    leastFavouriteFoods: find(["least favourite", "least favorite"]),
    preferredCuisines: parseList(find(["cuisine"])),
    alcoholFrequency: find(["alcohol"]),
    offPlanFrequency: find(["off plan", "off-plan"]),
    snackPreference: find(["snack"]),
    maxCookingTime: find(["cooking time"]),
    mealPrepOptions: parseList(find(["meal prep"])),
    varietyPreference: find(["variety"]),
    mostHungryTime: find(["most hungry"]),
    leastHungryTime: find(["least hungry"]),
    typicalTrainingDay: find(["typical training day"]),
    workoutNutrition: find(["workout nutrition"]),
    additionalNotes: find(["additional", "notes"]) || null,
  };
}

export async function fetchClientExtendedInfo(clientId: string) {
  const client = getClient();

  // 1. Basic profile data
  const { data: profile } = await client
    .from("client_profiles")
    .select("current_weight, current_phase")
    .eq("id", clientId)
    .single();

  // 2. Fetch all form submissions for this client (filter by type in JS — nested .in() fails in PostgREST)
  const { data: responses } = await client
    .from("form_responses")
    .select(`
      id, submitted_at,
      form_answers(*, form_questions(question_text)),
      form_assignments!inner(
        client_id,
        form_templates(form_type)
      )
    `)
    .eq("form_assignments.client_id", clientId)
    .order("submitted_at", { ascending: false });

  // Build question_text → answer_text maps (prefer nutrition_intake for TDEE vars)
  const qa: Record<string, string> = {};
  const nutritionQa: Record<string, string> = {};
  const onboardingQa: Record<string, string> = {};
  let onboardingSubmissionId: number | null = null;
  const onboardingQaPairs: { question: string; answer: string }[] = [];
  const nutritionQaPairs: { question: string; answer: string }[] = [];
  const relevantTypes = new Set(["onboarding", "nutrition_intake"]);
  for (const resp of responses ?? []) {
    const ft = (resp as any).form_assignments?.form_templates?.form_type;
    if (!ft || !relevantTypes.has(ft)) continue;
    if (ft === "onboarding" && !onboardingSubmissionId) onboardingSubmissionId = resp.id;
    for (const a of (resp as any).form_answers ?? []) {
      const qText = a.form_questions?.question_text;
      const answer = a.answer_text || a.numeric_value?.toString() || "";
      if (qText && answer) {
        const key = qText.toLowerCase().trim();
        if (!qa[key]) qa[key] = answer; // first (most recent) wins
        if (ft === "onboarding") {
          if (!onboardingQa[key]) onboardingQa[key] = answer;
          onboardingQaPairs.push({ question: qText, answer });
        } else if (ft === "nutrition_intake") {
          if (!nutritionQa[key]) nutritionQa[key] = answer;
          nutritionQaPairs.push({ question: qText, answer });
        }
      }
    }
  }

  const findIn = (source: Record<string, string>, keywords: string[]): string => {
    for (const [qText, answer] of Object.entries(source)) {
      if (keywords.some((kw) => qText.includes(kw))) return answer;
    }
    return "";
  };
  const find = (keywords: string[]): string =>
    findIn(nutritionQa, keywords) || findIn(onboardingQa, keywords) || findIn(qa, keywords);
  const findWeightAnswer = (source: Record<string, string>): string => {
    for (const [qText, answer] of Object.entries(source)) {
      if (qText.includes("weight") && !qText.includes("goal") && !qText.includes("target")) return answer;
    }
    return "";
  };

  // Extract fields — prefer form answers over profile defaults
  const heightCm = parseFloat(find(["height"])) || null;
  // Find weight — match "weight" but not "goal weight" / "target weight"
  const weightAnswer =
    findWeightAnswer(nutritionQa) || findWeightAnswer(onboardingQa) || findWeightAnswer(qa);
  const formWeight = parseFloat(weightAnswer) || null;
  const weightKg = formWeight || (profile?.current_weight ? Number(profile.current_weight) : null);
  const gender = (find(["gender", "sex"]).toLowerCase() || null) as "male" | "female" | "other" | null;
  const activityLevel = find(["activity level"]);

  // Compute age from date of birth
  const dobStr = find(["date of birth", "dob", "birthday"]);
  let age: number | null = null;
  if (dobStr) {
    const dob = new Date(dobStr);
    if (!isNaN(dob.getTime())) {
      const today = new Date();
      age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    }
  }

  // Compute BMR/TDEE via Mifflin-St Jeor
  let bmr: number | null = null;
  let tdee: number | null = null;
  let pal: number | null = null;
  if (heightCm && weightKg && age && gender) {
    if (gender === "male") {
      bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
    } else {
      bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
    }
    const palMap: Record<string, number> = {
      sedentary: 1.2, "lightly active": 1.375, "moderately active": 1.55,
      "very active": 1.725, "extremely active": 1.9,
    };
    pal = palMap[activityLevel.toLowerCase()] ?? 1.55;
    tdee = Math.round(bmr * pal);
  }

  return {
    clientId,
    height_cm: heightCm,
    weight_kg: formWeight,
    age,
    gender,
    phone: null,
    activity_level: activityLevel || null,
    training_days_per_week: parseInt(find(["training days"])) || null,
    bmr,
    tdee,
    pal,
    recommended_kcal: tdee,
    goal_type: find(["primary goal", "goal type"]) || null,
    onboarding_submission_id: onboardingSubmissionId,
    onboarding_qa: onboardingQaPairs,
    nutrition_qa: nutritionQaPairs,
  };
}

// ── Messages ────────────────────────────────────────────

export async function fetchConversations(userId: string, role: "coach" | "client") {
  const client = getClient();
  const column = role === "coach" ? "coach_id" : "client_id";
  const { data, error } = await client
    .from("conversations")
    .select("*")
    .eq(column, userId)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchMessages(conversationId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createConversation(coachId: string, clientId: string) {
  const client = getClient();
  // Check if conversation already exists
  const { data: existing } = await client
    .from("conversations")
    .select("*")
    .eq("coach_id", coachId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await client
    .from("conversations")
    .insert({ coach_id: coachId, client_id: clientId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendMessage(msg: { conversationId: string; senderId: string; content: string }) {
  const client = getClient();
  const now = new Date().toISOString();
  const conversationId = Number(msg.conversationId);
  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    throw new Error("Invalid conversation id.");
  }

  const { data, error } = await client.from("messages").insert({
    conversation_id: Number(msg.conversationId),
    sender_id: msg.senderId,
    content: msg.content,
    sent_at: now,
    read: false,
  }).select().single();
  if (error) throw error;

  // Fetch current unread counters + coach id to increment the recipient's unread count.
  const { data: convRow, error: convError } = await client
    .from("conversations")
    .select("coach_id,coach_unread,client_unread")
    .eq("id", conversationId)
    .single();
  if (convError) throw convError;

  const senderIsCoach = String(convRow?.coach_id ?? "") === msg.senderId;
  const currentCoachUnread = Number(convRow?.coach_unread ?? 0);
  const currentClientUnread = Number(convRow?.client_unread ?? 0);
  const nextCoachUnread = senderIsCoach ? currentCoachUnread : currentCoachUnread + 1;
  const nextClientUnread = senderIsCoach ? currentClientUnread + 1 : currentClientUnread;

  // Update conversation metadata + unread + last sender
  const { error: updateError } = await client.from("conversations").update({
    last_message_preview: msg.content,
    last_message_at: now,
    last_sender_id: msg.senderId,
    coach_unread: nextCoachUnread,
    client_unread: nextClientUnread,
  }).eq("id", conversationId);
  if (updateError) throw updateError;

  return data;
}

export async function markMessagesRead(conversationId: string, role: "coach" | "client") {
  const client = getClient();
  const unreadCol = role === "coach" ? "coach_unread" : "client_unread";
  await client.from("conversations").update({ [unreadCol]: 0 }).eq("id", Number(conversationId));
  await client.from("messages").update({ read: true })
    .eq("conversation_id", Number(conversationId))
    .eq("read", false);
}

// ── Client Tasks ─────────────────────────────────────────

export async function fetchClientTasks(clientId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("client_tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createClientTask(task: {
  coachId: string;
  clientId: string;
  title: string;
  dueDate?: string | null;
  owner?: string;
  isWeeklyFocus?: boolean;
}) {
  const client = getClient();
  const { data, error } = await client.from("client_tasks").insert({
    coach_id: task.coachId,
    client_id: task.clientId,
    title: task.title,
    due_date: task.dueDate ?? null,
    owner: task.owner ?? "coach",
    is_weekly_focus: task.isWeeklyFocus ?? false,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateClientTask(taskId: string, updates: {
  completed?: boolean;
  title?: string;
  due_date?: string | null;
  completed_at?: string | null;
}) {
  const client = getClient();
  const { error } = await client.from("client_tasks")
    .update(updates)
    .eq("id", Number(taskId));
  if (error) throw error;
}

export async function deleteClientTask(taskId: string) {
  const client = getClient();
  const { error } = await client.from("client_tasks")
    .delete()
    .eq("id", Number(taskId));
  if (error) throw error;
}

// ── Coach Notes ──────────────────────────────────────────

export async function fetchCoachNotes(clientId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("coach_notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCoachNote(coachId: string, clientId: string, content: string) {
  const client = getClient();
  const { data, error } = await client.from("coach_notes").insert({
    coach_id: coachId,
    client_id: clientId,
    content,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCoachNote(noteId: string, content: string) {
  const client = getClient();
  const { data, error } = await client
    .from("coach_notes")
    .update({ content })
    .eq("id", Number(noteId))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCoachNote(noteId: string) {
  const client = getClient();
  const { error } = await client
    .from("coach_notes")
    .delete()
    .eq("id", Number(noteId));
  if (error) throw error;
}

// ── Roadmap ─────────────────────────────────────────────

export async function fetchClientRoadmap(clientId: string) {
  const client = getClient();
  const { data: roadmap, error } = await client
    .from("client_roadmaps")
    .select("*")
    .eq("client_id", clientId)
    .single();
  if (error) return null;

  // Fetch all related data
  const [phases, assignments, notes, events, stats, statEntries] = await Promise.all([
    client.from("roadmap_phases").select("*").eq("roadmap_id", roadmap.id).order("sort_order"),
    client.from("roadmap_phase_assignments").select("*").eq("roadmap_id", roadmap.id),
    client.from("roadmap_week_notes").select("*").eq("roadmap_id", roadmap.id),
    client.from("roadmap_events").select("*").eq("roadmap_id", roadmap.id),
    client.from("roadmap_stats").select("*").eq("roadmap_id", roadmap.id),
    client.from("roadmap_stat_entries").select("*, roadmap_stats!inner(roadmap_id)").eq("roadmap_stats.roadmap_id", roadmap.id),
  ]);

  return {
    ...roadmap,
    phases: phases.data ?? [],
    phaseAssignments: Object.fromEntries(
      (assignments.data ?? []).map((a: any) => [Number(a.week), String(a.phase_id)])
    ),
    weekNotes: (notes.data ?? []).map((n: any) => ({ week: n.week, text: n.text })),
    events: events.data ?? [],
    stats: stats.data ?? [],
    statEntries: (statEntries.data ?? []).map((e: any) => ({
      statId: String(e.stat_id),
      week: e.week,
      value: String(e.value),
    })),
  };
}

export async function saveClientRoadmap(clientId: string, roadmap: any) {
  const client = getClient();

  // 1. Upsert client_roadmaps
  const { data: savedRoadmap, error: roadmapErr } = await client
    .from("client_roadmaps")
    .upsert({
      client_id: clientId,
      year: roadmap.year,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id,year" })
    .select("id")
    .single();
  if (roadmapErr) throw roadmapErr;
  const roadmapId = savedRoadmap.id;

  // 2. Delete all children and re-insert (simpler than diffing)
  await Promise.all([
    client.from("roadmap_phase_assignments").delete().eq("roadmap_id", roadmapId),
    client.from("roadmap_week_notes").delete().eq("roadmap_id", roadmapId),
    client.from("roadmap_events").delete().eq("roadmap_id", roadmapId),
  ]);
  // Delete stat entries via stat IDs
  const { data: existingStats } = await client.from("roadmap_stats").select("id").eq("roadmap_id", roadmapId);
  if (existingStats && existingStats.length > 0) {
    const statIds = existingStats.map((s: any) => s.id);
    await client.from("roadmap_stat_entries").delete().in("stat_id", statIds);
  }
  await client.from("roadmap_stats").delete().eq("roadmap_id", roadmapId);
  await client.from("roadmap_phases").delete().eq("roadmap_id", roadmapId);

  // 3. Insert phases
  const phaseIdMap: Record<string, number> = {};
  for (const phase of roadmap.phases ?? []) {
    const { data: savedPhase, error: phaseErr } = await client
      .from("roadmap_phases")
      .insert({
        roadmap_id: roadmapId,
        name: phase.name,
        color: phase.color,
        description: phase.description ?? "",
        sort_order: roadmap.phases.indexOf(phase),
      })
      .select("id")
      .single();
    if (phaseErr) throw phaseErr;
    phaseIdMap[phase.id] = savedPhase.id;
  }

  // 4. Insert phase assignments
  const assignmentRows = Object.entries(roadmap.phaseAssignments ?? {})
    .filter(([, phaseId]) => phaseId)
    .map(([week, phaseId]) => ({
      roadmap_id: roadmapId,
      week: Number(week),
      phase_id: phaseIdMap[phaseId as string] ?? Number(phaseId),
    }));
  if (assignmentRows.length > 0) {
    await client.from("roadmap_phase_assignments").insert(assignmentRows);
  }

  // 5. Insert week notes
  const noteRows = (roadmap.weekNotes ?? [])
    .filter((n: any) => n.text && n.text.trim())
    .map((n: any) => ({
      roadmap_id: roadmapId,
      week: n.week,
      text: n.text,
    }));
  if (noteRows.length > 0) {
    await client.from("roadmap_week_notes").insert(noteRows);
  }

  // 6. Insert events
  const eventRows = (roadmap.events ?? []).map((e: any) => ({
    roadmap_id: roadmapId,
    name: e.name,
    color: e.color,
    start_week: e.startWeek,
    length_weeks: e.lengthWeeks ?? 1,
  }));
  if (eventRows.length > 0) {
    await client.from("roadmap_events").insert(eventRows);
  }

  // 7. Insert stats
  const statIdMap: Record<string, number> = {};
  for (const stat of roadmap.stats ?? []) {
    const { data: savedStat, error: statErr } = await client
      .from("roadmap_stats")
      .insert({
        roadmap_id: roadmapId,
        label: stat.label,
        unit: stat.unit ?? "",
        is_default: stat.isDefault ?? true,
      })
      .select("id")
      .single();
    if (statErr) throw statErr;
    statIdMap[stat.id] = savedStat.id;
  }

  // 8. Insert stat entries
  const entryRows = (roadmap.statEntries ?? [])
    .filter((e: any) => e.value !== undefined && e.value !== "")
    .map((e: any) => ({
      stat_id: statIdMap[e.statId] ?? Number(e.statId),
      week: e.week,
      value: Number(e.value) || 0,
    }));
  if (entryRows.length > 0) {
    await client.from("roadmap_stat_entries").insert(entryRows);
  }

  return roadmapId;
}

// ── Food Log Entries ─────────────────────────────────────

function fromDbFoodLogEntry(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    date: row.date,
    mealSlotName: row.meal_slot_name ?? "",
    foodName: row.food_name ?? "",
    fdcId: row.fdc_id ?? null,
    servingSize: row.serving_size ?? null,
    servingMultiplier: Number(row.serving_multiplier ?? 1),
    gramWeight: Number(row.gram_weight ?? 0),
    calories: Number(row.calories ?? 0),
    proteinG: Number(row.protein_g ?? 0),
    carbsG: Number(row.carbs_g ?? 0),
    fatG: Number(row.fat_g ?? 0),
    fiberG: Number(row.fiber_g ?? 0),
    micronutrients: row.micronutrients ?? {},
    source: row.source ?? "manual",
    loggedAt: row.logged_at ?? "",
  };
}

export async function fetchFoodLogEntries(
  clientId: string,
  startDate: string,
  endDate: string
) {
  const client = getClient();
  const { data, error } = await client
    .from("food_log_entries")
    .select("*")
    .eq("client_id", clientId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDbFoodLogEntry);
}

// ── Exercises ────────────────────────────────────────────

function fromDbExercise(row: any): Exercise {
  return {
    id: row.id,
    coach_id: row.coach_id ?? null,
    name: row.name ?? "",
    primary_muscle_group: row.primary_muscle_group ?? "",
    muscle_groups: row.muscle_groups ?? [],
    modality: row.modality ?? "Strength",
    movement_patterns: row.movement_patterns ?? [],
    video_url: row.video_url ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    instructions: row.instructions ?? null,
    default_note: row.default_note ?? null,
    default_reps_min: row.default_reps_min ?? null,
    default_reps_max: row.default_reps_max ?? null,
    default_rpe: row.default_rpe != null ? Number(row.default_rpe) : null,
    default_rest_seconds: row.default_rest_seconds ?? 90,
    default_tracking_fields: row.default_tracking_fields ?? ["Reps", "Weight", "RPE"],
    alternate_exercise_ids: row.alternate_exercise_ids ?? [],
    is_global: row.is_global ?? false,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function toDbExercise(ex: Exercise, coachId: string | null) {
  const normalizedVideoUrl = normalizeYouTubeUrl(ex.video_url);
  const normalizedThumbnailUrl =
    ex.thumbnail_url || youtubeThumbnailUrl(normalizedVideoUrl);

  const row: any = {
    coach_id: coachId,
    name: ex.name,
    primary_muscle_group: ex.primary_muscle_group,
    muscle_groups: ex.muscle_groups,
    modality: ex.modality,
    movement_patterns: ex.movement_patterns,
    video_url: normalizedVideoUrl,
    thumbnail_url: normalizedThumbnailUrl,
    instructions: ex.instructions,
    default_note: ex.default_note,
    default_reps_min: ex.default_reps_min,
    default_reps_max: ex.default_reps_max,
    default_rpe: ex.default_rpe,
    default_rest_seconds: ex.default_rest_seconds,
    default_tracking_fields: ex.default_tracking_fields,
    alternate_exercise_ids: ex.alternate_exercise_ids,
    is_global: ex.is_global,
  };
  // Only include id if it's an existing exercise (not 0 = new)
  if (ex.id && ex.id !== 0) row.id = ex.id;
  return row;
}

export async function fetchExercises(coachId?: string): Promise<Exercise[]> {
  const client = getClient();
  let query = client.from("exercises").select("*");
  if (coachId) {
    query = query.or(`coach_id.eq.${coachId},is_global.eq.true`);
  }
  const { data, error } = await query.order("name");
  if (error) throw error;
  return (data ?? []).map(fromDbExercise);
}

export async function saveExercise(exercise: Exercise, coachId: string): Promise<Exercise> {
  const client = getClient();
  let resolvedCoachId = coachId;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!exercise.is_global && !UUID_REGEX.test(coachId)) {
    const realId = await getCoachId();
    if (!realId) throw new Error("[saveExercise] No authenticated coach session");
    resolvedCoachId = realId;
  }

  const row = toDbExercise(exercise, exercise.is_global ? null : resolvedCoachId);
  const { data, error } = await client
    .from("exercises")
    .upsert(row)
    .select()
    .single();
  if (error) {
    const message = error?.message ?? JSON.stringify(error);
    console.error(
      "[saveExercise] upsert failed:",
      message,
      error?.code,
      error?.details,
      error?.hint
    );
    throw error;
  }
  return fromDbExercise(data);
}

export async function deleteExercise(id: number) {
  const client = getClient();
  const { error } = await client.from("exercises").delete().eq("id", id);
  if (error) throw error;
}

// ── Programs ─────────────────────────────────────────────

import type {
  WorkoutSection,
  SetData,
  WorkoutExerciseWithSets,
  PhaseWorkoutWithSections,
  ProgramPhaseWithWorkouts,
  ProgramWithPhases,
} from "../types";

function fromDbProgram(row: any): ProgramWithPhases {
  const phases: ProgramPhaseWithWorkouts[] = (row.program_phases ?? [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((phase: any) => {
      const workouts: PhaseWorkoutWithSections[] = (phase.phase_workouts ?? [])
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((w: any) => {
          const sections: WorkoutSection[] = (w.workout_sections ?? [])
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((s: any) => ({
              id: s.id,
              workout_id: s.workout_id,
              name: s.name ?? "",
              notes: s.notes ?? null,
              sort_order: s.sort_order ?? 0,
            }));

          const exercises: WorkoutExerciseWithSets[] = (w.workout_exercises ?? [])
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((ex: any) => ({
              id: ex.id,
              workout_id: ex.workout_id,
              section_id: ex.section_id ?? null,
              exercise_id: ex.exercise_id ?? null,
              name: ex.name ?? "",
              muscle_group: ex.muscle_group ?? null,
              sets: ex.sets ?? 0,
              weight: Number(ex.weight ?? 0),
              min_reps: ex.min_reps ?? 0,
              max_reps: ex.max_reps ?? 0,
              rest_seconds: ex.rest_seconds ?? 90,
              pct_1rm: Number(ex.pct_1rm ?? 0),
              rpe: Number(ex.rpe ?? 0),
              calories: Number(ex.calories ?? 0),
              duration: ex.duration ?? "",
              distance: ex.distance ?? "",
              notes: ex.notes ?? null,
              sort_order: ex.sort_order ?? 0,
              expanded: false,
              section_index: ex.section_index ?? 0,
              tracking_type: ex.tracking_type ?? "Weight/Reps/RPE",
              alternate_exercise_ids: [],
              set_data: (ex.workout_exercise_sets ?? [])
                .sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0))
                .map((s: any): SetData => ({
                  id: s.id,
                  set_number: s.set_number ?? 0,
                  weight: Number(s.weight ?? 0),
                  min_reps: s.min_reps ?? 0,
                  max_reps: s.max_reps ?? 0,
                  rest_seconds: s.rest_seconds ?? 90,
                  pct_1rm: Number(s.pct_1rm ?? 0),
                  rpe: Number(s.rpe ?? 0),
                  calories: Number(s.calories ?? 0),
                  duration: s.duration ?? "",
                  distance: s.distance ?? "",
                  done: false,
                })),
            }));

          return {
            id: w.id,
            phase_id: w.phase_id,
            name: w.name ?? "",
            sort_order: w.sort_order ?? 0,
            scheduled_weekday: typeof w.scheduled_weekday === "number" ? w.scheduled_weekday : null,
            workout_sections: sections,
            exercises,
          };
        });

      return {
        id: phase.id,
        program_id: phase.program_id,
        name: phase.name ?? "",
        weeks: phase.weeks ?? 1,
        focus: phase.focus ?? null,
        description: phase.description ?? null,
        sort_order: phase.sort_order ?? 0,
        workouts,
      };
    });

  return {
    id: row.id,
    coach_id: row.coach_id,
    name: row.name ?? "",
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    phases,
  };
}

export async function fetchPrograms(coachId?: string, options?: { templatesOnly?: boolean }): Promise<ProgramWithPhases[]> {
  const client = getClient();
  let query = client.from("programs").select(`
    *,
    program_phases (
      *,
      phase_workouts (
        *,
        workout_sections (*),
        workout_exercises (
          *,
          workout_exercise_sets (*)
        )
      )
    )
  `);
  if (coachId) query = query.eq("coach_id", coachId);
  if (options?.templatesOnly) query = query.eq("is_template", true);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbProgram);
}

export async function saveProgram(program: ProgramWithPhases, coachId: string, options?: { isTemplate?: boolean }): Promise<ProgramWithPhases> {
  const client = getClient();

  // Resolve coachId — if a placeholder was passed, get the real UUID from auth session
  let resolvedCoachId = coachId;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(coachId)) {
    const realId = await getCoachId();
    if (!realId) throw new Error("[saveProgram] No authenticated coach session");
    resolvedCoachId = realId;
  }

  function throwIfError(label: string, error: any) {
    if (!error) return;
    const msg = error?.message ?? JSON.stringify(error);
    console.error(`[saveProgram] ${label}:`, msg, error?.code, error?.details);
    throw error;
  }

  // Detect temp IDs: Date.now() produces numbers in the trillions,
  // while DB-generated IDENTITY IDs are small sequential integers.
  const TEMP_ID_THRESHOLD = 1_000_000_000;
  const isNew = !program.id || program.id === 0 || program.id > TEMP_ID_THRESHOLD;

  let savedProgram: any;

  if (isNew) {
    // INSERT without id — let Postgres GENERATED ALWAYS create the id
    const { data, error: programError } = await client
      .from("programs")
      .insert({
        coach_id: resolvedCoachId,
        name: program.name || "Untitled Program",
        is_template: options?.isTemplate ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    throwIfError("insert program", programError);
    savedProgram = data;
  } else {
    // UPDATE existing program by real DB id
    const { data, error: programError } = await client
      .from("programs")
      .update({
        name: program.name || "Untitled Program",
        updated_at: new Date().toISOString(),
      })
      .eq("id", program.id)
      .select()
      .single();
    throwIfError("update program", programError);
    savedProgram = data;

    // Delete existing children (cascade handles grandchildren)
    const { error: delErr } = await client
      .from("program_phases")
      .delete()
      .eq("program_id", savedProgram.id);
    throwIfError("delete phases", delErr);
  }

  const programId = savedProgram.id;

  // 3. Insert phases → workouts → sections → exercises → sets
  for (let pi = 0; pi < program.phases.length; pi++) {
    const phase = program.phases[pi];
    const { data: savedPhase, error: phaseErr } = await client
      .from("program_phases")
      .insert({
        program_id: programId,
        name: phase.name,
        weeks: phase.weeks,
        focus: phase.focus,
        description: phase.description,
        sort_order: pi,
      })
      .select()
      .single();
    throwIfError(`insert phase[${pi}]`, phaseErr);

    for (let wi = 0; wi < phase.workouts.length; wi++) {
      const workout = phase.workouts[wi];
      const { data: savedWorkout, error: wErr } = await client
        .from("phase_workouts")
        .insert({
          phase_id: savedPhase.id,
          name: workout.name,
          sort_order: wi,
          scheduled_weekday: workout.scheduled_weekday ?? null,
        })
        .select()
        .single();
      throwIfError(`insert workout[${pi}][${wi}]`, wErr);

      // Insert sections
      const sectionIdMap: Record<number, number> = {};
      for (let si = 0; si < workout.workout_sections.length; si++) {
        const section = workout.workout_sections[si];
        const { data: savedSection, error: sErr } = await client
          .from("workout_sections")
          .insert({
            workout_id: savedWorkout.id,
            name: section.name,
            notes: section.notes,
            sort_order: si,
          })
          .select()
          .single();
        throwIfError(`insert section[${pi}][${wi}][${si}]`, sErr);
        sectionIdMap[section.id] = savedSection.id;
      }

      // Insert exercises
      for (let ei = 0; ei < workout.exercises.length; ei++) {
        const ex = workout.exercises[ei];
        const resolvedSectionId = ex.section_id ? (sectionIdMap[ex.section_id] ?? null) : null;
        const { data: savedEx, error: exErr } = await client
          .from("workout_exercises")
          .insert({
            workout_id: savedWorkout.id,
            section_id: resolvedSectionId,
            exercise_id: ex.exercise_id,
            name: ex.name,
            muscle_group: ex.muscle_group,
            sets: ex.sets,
            weight: ex.weight,
            min_reps: ex.min_reps,
            max_reps: ex.max_reps,
            rest_seconds: ex.rest_seconds,
            pct_1rm: (ex as any).pct_1rm ?? null,
            rpe: (ex as any).rpe ?? null,
            calories: (ex as any).calories ?? null,
            duration: (ex as any).duration || null,
            distance: (ex as any).distance || null,
            notes: ex.notes,
            sort_order: ei,
            tracking_type: ex.tracking_type,
            section_index: ex.section_index,
          })
          .select()
          .single();
        throwIfError(`insert exercise[${pi}][${wi}][${ei}]`, exErr);

        // Insert sets
        if (ex.set_data && ex.set_data.length > 0) {
          const setRows = ex.set_data.map((s, idx) => ({
                workout_exercise_id: savedEx.id,
                set_number: idx + 1,
                weight: s.weight,
                min_reps: s.min_reps,
                max_reps: s.max_reps,
                rest_seconds: s.rest_seconds,
                pct_1rm: s.pct_1rm ?? null,
                rpe: s.rpe ?? null,
                calories: s.calories ?? null,
                duration: s.duration || null,
                distance: s.distance || null,
              }));
          const { error: setErr } = await client
            .from("workout_exercise_sets")
            .insert(setRows);
          throwIfError(`insert sets for exercise[${pi}][${wi}][${ei}]`, setErr);
        }
      }
    }
  }

  // Re-fetch to get the full nested structure with generated IDs
  const allPrograms = await fetchPrograms(resolvedCoachId);
  return allPrograms.find((p) => p.id === programId) ?? fromDbProgram({ ...savedProgram, program_phases: [] });
}

export async function deleteProgram(id: number) {
  const client = getClient();
  const { error } = await client.from("programs").delete().eq("id", id);
  if (error) throw error;
}

export async function assignProgramToClient(
  clientId: string,
  programId: number,
  startDate: string,
  phaseId?: number
) {
  const client = getClient();
  // Use .insert() — client_program_assignments.id is GENERATED ALWAYS
  const { data, error } = await client
    .from("client_program_assignments")
    .insert({
      client_id: clientId,
      program_id: programId,
      start_date: startDate,
      current_phase_id: phaseId ?? null,
      current_week: 1,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchClientAssignments(clientId: string) {
  const client = getClient();
  const { data, error } = await client
    .from("client_program_assignments")
    .select(`
      *,
      programs (
        *,
        program_phases (
          *,
          phase_workouts (
            *,
            workout_sections (*),
            workout_exercises (
              *,
              workout_exercise_sets (*)
            )
          )
        )
      )
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    clientId: row.client_id,
    programId: row.program_id,
    status: row.status ?? "active",
    assignedAt: row.created_at ?? new Date().toISOString(),
    startDate: row.start_date ?? new Date().toISOString().split("T")[0],
    programData: row.programs ? fromDbProgram(row.programs) : null,
  }));
}

export async function removeClientAssignment(assignmentId: string) {
  const client = getClient();
  const { error } = await client
    .from("client_program_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) throw error;
}

export async function updateAssignmentStatus(assignmentId: string, status: string) {
  const client = getClient();
  const { error } = await client
    .from("client_program_assignments")
    .update({ status })
    .eq("id", assignmentId);
  if (error) throw error;
}

// ── Workout Logs ─────────────────────────────────────────

function fromDbWorkoutLog(row: any): WorkoutLogEntry {
  const exerciseLogs: ExerciseLogEntry[] = (row.exercise_logs ?? [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((el: any) => ({
      id: String(el.id),
      exerciseName: el.exercise_name ?? "",
      summary: el.summary ?? "",
      sortOrder: el.sort_order ?? 0,
      notes: el.notes ?? null,
      setLogs: (el.set_logs ?? [])
        .sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0))
        .map((sl: any): SetLogEntry => ({
          setNumber: sl.set_number ?? 0,
          weight: Number(sl.weight ?? 0),
          reps: sl.reps ?? 0,
          rpe: sl.rpe != null ? Number(sl.rpe) : null,
          completed: sl.completed ?? false,
        })),
    }));

  return {
    id: String(row.id),
    clientId: row.client_id ?? "",
    workoutName: row.workout_name ?? "",
    date: row.date ?? "",
    durationMinutes: row.duration_minutes ?? null,
    totalVolume: row.total_volume != null ? Number(row.total_volume) : null,
    srpe: row.srpe ?? null,
    notes: row.notes ?? null,
    completed: row.completed ?? true,
    rating: row.rating ?? null,
    ratingEnergy: row.rating_energy ?? null,
    ratingPump: row.rating_pump ?? null,
    exerciseLogs,
  };
}

export async function fetchWorkoutLogs(
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<WorkoutLogEntry[]> {
  const client = getClient();
  let query = client
    .from("workout_logs")
    .select(`
      *,
      exercise_logs (
        *,
        set_logs (*)
      )
    `)
    .eq("client_id", clientId);

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);

  const { data, error } = await query.order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbWorkoutLog);
}

// ── Activity Sessions ──────────────────────────────────

export async function fetchActivitySessions(clientId: string): Promise<import("@/lib/types").ActivitySession[]> {
  const client = getClient();
  const { data, error } = await client
    .from("activity_sessions")
    .select("*")
    .eq("client_id", clientId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    clientId: row.client_id,
    activityType: row.activity_type,
    activityTypeRaw: row.activity_type_raw,
    startDate: row.start_date,
    endDate: row.end_date,
    durationSeconds: row.duration_seconds,
    caloriesBurned: row.calories_burned ?? null,
    distanceMeters: row.distance_meters ?? null,
    avgHeartRate: row.avg_heart_rate ?? null,
    maxHeartRate: row.max_heart_rate ?? null,
    minHeartRate: row.min_heart_rate ?? null,
    hrSamples: row.hr_samples ?? null,
    hrZoneSeconds: row.hr_zone_seconds ?? null,
    effortRating: row.effort_rating ?? null,
    srpe: row.srpe ?? null,
    sourceName: row.source_name ?? null,
    createdAt: row.created_at,
  }));
}

// ── Vault ──────────────────────────────────────────────

export async function fetchVaultFolders(section: "resources" | "courses", parentId?: number | null) {
  const client = getClient();
  let query = client
    .from("vault_folders")
    .select("*")
    .eq("section", section)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (parentId === undefined || parentId === null) {
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", parentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchVaultFolderById(folderId: number) {
  const client = getClient();
  const { data, error } = await client
    .from("vault_folders")
    .select("*")
    .eq("id", folderId)
    .single();
  if (error) throw error;
  return data;
}

export async function createVaultFolder(params: {
  coachId: string;
  section: "resources" | "courses";
  parentId?: number | null;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  sortOrder?: number;
}) {
  const client = getClient();
  const { data, error } = await client
    .from("vault_folders")
    .insert({
      coach_id: params.coachId,
      section: params.section,
      parent_id: params.parentId ?? null,
      name: params.name,
      description: params.description ?? null,
      thumbnail_url: params.thumbnailUrl ?? null,
      sort_order: params.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVaultFolder(folderId: number, updates: {
  name?: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  sortOrder?: number;
}) {
  const client = getClient();
  const mapped: Record<string, unknown> = {};
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.thumbnailUrl !== undefined) mapped.thumbnail_url = updates.thumbnailUrl;
  if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder;

  const { error } = await client
    .from("vault_folders")
    .update(mapped)
    .eq("id", folderId);
  if (error) throw error;
}

export async function deleteVaultFolder(folderId: number) {
  const client = getClient();
  const { error } = await client
    .from("vault_folders")
    .delete()
    .eq("id", folderId);
  if (error) throw error;
}

export async function fetchVaultItems(folderId: number) {
  const client = getClient();
  const { data, error } = await client
    .from("vault_items")
    .select("*")
    .eq("folder_id", folderId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createVaultItem(params: {
  coachId: string;
  folderId: number;
  title: string;
  description?: string | null;
  itemType: "pdf" | "video" | "image" | "link";
  fileUrl?: string | null;
  externalUrl?: string | null;
  thumbnailUrl?: string | null;
  fileSize?: number | null;
  sortOrder?: number;
}) {
  const client = getClient();
  const { data, error } = await client
    .from("vault_items")
    .insert({
      coach_id: params.coachId,
      folder_id: params.folderId,
      title: params.title,
      description: params.description ?? null,
      item_type: params.itemType,
      file_url: params.fileUrl ?? null,
      external_url: params.externalUrl ?? null,
      thumbnail_url: params.thumbnailUrl ?? null,
      file_size: params.fileSize ?? null,
      sort_order: params.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVaultItem(itemId: number, updates: {
  title?: string;
  description?: string | null;
  fileUrl?: string | null;
  externalUrl?: string | null;
  thumbnailUrl?: string | null;
  sortOrder?: number;
}) {
  const client = getClient();
  const mapped: Record<string, unknown> = {};
  if (updates.title !== undefined) mapped.title = updates.title;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.fileUrl !== undefined) mapped.file_url = updates.fileUrl;
  if (updates.externalUrl !== undefined) mapped.external_url = updates.externalUrl;
  if (updates.thumbnailUrl !== undefined) mapped.thumbnail_url = updates.thumbnailUrl;
  if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder;

  const { error } = await client
    .from("vault_items")
    .update(mapped)
    .eq("id", itemId);
  if (error) throw error;
}

export async function deleteVaultItem(itemId: number) {
  const client = getClient();
  const { error } = await client
    .from("vault_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

// Course access management
export async function fetchCourseAccess(folderId: number): Promise<string[]> {
  const client = getClient();
  const { data, error } = await client
    .from("vault_course_access")
    .select("client_id")
    .eq("folder_id", folderId);
  if (error) throw error;
  return (data ?? []).map((r: { client_id: string }) => r.client_id);
}

export async function grantCourseAccess(folderId: number, clientId: string) {
  const client = getClient();
  const { error } = await client
    .from("vault_course_access")
    .upsert({ folder_id: folderId, client_id: clientId }, { onConflict: "folder_id,client_id" });
  if (error) throw error;
}

export async function revokeCourseAccess(folderId: number, clientId: string) {
  const client = getClient();
  const { error } = await client
    .from("vault_course_access")
    .delete()
    .eq("folder_id", folderId)
    .eq("client_id", clientId);
  if (error) throw error;
}

// Storage helpers
export async function uploadVaultFile(coachId: string, folderId: number, file: File): Promise<{ path: string; size: number }> {
  const client = getClient();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${coachId}/${folderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await client.storage
    .from("vault")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return { path, size: file.size };
}

export async function deleteVaultFile(path: string) {
  const client = getClient();
  const { error } = await client.storage
    .from("vault")
    .remove([path]);
  if (error) throw error;
}

export async function getVaultFileUrl(path: string): Promise<string> {
  const client = getClient();
  const { data, error } = await client.storage
    .from("vault")
    .createSignedUrl(path, 3600); // 1 hour
  if (error) throw error;
  return data.signedUrl;
}

// ── Vault Insights ───────────────────────────────────────

export async function fetchCoachInsights() {
  if (!isSupabaseConfigured()) return [];
  const coachId = await getCoachId();
  if (!coachId) return [];

  const client = getClient();
  const { data, error } = await client
    .from("coach_insights")
    .select("*")
    .eq("coach_id", coachId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createCoachInsight(params: {
  coachId?: string;
  title: string;
  body: string;
  tags?: string[];
  isActive?: boolean;
  sortOrder?: number;
}) {
  if (!isSupabaseConfigured()) return null;
  const coachId = params.coachId ?? await getCoachId();
  if (!coachId) return null;

  const client = getClient();
  const { data, error } = await client
    .from("coach_insights")
    .insert({
      coach_id: coachId,
      title: params.title.trim(),
      body: params.body.trim(),
      tags: params.tags ?? [],
      is_active: params.isActive ?? true,
      sort_order: params.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCoachInsight(insightId: number, updates: {
  title?: string;
  body?: string;
  tags?: string[];
  isActive?: boolean;
  sortOrder?: number;
}) {
  if (!isSupabaseConfigured()) return;
  const client = getClient();

  const mapped: Record<string, unknown> = {};
  if (updates.title !== undefined) mapped.title = updates.title.trim();
  if (updates.body !== undefined) mapped.body = updates.body.trim();
  if (updates.tags !== undefined) mapped.tags = updates.tags;
  if (updates.isActive !== undefined) mapped.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder;

  const { error } = await client
    .from("coach_insights")
    .update(mapped)
    .eq("id", insightId);

  if (error) throw error;
}

export async function deleteCoachInsight(insightId: number) {
  if (!isSupabaseConfigured()) return;
  const client = getClient();
  const { error } = await client
    .from("coach_insights")
    .delete()
    .eq("id", insightId);
  if (error) throw error;
}

export async function fetchCoachInsightSettings(coachIdParam?: string) {
  if (!isSupabaseConfigured()) return null;
  const coachId = coachIdParam ?? await getCoachId();
  if (!coachId) return null;

  const client = getClient();
  const { data, error } = await client
    .from("coach_insight_settings")
    .select("*")
    .eq("coach_id", coachId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function upsertCoachInsightSettings(params: {
  coachId?: string;
  cadenceUnit: "days" | "weeks";
  cadenceValue: number;
}) {
  if (!isSupabaseConfigured()) return null;
  const coachId = params.coachId ?? await getCoachId();
  if (!coachId) return null;

  const client = getClient();
  const cadenceValue = Math.max(1, Math.floor(params.cadenceValue));
  const { data, error } = await client
    .from("coach_insight_settings")
    .upsert(
      {
        coach_id: coachId,
        cadence_unit: params.cadenceUnit,
        cadence_value: cadenceValue,
      },
      { onConflict: "coach_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Realtime Subscriptions ──────────────────────────────

export function subscribeToMessages(conversationId: string, onMessage: (msg: any) => void) {
  if (!isSupabaseConfigured()) return null;
  const client = getClient();
  const channel = client
    .channel(`messages:${conversationId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => {
      onMessage(payload.new);
    })
    .subscribe();
  return channel;
}

export function subscribeToConversations(coachId: string, onNew: (conv: any) => void, onUpdate: (conv: any) => void) {
  if (!isSupabaseConfigured()) return null;
  const client = getClient();
  const channel = client
    .channel(`conversations:coach:${coachId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "conversations",
      filter: `coach_id=eq.${coachId}`,
    }, (payload) => {
      onNew(payload.new);
    })
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "conversations",
      filter: `coach_id=eq.${coachId}`,
    }, (payload) => {
      onUpdate(payload.new);
    })
    .subscribe();
  return channel;
}

export function subscribeToFormAssignments(clientId: string, onUpdate: (data: any) => void) {
  if (!isSupabaseConfigured()) return null;
  const client = getClient();
  const channel = client
    .channel(`form_assignments:${clientId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "form_assignments",
      filter: `client_id=eq.${clientId}`,
    }, (payload) => {
      onUpdate(payload);
    })
    .subscribe();
  return channel;
}

// ── Metrics ──────────────────────────────────────────────

/** Fetch all metric configs for a client */
export async function fetchMetricConfigs(clientId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getClient();
  const { data, error } = await client
    .from("metric_configs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    clientId: r.client_id,
    name: r.name,
    unit: r.unit ?? "",
    color: r.color ?? "#c4841d",
    source: r.source ?? "manual",
    healthkitKey: r.healthkit_key ?? null,
    isActive: r.is_active ?? true,
    category: r.category ?? null,
    dailyTarget: r.daily_target ?? null,
  }));
}

/** Create a metric config for a client */
export async function createMetricConfig(config: {
  clientId: string;
  name: string;
  unit: string;
  color: string;
  source: string;
  healthkitKey: string | null;
  isActive: boolean;
  category: string | null;
  dailyTarget?: number | null;
}): Promise<string> {
  const client = getClient();
  const row: Record<string, unknown> = {
    client_id: config.clientId,
    name: config.name,
    unit: config.unit,
    color: config.color,
    source: config.source,
    healthkit_key: config.healthkitKey,
    is_active: config.isActive,
    category: config.category,
  };
  if (config.dailyTarget !== undefined && config.dailyTarget !== null) {
    row.daily_target = config.dailyTarget;
  }
  const { data, error } = await client
    .from("metric_configs")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

/** Update a metric config (toggle active, change name/unit/color) */
export async function updateMetricConfig(
  configId: string,
  updates: { isActive?: boolean; name?: string; unit?: string; color?: string; dailyTarget?: number | null }
): Promise<void> {
  const client = getClient();
  const row: Record<string, unknown> = {};
  if (updates.isActive !== undefined) row.is_active = updates.isActive;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.unit !== undefined) row.unit = updates.unit;
  if (updates.color !== undefined) row.color = updates.color;
  if (updates.dailyTarget !== undefined) row.daily_target = updates.dailyTarget;
  const { error } = await client
    .from("metric_configs")
    .update(row)
    .eq("id", Number(configId));
  if (error) throw error;
}

/** Delete a metric config (cascades to entries) */
export async function deleteMetricConfig(configId: string): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from("metric_configs")
    .delete()
    .eq("id", Number(configId));
  if (error) throw error;
}

/** Fetch metric entries for a client (joins through metric_configs) */
export async function fetchMetricEntries(clientId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getClient();
  const { data: configs, error: configsError } = await client
    .from("metric_configs")
    .select("id")
    .eq("client_id", clientId);
  if (configsError) throw configsError;

  const metricIds = (configs ?? [])
    .map((r: any) => Number(r.id))
    .filter((id: number) => Number.isFinite(id));
  if (metricIds.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 400);
  const cutoffIso = cutoff.toISOString();

  const pageSize = 1000;
  const maxRows = 20000;
  let offset = 0;
  const rows: any[] = [];

  // Fetch newest-first in pages so recent windows (1W/1M/3M/6M) are always available
  // even when total metric history exceeds the PostgREST per-request row cap.
  while (rows.length < maxRows) {
    const { data, error } = await client
      .from("metric_entries")
      .select("id, metric_id, value, date, source")
      .in("metric_id", metricIds)
      .gte("date", cutoffIso)
      .order("date", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    if (page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows
    .map((r: any) => ({
      id: String(r.id),
      metricId: String(r.metric_id),
      value: Number(r.value),
      date: r.date,
      source: r.source ?? "manual",
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ── Invite Codes ──────────────────────────────────────────

/** Validate an invite code — returns coach_id UUID or null */
export async function validateInviteCode(code: string): Promise<string | null> {
  const client = getClient();
  const { data, error } = await client.rpc("validate_invite_code", { code });
  if (error) throw error;
  return data as string | null;
}

/** Get coach name from an invite code (for landing page) */
export async function getCoachNameByInviteCode(code: string): Promise<string | null> {
  const client = getClient();
  const { data, error } = await client.rpc("get_coach_name_by_invite_code", { code });
  if (error) throw error;
  return data as string | null;
}

/** Get the current coach's invite code */
export async function getCoachInviteCode(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const coachId = await getCoachId();
  if (!coachId) return null;
  const client = getClient();
  const { data, error } = await client
    .from("coach_profiles")
    .select("invite_code")
    .eq("id", coachId)
    .single();
  if (error) return null;
  return data?.invite_code ?? null;
}

// ── Notifications + User Settings ───────────────────────

type NotificationRow = {
  id: number;
  recipient_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  dedupe_key: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type UserSettingsRow = {
  user_id: string;
  notification_prefs: Record<string, unknown> | null;
  app_prefs: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const notificationKinds: NotificationKind[] = [
  "message_received",
  "workout_assigned",
  "workout_updated",
  "form_due",
  "task_due",
  "meal_plan_published",
  "insight_published",
  "form_submitted",
  "task_completed",
  "workout_completed",
  "checkin_submitted",
];

export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    message_received: true,
    workout_assigned: true,
    workout_updated: true,
    form_due: true,
    task_due: true,
    meal_plan_published: true,
    insight_published: true,
    form_submitted: true,
    task_completed: true,
    workout_completed: true,
    checkin_submitted: true,
  };
}

function normalizeNotificationPrefs(raw: Record<string, unknown> | null | undefined): NotificationPrefs {
  const defaults = defaultNotificationPrefs();
  if (!raw) return defaults;
  const out = { ...defaults };
  for (const kind of notificationKinds) {
    const value = raw[kind];
    if (typeof value === "boolean") out[kind] = value;
  }
  return out;
}

function mapNotificationRow(row: NotificationRow): NotificationItem {
  return {
    id: Number(row.id),
    recipientId: row.recipient_id,
    actorId: row.actor_id ?? null,
    kind: row.kind,
    dedupeKey: row.dedupe_key,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    isRead: !!row.is_read,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

function mapUserSettingsRow(row: UserSettingsRow): UserSettings {
  return {
    userId: row.user_id,
    notificationPrefs: normalizeNotificationPrefs(row.notification_prefs),
    appPrefs: (row.app_prefs ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchMyNotifications(opts?: {
  limit?: number;
  unreadOnly?: boolean;
  before?: string | null;
}): Promise<NotificationItem[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getClient();
  const limit = Math.max(1, Math.min(opts?.limit ?? 50, 200));
  const { data, error } = await client.rpc("fetch_my_notifications", {
    p_limit: limit,
    p_unread_only: opts?.unreadOnly ?? false,
    p_before: opts?.before ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(mapNotificationRow);
}

export async function markMyNotificationsRead(notificationIds?: number[]): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const client = getClient();
  const ids = (notificationIds ?? []).filter((id) => Number.isFinite(id));
  const { data, error } = await client.rpc("mark_my_notifications_read", {
    p_notification_ids: ids,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchMyUserSettings(): Promise<UserSettings | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) return null;

  const { data, error } = await client
    .from("user_settings")
    .select("user_id, notification_prefs, app_prefs, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      userId: user.id,
      notificationPrefs: defaultNotificationPrefs(),
      appPrefs: {},
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }
  return mapUserSettingsRow(data as UserSettingsRow);
}

export async function upsertMyUserSettings(input: {
  notificationPrefs?: NotificationPrefs;
  appPrefs?: Record<string, unknown>;
}): Promise<UserSettings> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  const client = getClient();
  const { data, error } = await client.rpc("upsert_my_user_settings", {
    p_notification_prefs: input.notificationPrefs ?? null,
    p_app_prefs: input.appPrefs ?? null,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Failed to save user settings.");
  }
  return mapUserSettingsRow(row as UserSettingsRow);
}

export async function fetchMyAccountProfile(): Promise<AccountProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, avatar_initials")
    .eq("id", user.id)
    .single();
  if (error) throw error;

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: data?.full_name ?? "",
    avatarInitials: data?.avatar_initials ?? "",
  };
}

export async function updateMyAccountProfile(input: {
  fullName: string;
  avatarInitials: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error("Not authenticated.");

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Full name is required.");

  const avatarInitials = input.avatarInitials
    .trim()
    .toUpperCase()
    .slice(0, 4);

  const { error } = await client
    .from("profiles")
    .update({
      full_name: fullName,
      avatar_initials: avatarInitials || null,
    })
    .eq("id", user.id);
  if (error) throw error;
}

export async function requestMyEmailChange(email: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getClient();
  const nextEmail = email.trim().toLowerCase();
  if (!nextEmail) throw new Error("Email is required.");
  const { error } = await client.auth.updateUser({ email: nextEmail });
  if (error) throw error;
}

export async function sendPasswordReset(email: string, redirectTo?: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getClient();
  const targetEmail = email.trim().toLowerCase();
  if (!targetEmail) throw new Error("Email is required.");
  const { error } = await client.auth.resetPasswordForEmail(targetEmail, {
    redirectTo,
  });
  if (error) throw error;
}

export function subscribeToMyNotifications(
  userId: string,
  onChange: (item: NotificationItem) => void
) {
  const client = getClient();
  const channel = client
    .channel(`user_notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "user_notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        if (!payload.new) return;
        onChange(mapNotificationRow(payload.new as NotificationRow));
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "user_notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        if (!payload.new) return;
        onChange(mapNotificationRow(payload.new as NotificationRow));
      }
    )
    .subscribe();
  return channel;
}
