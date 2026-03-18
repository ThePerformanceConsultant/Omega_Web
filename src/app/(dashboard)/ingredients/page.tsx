"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Filter, X, Database, ChevronDown } from "lucide-react";
import { USDA_INGREDIENTS, INGREDIENT_CATEGORIES, USDAIngredient } from "@/lib/ingredient-data";
import { IngredientDetailModal } from "@/components/ingredients/ingredient-detail-modal";
import { CreateIngredientModal } from "@/components/ingredients/create-ingredient-modal";
import { createClient } from "@/lib/supabase/client";
import {
  createIngredientCatalogItem,
  fetchIngredientCatalogCategories,
  fetchIngredientCatalogCount,
  isSupabaseConfigured,
  searchIngredientCatalog,
} from "@/lib/supabase/db";

// Sort options
type SortKey = "name" | "calories" | "protein" | "carbs" | "fat";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "calories", label: "Calories" },
  { value: "protein", label: "Protein" },
  { value: "carbs", label: "Carbs" },
  { value: "fat", label: "Fat" },
];

const SOURCE_LABELS: Record<string, string> = {
  usda_survey: "USDA",
  mccance_widdowson: "McCance",
  open_food_facts: "Open Food Facts",
  fatsecret_uk: "FatSecret UK",
  coach_custom: "Custom",
  client_custom: "Client Custom",
};

