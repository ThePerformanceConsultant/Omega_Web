"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { NUTRIENT_DEFINITIONS } from "@/lib/ingredient-data";
import { NUTRIENT_GROUPS, type NutrientGroup } from "@/lib/types";
import type { CreateIngredientCatalogInput } from "@/lib/supabase/db";

type PortionDraft = {
  id: string;
  label: string;
  gramWeight: string;
};

type CreateIngredientModalProps = {
  title: string;
  initialName?: string;
  initialCategory?: string;
  categoryOptions: string[];
  submitting?: boolean;
  onClose: () => void;
  onCreate: (payload: CreateIngredientCatalogInput) => Promise<void>;
};

export function CreateIngredientModal({
  title,
  initialName = "",
  initialCategory = "",
  categoryOptions,
  submitting = false,
  onClose,
  onCreate,
}: CreateIngredientModalProps) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [nutrientValues, setNutrientValues] = useState<Record<string, string>>({});
  const [portions, setPortions] = useState<PortionDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const nutrientGroups = useMemo(() => {
    const grouped: Record<NutrientGroup, typeof NUTRIENT_DEFINITIONS> = {
      general: [],
      macro: [],
      lipid: [],
      mineral: [],
      vitamin: [],
    };
    for (const def of NUTRIENT_DEFINITIONS) {
      grouped[def.group].push(def);
    }
    return grouped;
  }, []);

  const hasInvalidPortions = portions.some((portion) => {
    const hasLabel = portion.label.trim().length > 0;
    const hasGrams = portion.gramWeight.trim().length > 0;
    if (!hasLabel && !hasGrams) return false;
    const grams = Number(portion.gramWeight);
    return !hasLabel || !Number.isFinite(grams) || grams <= 0;
  });

  const canSave = name.trim().length > 0 && !hasInvalidPortions && !submitting;

  function setNutrientValue(key: string, value: string) {
    setNutrientValues((prev) => ({ ...prev, [key]: value }));
  }

  function addPortion() {
    setPortions((prev) => [
      ...prev,
      { id: `portion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: "", gramWeight: "" },
    ]);
  }

  function updatePortion(id: string, field: "label" | "gramWeight", value: string) {
    setPortions((prev) =>
      prev.map((portion) => (portion.id === id ? { ...portion, [field]: value } : portion))
    );
  }

  function removePortion(id: string) {
    setPortions((prev) => prev.filter((portion) => portion.id !== id));
  }

  async function handleSubmit() {
    if (!canSave) return;

    const nutrients: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(nutrientValues)) {
      const trimmed = rawValue.trim();
      if (!trimmed) continue;
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) {
        setError(`Invalid number for ${key}.`);
        return;
      }
      nutrients[key] = numeric;
    }

    const customPortions = portions
      .map((portion) => ({
        label: portion.label.trim(),
        gramWeight: Number(portion.gramWeight),
      }))
      .filter((portion) => portion.label && Number.isFinite(portion.gramWeight) && portion.gramWeight > 0);

    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        category: category.trim() || "Custom",
        nutrients,
        portions: customPortions,
      });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create ingredient.";
      setError(message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted mt-1">
              Enter nutrient values per 100g. Add optional custom portions (packet, scoop, serving size) below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 text-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Ingredient Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Chicken breast, raw"
                className="w-full px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02] text-sm text-foreground focus:outline-none focus:border-accent/40"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Category</span>
              <input
                list="ingredient-category-options"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Custom"
                className="w-full px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02] text-sm text-foreground focus:outline-none focus:border-accent/40"
              />
              <datalist id="ingredient-category-options">
                {categoryOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
          </div>

          {NUTRIENT_GROUPS.map((group) => {
            const defs = nutrientGroups[group.key];
            if (!defs || defs.length === 0) return null;
            return (
              <section key={group.key} className="rounded-xl border border-black/10 p-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: group.color }}>
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {defs.map((def) => (
                    <label key={def.key} className="space-y-1">
                      <span className="text-[11px] text-muted font-medium">
                        {def.label} ({def.unit})
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={nutrientValues[def.key] ?? ""}
                        onChange={(event) => setNutrientValue(def.key, event.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02] text-sm text-foreground focus:outline-none focus:border-accent/40"
                      />
                    </label>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="rounded-xl border border-black/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Custom Portions</h3>
                <p className="text-xs text-muted">100g is always included by default.</p>
              </div>
              <button
                type="button"
                onClick={addPortion}
                className="px-2.5 py-1.5 rounded-lg border border-accent/30 bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-colors inline-flex items-center gap-1"
              >
                <Plus size={12} />
                Add Portion
              </button>
            </div>

            {portions.length === 0 ? (
              <p className="text-xs text-muted">No custom portions yet.</p>
            ) : (
              <div className="space-y-2">
                {portions.map((portion) => (
                  <div key={portion.id} className="grid grid-cols-[1fr_140px_auto] gap-2">
                    <input
                      type="text"
                      value={portion.label}
                      onChange={(event) => updatePortion(portion.id, "label", event.target.value)}
                      placeholder="Portion label (e.g. packet)"
                      className="px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02] text-sm text-foreground focus:outline-none focus:border-accent/40"
                    />
                    <input
                      type="number"
                      step="any"
                      value={portion.gramWeight}
                      onChange={(event) => updatePortion(portion.id, "gramWeight", event.target.value)}
                      placeholder="Grams"
                      className="px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02] text-sm text-foreground focus:outline-none focus:border-accent/40"
                    />
                    <button
                      type="button"
                      onClick={() => removePortion(portion.id)}
                      className="w-9 h-9 rounded-lg border border-black/10 text-muted hover:text-red-600 hover:border-red-200 transition-colors inline-flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-black/10 bg-white/95">
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          {hasInvalidPortions && (
            <p className="text-xs text-red-600 mb-2">
              Each custom portion must include both a label and a grams value above 0.
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-black/10 text-sm text-muted hover:text-foreground hover:bg-black/[0.03] transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating..." : "Create Ingredient"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
