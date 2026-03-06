"use client";

import { useState, useMemo } from "react";
import {
  X,
  ChevronDown,
  ChevronRight,
  Flame,
  Clock,
  UtensilsCrossed,
  ImagePlus,
  SlidersHorizontal,
} from "lucide-react";
import type { Recipe, RecipeCategory, RecipeIngredient } from "@/lib/types";
import { RECIPE_CATEGORIES } from "@/lib/types";
import { IngredientSearchPanel } from "./ingredient-search-panel";
import {
  buildRecipeIngredient,
  computeIngredientMacros,
  computeRecipeTotals,
  computePerServingMacros,
  getIngredientByFdcId,
  registerIngredient,
} from "@/lib/nutrition-utils";
import { NUTRIENT_DEFINITIONS } from "@/lib/ingredient-data";
import type { USDAIngredient } from "@/lib/ingredient-data";

interface RecipeEditorModalProps {
  recipe: Recipe | null;
  onSave: (recipe: Recipe) => void;
  onClose: () => void;
}

function createBlankRecipe(): Recipe {
  return {
    id: `recipe-${Date.now()}`,
    name: "",
    category: "Other" as RecipeCategory,
    description: "",
    imageUrl: null,
    ingredients: [],
    servings: 1,
    prepTimeMinutes: null,
    instructions: null,
    tags: [],
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    perServingCalories: 0,
    perServingProtein: 0,
    perServingCarbs: 0,
    perServingFat: 0,
    createdAt: new Date().toISOString(),
  };
}