function getNutrient(ingredient: USDAIngredient, key: string): number {
  return ingredient.nutrients[key] ?? 0;
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

export default function IngredientsPage() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<USDAIngredient | null>(null);
  const [remoteIngredients, setRemoteIngredients] = useState<USDAIngredient[]>([]);
  const [remoteCategories, setRemoteCategories] = useState<string[]>([]);
  const [remoteTotalCount, setRemoteTotalCount] = useState(0);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [showCreateIngredient, setShowCreateIngredient] = useState(false);
  const [isCreatingIngredient, setIsCreatingIngredient] = useState(false);

  const supabaseEnabled = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseEnabled) {
      setAuthReady(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getSession().finally(() => {
      if (!cancelled) setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) setAuthReady(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled || !authReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const [categories, count] = await Promise.all([
          fetchIngredientCatalogCategories(),
          fetchIngredientCatalogCount(),
        ]);
        if (!cancelled) {
          setRemoteCategories(categories);
          setRemoteTotalCount(count);
        }
      } catch (error) {
        console.error("[IngredientsPage] Failed to load catalog metadata:", error);
        if (!cancelled) {
          setRemoteCategories([]);
          setRemoteTotalCount(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled || !authReady) {
      setRemoteIngredients([]);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setIsRemoteLoading(true);
          const results = await searchIngredientCatalog(search, filterCategory || undefined, 2000);
          if (!cancelled) {
            setRemoteIngredients(results);
          }
        } catch (error) {
          console.error("[IngredientsPage] Failed to search ingredient catalog:", error);
          if (!cancelled) {
            setRemoteIngredients([]);
          }
        } finally {
          if (!cancelled) {
            setIsRemoteLoading(false);
          }
        }
      })();
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [authReady, filterCategory, search, supabaseEnabled]);

  const filtered = useMemo(() => {
    let result = supabaseEnabled ? remoteIngredients : USDA_INGREDIENTS;

    // Search
    if (search) {
      const q = normalizeSearch(search);
      result = result.filter(
        (item) =>
          normalizeSearch(item.name).includes(q) ||
          normalizeSearch(item.category).includes(q)
      );
    }

    // Category filter
    if (filterCategory) {
      result = result.filter((item) => item.category === filterCategory);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "calories":
          cmp = getNutrient(a, "calories") - getNutrient(b, "calories");
          break;
        case "protein":
          cmp = getNutrient(a, "protein") - getNutrient(b, "protein");
          break;
        case "carbs":
          cmp = getNutrient(a, "carbohydrate") - getNutrient(b, "carbohydrate");
          break;
        case "fat":
          cmp = getNutrient(a, "totalFat") - getNutrient(b, "totalFat");
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return result;
  }, [search, filterCategory, sortBy, sortDesc, supabaseEnabled, remoteIngredients]);

  // Group by category for display
  const grouped = useMemo(() => {
    const groups: Record<string, USDAIngredient[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const hasActiveFilters = !!filterCategory;
  const totalIngredientCount = supabaseEnabled ? remoteTotalCount : USDA_INGREDIENTS.length;
  const sourceLabel = supabaseEnabled
    ? "Supabase ingredient catalog"
    : "USDA Foundation Foods";
  const categoryOptions = supabaseEnabled && remoteCategories.length > 0
    ? remoteCategories
    : INGREDIENT_CATEGORIES;

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(key);
      setSortDesc(key !== "name"); // Default descending for numeric, asc for name
    }
  }

  async function handleCreateIngredient(payload: Parameters<typeof createIngredientCatalogItem>[0]) {
    setIsCreatingIngredient(true);
    try {
      const created = await createIngredientCatalogItem(payload);
      setRemoteIngredients((prev) => [created, ...(prev ?? [])]);
      setRemoteTotalCount((prev) => prev + 1);
      setRemoteCategories((prev) =>
        prev.includes(created.category) ? prev : [...prev, created.category].sort((a, b) => a.localeCompare(b))
      );
      setSearch(created.name);
      setFilterCategory("");
      setSelectedIngredient(created);
      setShowCreateIngredient(false);
    } finally {
      setIsCreatingIngredient(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">
            {filtered.length} of {totalIngredientCount} ingredients
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Database size={12} />
          <span>{sourceLabel}</span>
        </div>
      </div>

      {supabaseEnabled && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateIngredient(true)}
            className="px-3 py-2 rounded-lg border border-accent/30 bg-accent/5 text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
          >
            + Create Ingredient
          </button>
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients by name or category..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 rounded-lg border transition-colors flex items-center gap-2 text-sm ${
            hasActiveFilters
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-black/5 border-black/10 text-muted hover:text-foreground"
          }`}
        >
          <Filter size={16} />
          {hasActiveFilters && <span>Filtered</span>}
        </button>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-muted mb-1">Category</label>
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none pr-8"
              >
                <option value="">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-muted mb-1">Sort By</label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  const key = e.target.value as SortKey;
                  setSortBy(key);
                  setSortDesc(key !== "name");
                }}
                className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none pr-8"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
            </div>
          </div>
          <button
            onClick={() => setSortDesc(!sortDesc)}
            className="px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors"
          >
            {sortDesc ? "High → Low" : "Low → High"}
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => setFilterCategory("")}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-accent hover:bg-accent/10"
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-0 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/10 bg-black/[0.02]">
          <div>
            <SortHeader label="Ingredient" sortKey="name" current={sortBy} desc={sortDesc} onSort={toggleSort} />
            {/* Macro legend */}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-medium text-red-500">Protein</span>
              <span className="text-[10px] font-medium text-blue-500">Carbs</span>
              <span className="text-[10px] font-medium text-amber-500">Fat</span>
            </div>
          </div>
          <div className="text-[10px] font-medium text-muted uppercase tracking-wider">
            Source
          </div>
        </div>

        {/* Rows */}
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          {isRemoteLoading && (
            <p className="px-4 py-2 text-xs text-muted">Searching ingredient catalog...</p>
          )}
          {sortBy === "name" && !search && !filterCategory ? (
            // Group by category when no search/filter and sorted by name
            grouped.map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-black/[0.02] border-b border-black/5 sticky top-0 z-[1]">
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {category}
                  </span>
                  <span className="text-[10px] text-muted/50 ml-2">({items.length})</span>
                </div>
                {items.map((item) => (
                  <IngredientRow
                    key={item.fdcId}
                    ingredient={item}
                    onSelect={() => setSelectedIngredient(item)}
                  />
                ))}
              </div>
            ))
          ) : (
            // Flat list when searching/filtering/sorted by nutrient
            filtered.map((item) => (
              <IngredientRow
                key={item.fdcId}
                ingredient={item}
                onSelect={() => setSelectedIngredient(item)}
              />
            ))
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <p className="text-muted">No ingredients match your search</p>
          <button
            onClick={() => {
              setSearch("");
              setFilterCategory("");
            }}
            className="mt-2 text-sm text-accent hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedIngredient && (
        <IngredientDetailModal
          ingredient={selectedIngredient}
          onClose={() => setSelectedIngredient(null)}
        />
      )}

      {showCreateIngredient && (
        <CreateIngredientModal
          title="Create Ingredient"
          initialName={search}
          initialCategory={filterCategory}
          categoryOptions={categoryOptions}
          submitting={isCreatingIngredient}
          onClose={() => setShowCreateIngredient(false)}
          onCreate={handleCreateIngredient}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  current,
  desc,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  desc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const isActive = current === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`text-[10px] font-medium uppercase tracking-wider flex items-center gap-1 ${
        isActive ? "text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
      {isActive && (
        <span className="text-[8px]">{desc ? "▼" : "▲"}</span>
      )}
    </button>
  );
}

function IngredientRow({
  ingredient,
  onSelect,
}: {
  ingredient: USDAIngredient;
  onSelect: () => void;
}) {
  const protein = ingredient.nutrients.protein;
  const carbs = ingredient.nutrients.carbohydrate;
  const fat = ingredient.nutrients.totalFat;

  // Clamp negatives to 0 (USDA "by difference" can produce small negatives)
  const clamp = (v: number | undefined) => (v != null ? Math.max(0, v) : 0);
  const pCal = clamp(protein) * 4;
  const cCal = clamp(carbs) * 4;
  const fCal = clamp(fat) * 9;
  const total = pCal + cCal + fCal || 1;
  const sourceLabel = SOURCE_LABELS[ingredient.source ?? "usda_survey"] ?? "USDA";
  const isPendingClientCustom = ingredient.source === "client_custom";

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center justify-between px-4 py-2.5 border-b border-black/5 hover:bg-accent/[0.03] transition-colors text-left group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Macro ratio mini-bar */}
        <div className="w-1 h-8 rounded-full overflow-hidden bg-black/5 shrink-0 flex flex-col">
          <div style={{ flex: pCal / total, backgroundColor: "#ef4444" }} />
          <div style={{ flex: cCal / total, backgroundColor: "#3b82f6" }} />
          <div style={{ flex: fCal / total, backgroundColor: "#f59e0b" }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
            {ingredient.name}
          </p>
          <span className="text-[10px] text-muted">{ingredient.category}</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted/70 bg-black/[0.03] px-2 py-0.5 rounded shrink-0 ml-3">
        {sourceLabel}
      </span>
      {isPendingClientCustom && (
        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded shrink-0 ml-2">
          Pending Review
        </span>
      )}
    </button>
  );
}
