/**
 * Meal plan template store — useSyncExternalStore pattern.
 * Manages CRUD for meal plan templates, day types, and meal slots.
 */

import { useSyncExternalStore } from "react";
import type {
  MealPlanTemplate,
  DayType,
  MealSlotConfig,
  MacroSplit,
} from "./types";
import { computeGramTargets } from "./nutrition-utils";
import {
  isSupabaseConfigured,
  fetchMealPlanTemplates,
  saveMealPlanTemplate,
  deleteMealPlanTemplate,
} from "./supabase/db";
import { createClient as createSupabaseClient } from "./supabase/client";
import { recipeStore } from "./recipe-store";

// ── Default factories ─────────────────────────────────────────────────────

const DEFAULT_MEAL_SLOTS: MealSlotConfig[] = [
  { id: "slot-breakfast", name: "Breakfast", caloriePercentage: 25, sortOrder: 0, enabled: true },
  { id: "slot-lunch", name: "Lunch", caloriePercentage: 30, sortOrder: 1, enabled: true },
  { id: "slot-dinner", name: "Dinner", caloriePercentage: 30, sortOrder: 2, enabled: true },
  { id: "slot-snack", name: "Snack", caloriePercentage: 15, sortOrder: 3, enabled: true },
  { id: "slot-morning-snack", name: "Morning Snack", caloriePercentage: 0, sortOrder: 4, enabled: false },
  { id: "slot-pre-wo", name: "Pre-Workout", caloriePercentage: 0, sortOrder: 5, enabled: false },
  { id: "slot-post-wo", name: "Post-Workout", caloriePercentage: 0, sortOrder: 6, enabled: false },
  { id: "slot-evening-snack", name: "Evening Snack", caloriePercentage: 0, sortOrder: 7, enabled: false },
];

function createDefaultDayType(name: string, id?: string): DayType {
  const split: MacroSplit = { protein: 30, carbs: 40, fat: 30 };
  const grams = computeGramTargets(2500, split);
  return {
    id: id ?? `dt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    targetCalories: 2500,
    macroSplit: split,
    macroSplitPreset: "Default 30/40/30",
    targetProteinGrams: grams.proteinGrams,
    targetCarbsGrams: grams.carbsGrams,
    targetFatGrams: grams.fatGrams,
    mealSlots: DEFAULT_MEAL_SLOTS.map((s) => ({ ...s })),
  };
}

export function createEmptyTemplate(clientId?: string | null): MealPlanTemplate {
  const now = new Date().toISOString();
  return {
    id: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    description: "",
    imageUrl: null,
    status: clientId ? "draft" : "template",
    clientId: clientId ?? null,
    maxOptionsPerMeal: 3,
    dayTypes: [createDefaultDayType("All Days", "dt-all-days")],
    planMeals: [],
    createdAt: now,
    updatedAt: now,
  };
}

export { createDefaultDayType };

// ── Supabase sync layer ───────────────────────────────────────────────────

let _coachId: string | null = null;
let _hydrated = false;

/** Persist a template to Supabase (fire-and-forget). */
function persistToDb(template: MealPlanTemplate) {
  if (!isSupabaseConfigured()) return;

  // If coachId wasn't set during hydrate (e.g. hydrate hasn't run yet),
  // attempt to get it now.
  const doSave = async () => {
    if (!_coachId) {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) _coachId = user.id;
    }
    if (!_coachId) {
      console.warn("[meal-plan-store] No coach session — skipping Supabase save");
      return;
    }
    // Pass the recipe resolver so the save can look up recipe names + ingredients
    await saveMealPlanTemplate(template, _coachId, (id) => recipeStore.getById(id));
  };

  doSave().catch((err) => {
    // Supabase errors extend Error — non-enumerable props don't serialize.
    // Extract fields explicitly so they actually appear in the console.
    const msg = err?.message ?? "unknown";
    const code = err?.code ?? "";
    const details = err?.details ?? "";
    const hint = err?.hint ?? "";
    console.error(
      `[meal-plan-store] Supabase save failed: ${msg}`,
      { code, details, hint },
    );
  });
}

/** Delete a template from Supabase (fire-and-forget). */
function deleteFromDb(id: string) {
  if (!isSupabaseConfigured()) return;
  deleteMealPlanTemplate(id).catch((err) => {
    const msg = err?.message ?? "unknown";
    console.error(`[meal-plan-store] Supabase delete failed: ${msg}`, {
      code: err?.code,
      details: err?.details,
    });
  });
}

// ── Store state ───────────────────────────────────────────────────────────

let templates: MealPlanTemplate[] = [];
let snapshot = templates;
const listeners = new Set<() => void>();

function emitChange() {
  snapshot = [...templates];
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

// ── Public API ────────────────────────────────────────────────────────────

export const mealPlanStore = {
  getAll: () => templates,
  getById: (id: string) => templates.find((t) => t.id === id),

  add(template: MealPlanTemplate) {
    templates = [...templates, template];
    emitChange();
    persistToDb(template);
  },

  update(id: string, updates: Partial<MealPlanTemplate>) {
    templates = templates.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    emitChange();
    const updated = templates.find((t) => t.id === id);
    if (updated) persistToDb(updated);
  },

  remove(id: string) {
    templates = templates.filter((t) => t.id !== id);
    emitChange();
    deleteFromDb(id);
  },

  /** Save (add or update) a template. */
  save(template: MealPlanTemplate) {
    const exists = templates.some((t) => t.id === template.id);
    const saved = { ...template, updatedAt: new Date().toISOString() };
    if (exists) {
      templates = templates.map((t) => (t.id === template.id ? saved : t));
    } else {
      templates = [...templates, saved];
    }
    emitChange();
    persistToDb(saved);
  },

  /** Duplicate as a template (no clientId, status = "template"). */
  saveAsTemplate(id: string) {
    const original = templates.find((t) => t.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const copy: MealPlanTemplate = {
      ...original,
      id: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${original.name} (Template)`,
      status: "template",
      clientId: null,
      createdAt: now,
      updatedAt: now,
    };
    templates = [...templates, copy];
    emitChange();
    persistToDb(copy);
  },

  /** Hydrate from Supabase — call once on app load. */
  async hydrate() {
    if (_hydrated || !isSupabaseConfigured()) return;
    try {
      // Get current user for coachId
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) _coachId = user.id;

      const data = await fetchMealPlanTemplates(_coachId ?? undefined);
      templates = data;
      _hydrated = true; // Only mark hydrated on success
      emitChange();
    } catch (err) {
      const msg = (err as Error)?.message ?? "unknown";
      console.error(`[meal-plan-store] hydrate failed: ${msg}`, err);
    }
  },
};