export function RecipeEditorModal({
  recipe,
  onSave,
  onClose,
}: RecipeEditorModalProps) {
  const isNew = recipe === null;
  const [draft, setDraft] = useState<Recipe>(recipe ?? createBlankRecipe());
  const [tagInput, setTagInput] = useState("");
  const [showMicros, setShowMicros] = useState(false);
  const [expandedIngId, setExpandedIngId] = useState<string | null>(null);

  const computed = useMemo(() => {
    const totals = computeRecipeTotals(draft.ingredients);
    const perServing = computePerServingMacros(totals, draft.servings);
    return { ...totals, ...perServing };
  }, [draft.ingredients, draft.servings]);

  // Compute aggregate micronutrients for the full recipe
  const micronutrients = useMemo(() => {
    const result: Record<string, number> = {};
    for (const ing of draft.ingredients) {
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
  }, [draft.ingredients]);

  function updateField<K extends keyof Recipe>(key: K, value: Recipe[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleAddIngredient(usdaIngredient: USDAIngredient) {
    registerIngredient(usdaIngredient);
    const ri = buildRecipeIngredient(usdaIngredient.fdcId, 0, 1);
    setDraft((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, ri],
    }));
  }

  function handleUpdateIngredient(
    ingredientId: string,
    updates: Partial<RecipeIngredient>
  ) {
    setDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) => {
        if (ing.id !== ingredientId) return ing;
        const merged = { ...ing, ...updates };
        if (updates.portionIndex != null || updates.quantity != null) {
          const macros = computeIngredientMacros(
            merged.fdcId,
            merged.portionIndex,
            merged.quantity
          );
          const usdaIng = getIngredientByFdcId(merged.fdcId);
          const portion = usdaIng?.portions[merged.portionIndex] ?? usdaIng?.portions[0];
          return {
            ...merged,
            ...macros,
            portionLabel: portion?.label ?? merged.portionLabel,
          };
        }
        return merged;
      }),
    }));
  }

  function handleRemoveIngredient(ingredientId: string) {
    setDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== ingredientId),
    }));
  }

  function handleAddTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !draft.tags.includes(tag)) {
      updateField("tags", [...draft.tags, tag]);
    }
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    updateField("tags", draft.tags.filter((t) => t !== tag));
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateField("imageUrl", reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    const final: Recipe = { ...draft, ...computed };
    onSave(final);
  }

  const canSave = draft.name.trim().length > 0 && draft.ingredients.length > 0;

  // Group micronutrients by category
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
    <div className="fixed inset-0 z-50 flex items-stretch">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative m-auto bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden animate-slide-in">
        {/* Left: Form */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
            <h2 className="text-lg font-bold text-foreground">
              {isNew ? "New Recipe" : "Edit Recipe"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 text-muted">
              <X size={18} />
            </button>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Image + Name/Category row */}
            <div className="flex gap-4">
              {/* Image upload */}
              <div className="shrink-0">
                <label className="block w-24 h-24 rounded-xl border-2 border-dashed border-black/15 hover:border-accent/40 cursor-pointer transition-colors overflow-hidden bg-black/[0.02] group">
                  {draft.imageUrl ? (
                    <img src={draft.imageUrl} alt="Recipe" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted group-hover:text-accent transition-colors">
                      <ImagePlus size={20} />
                      <span className="text-[8px] mt-1 font-medium">Add Photo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Name & Category */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-muted uppercase tracking-wider mb-1">
                    Recipe Name *
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g. Protein Oats & Berries"
                    className="w-full px-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div className="grid grid-cols-[1fr,80px,100px] gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-muted mb-1">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={draft.category}
                        onChange={(e) => updateField("category", e.target.value as RecipeCategory)}
                        className="w-full px-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm focus:outline-none focus:border-accent/50 appearance-none pr-8"
                      >
                        {RECIPE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted mb-1">
                      Servings
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={draft.servings}
                      onChange={(e) => updateField("servings", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm text-center focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted mb-1">
                      <Clock size={10} className="inline mr-1" />
                      Prep Time
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={draft.prepTimeMinutes ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                          updateField("prepTimeMinutes", val);
                        }}
                        placeholder="—"
                        className="w-full px-3 py-2 pr-8 rounded-lg bg-black/[0.03] border border-black/10 text-sm text-center focus:outline-none focus:border-accent/50"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted pointer-events-none">
                        min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <textarea
              value={draft.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Brief description..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm focus:outline-none focus:border-accent/50 resize-none"
            />

            {/* Macro summary card */}
            <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-xl p-3">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <Flame size={13} className="text-accent" />
                    <span className="text-lg font-bold text-foreground">
                      {Math.round(computed.perServingCalories)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted">kcal/serving</span>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-red-500">{Math.round(computed.perServingProtein)}</span>
                  <span className="text-[10px] text-muted ml-0.5">g</span>
                  <div className="text-[10px] text-muted">Protein</div>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-blue-500">{Math.round(computed.perServingCarbs)}</span>
                  <span className="text-[10px] text-muted ml-0.5">g</span>
                  <div className="text-[10px] text-muted">Carbs</div>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-amber-500">{Math.round(computed.perServingFat)}</span>
                  <span className="text-[10px] text-muted ml-0.5">g</span>
                  <div className="text-[10px] text-muted">Fat</div>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-green-600">
                    {Math.round((micronutrients.fiber ?? 0) / Math.max(1, draft.servings))}
                  </span>
                  <span className="text-[10px] text-muted ml-0.5">g</span>
                  <div className="text-[10px] text-muted">Fibre</div>
                </div>
                {draft.servings > 1 && (
                  <div className="text-center ml-auto">
                    <span className="text-sm font-semibold text-foreground">
                      {Math.round(computed.totalCalories)}
                    </span>
                    <div className="text-[10px] text-muted">kcal total</div>
                  </div>
                )}
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] font-medium text-muted uppercase tracking-wider">
                  Ingredients ({draft.ingredients.length})
                </label>
                {/* Color-coded header legend */}
                <div className="flex items-center gap-3 ml-auto text-[9px] font-semibold">
                  <span className="text-foreground">Cal</span>
                  <span className="text-red-500">P</span>
                  <span className="text-blue-500">C</span>
                  <span className="text-amber-500">F</span>
                </div>
              </div>

              {draft.ingredients.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-black/10 p-6 text-center">
                  <UtensilsCrossed size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted">
                    Search and add ingredients from the panel on the right
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {draft.ingredients.map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ingredient={ing}
                      expanded={expandedIngId === ing.id}
                      onToggleExpand={() => setExpandedIngId(expandedIngId === ing.id ? null : ing.id)}
                      onUpdate={(updates) => handleUpdateIngredient(ing.id, updates)}
                      onRemove={() => handleRemoveIngredient(ing.id)}
                    />
                  ))}

                  {/* Totals row */}
                  <div className="flex items-center gap-3 px-3 py-2 bg-black/[0.03] rounded-lg text-xs font-semibold">
                    <span className="flex-1">Total</span>
                    <span className="w-16 text-right tabular-nums">{Math.round(computed.totalCalories)}</span>
                    <span className="w-12 text-right tabular-nums text-red-500">{computed.totalProtein.toFixed(1)}</span>
                    <span className="w-12 text-right tabular-nums text-blue-500">{computed.totalCarbs.toFixed(1)}</span>
                    <span className="w-12 text-right tabular-nums text-amber-500">{computed.totalFat.toFixed(1)}</span>
                    <span className="w-6" />
                  </div>
                </div>
              )}
            </div>

            {/* Micronutrients expandable */}
            <div>
              <button
                onClick={() => setShowMicros(!showMicros)}
                className="flex items-center gap-2 text-[10px] font-medium text-muted uppercase tracking-wider hover:text-foreground transition-colors"
              >
                {showMicros ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Full Nutrition Profile
              </button>

              {showMicros && (
                <div className="mt-2 space-y-3">
                  {Object.entries(microGroups).map(([group, items]) => (
                    items.length > 0 && (
                      <div key={group}>
                        <h5 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1 capitalize">
                          {group}
                        </h5>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {items.map((item) => (
                            <div key={item.key} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-muted">{item.label}</span>
                              <span className="font-medium tabular-nums">
                                {item.value < 1 ? item.value.toFixed(2) : item.value.toFixed(1)} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                  {Object.values(microGroups).every((g) => g.length === 0) && (
                    <p className="text-xs text-muted">Add ingredients to see micronutrients</p>
                  )}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-[10px] font-medium text-muted uppercase tracking-wider mb-1">
                Instructions
              </label>
              <textarea
                value={draft.instructions ?? ""}
                onChange={(e) => updateField("instructions", e.target.value || null)}
                placeholder="Step-by-step preparation instructions..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[10px] font-medium text-muted uppercase tracking-wider mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {draft.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-accent/10 text-accent">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Add tag..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-black/[0.03] border border-black/10 text-xs focus:outline-none focus:border-accent/50"
                />
                <button onClick={handleAddTag} className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-xs text-muted hover:text-foreground">
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-black/5">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-black/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-5 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNew ? "Create Recipe" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Right: Ingredient search panel */}
        <div className="w-72 border-l border-black/10 bg-black/[0.01] flex flex-col">
          <IngredientSearchPanel onAdd={handleAddIngredient} />
        </div>
      </div>
    </div>
  );
}

// ── Ingredient Row (Screenshot 2 layout) ──────────────────────────────────

function IngredientRow({
  ingredient,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  ingredient: RecipeIngredient;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<RecipeIngredient>) => void;
  onRemove: () => void;
}) {
  const usdaIng = getIngredientByFdcId(ingredient.fdcId);
  const portions = usdaIng?.portions ?? [];

  // Compute per-ingredient micros when expanded
  const ingMicros = useMemo(() => {
    if (!expanded || !usdaIng) return null;
    const nutrients = usdaIng.nutrients;
    const scale = ingredient.gramWeight / 100;
    const result: { key: string; label: string; unit: string; value: number }[] = [];
    for (const def of NUTRIENT_DEFINITIONS) {
      const raw = nutrients[def.key as keyof typeof nutrients];
      if (typeof raw === "number" && raw > 0) {
        result.push({ key: def.key, label: def.label, unit: def.unit, value: raw * scale });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [expanded, usdaIng, ingredient.gramWeight]);

  return (
    <div className="rounded-lg bg-black/[0.02] border border-black/[0.06] overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Name */}
        <span className="text-xs font-medium text-foreground truncate min-w-0 flex-1" title={ingredient.name}>
          {ingredient.name}
        </span>

        {/* Quantity + Portion (inset layout like screenshot 2) */}
        <div className="flex items-center shrink-0">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={ingredient.quantity}
            onChange={(e) => onUpdate({ quantity: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
            className="w-14 px-2 py-1 rounded-l-md bg-white border border-black/10 text-xs text-center focus:outline-none focus:border-accent/50 border-r-0"
          />
          <div className="relative">
            <select
              value={ingredient.portionIndex}
              onChange={(e) => onUpdate({ portionIndex: parseInt(e.target.value) })}
              className="px-2 py-1 rounded-r-md bg-white border border-black/10 text-[10px] text-muted appearance-none pr-5 focus:outline-none focus:border-accent/50 h-full"
            >
              {portions.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
            <ChevronDown size={8} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Macros — color-coded inline */}
        <span className="w-16 text-right text-xs font-medium tabular-nums shrink-0">
          {Math.round(ingredient.calories)} <span className="text-[9px] text-muted">kcal</span>
        </span>

        {/* Expand/details button */}
        <button
          onClick={onToggleExpand}
          className="p-1 rounded text-muted hover:text-foreground hover:bg-black/5 transition-colors shrink-0"
          title="Nutrition details"
        >
          <SlidersHorizontal size={12} />
        </button>

        {/* Delete */}
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Macro chips row */}
      <div className="flex items-center gap-3 px-3 pb-2 text-[10px] font-medium">
        <span className="text-red-500">P{ingredient.protein.toFixed(1)}g</span>
        <span className="text-blue-500">C{Math.max(0, ingredient.carbs).toFixed(1)}g</span>
        <span className="text-amber-500">F{ingredient.fat.toFixed(1)}g</span>
        <span className="text-muted ml-auto">{Math.round(ingredient.gramWeight)}g total</span>
      </div>

      {/* Expanded micronutrient details */}
      {expanded && ingMicros && (
        <div className="px-3 pb-3 pt-1 border-t border-black/5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            {ingMicros.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-0.5">
                <span className="text-muted">{item.label}</span>
                <span className="font-medium tabular-nums">
                  {item.value < 1 ? item.value.toFixed(2) : item.value.toFixed(1)} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