// ── Deep copy for client assignment ──────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a fully independent deep copy of a plan for a specific client. */
export function deepCopyForClient(
  template: MealPlanTemplate,
  clientId: string
): MealPlanTemplate {
  // Deep clone everything
  const raw = JSON.parse(JSON.stringify(template)) as MealPlanTemplate;
  const now = new Date().toISOString();

  // Regenerate all IDs for complete independence
  raw.id = `mp-${uid()}`;
  raw.clientId = clientId;
  raw.status = "active";
  raw.name = template.name || "Client Plan";
  raw.createdAt = now;
  raw.updatedAt = now;

  // Regenerate day type and slot IDs, keeping a mapping
  const dtIdMap = new Map<string, string>();
  const slotIdMap = new Map<string, string>();

  for (const dt of raw.dayTypes) {
    const oldId = dt.id;
    dt.id = `dt-${uid()}`;
    dtIdMap.set(oldId, dt.id);

    for (const slot of dt.mealSlots) {
      const oldSlotId = slot.id;
      slot.id = `slot-${uid()}`;
      slotIdMap.set(oldSlotId, slot.id);
    }
  }

  // Regenerate planMeal and option IDs, update references
  for (const pm of raw.planMeals) {
    pm.id = `pm-${uid()}`;
    pm.dayTypeId = dtIdMap.get(pm.dayTypeId) ?? pm.dayTypeId;
    pm.mealSlotId = slotIdMap.get(pm.mealSlotId) ?? pm.mealSlotId;

    for (const opt of pm.options) {
      opt.id = `opt-${uid()}`;
      for (const ing of opt.ingredients) {
        ing.id = `ri-${uid()}`;
      }
    }
  }

  return raw;
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useMealPlans() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useMealPlan(id: string) {
  const all = useMealPlans();
  return all.find((t) => t.id === id) ?? null;
}
