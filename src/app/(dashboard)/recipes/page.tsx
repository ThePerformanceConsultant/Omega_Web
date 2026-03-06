"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Plus, Grid3X3, List, X, ChevronDown } from "lucide-react";
import { useRecipes, recipeStore } from "@/lib/recipe-store";
import { RECIPE_CATEGORIES, Recipe } from "@/lib/types";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeEditorModal } from "@/components/recipes/recipe-editor-modal";

export default function RecipesPage() {
  const recipes = useRecipes();
  const [search, setSearch] = useState("");

  useEffect(() => { recipeStore.hydrate(); }, []);
  const [filterCategory, setFilterCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = recipes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.ingredients.some((i) => i.name.toLowerCase().includes(q))
      );
    }
    if (filterCategory) {
      result = result.filter((r) => r.category === filterCategory);
    }
    return result;
  }, [recipes, search, filterCategory]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Recipe[]> = {};
    for (const r of filtered) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const hasActiveFilters = !!filterCategory;

  function openEditor(recipe: Recipe | null) {
    setEditingRecipe(recipe);
    setIsEditorOpen(true);
  }

  function handleSave(recipe: Recipe) {
    if (editingRecipe) {
      recipeStore.update(recipe.id, recipe);
    } else {
      recipeStore.add(recipe);
    }
    setIsEditorOpen(false);
    setEditingRecipe(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">
            {filtered.length} of {recipes.length} recipes
          </p>
        </div>
        <button
          onClick={() => openEditor(null)}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
        >
          <Plus size={16} /> New Recipe
        </button>
      </div>

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
            placeholder="Search recipes by name, category, tag, or ingredient..."
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
        <div className="flex rounded-lg overflow-hidden border border-black/10">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2.5 ${
              viewMode === "grid"
                ? "bg-accent/15 text-accent"
                : "bg-black/5 text-muted"
            }`}
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2.5 ${
              viewMode === "list"
                ? "bg-accent/15 text-accent"
                : "bg-black/5 text-muted"
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-muted mb-1">
              Category
            </label>
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none pr-8"
              >
                <option value="">All Categories</option>
                {RECIPE_CATEGORIES.map((cat) => (
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

      {/* Recipe Grid */}
      {viewMode === "grid" ? (
        <div className="space-y-8">
          {grouped.map(([category, recipes]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
                {category}
                <span className="text-xs font-normal text-muted/50">
                  ({recipes.length})
                </span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {recipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onClick={() => openEditor(recipe)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => openEditor(recipe)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-black/5 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{recipe.name}</p>
                <p className="text-xs text-muted">
                  {recipe.category} · {recipe.ingredients.length} ingredients
                </p>
              </div>
              <span className="text-xs text-foreground font-medium shrink-0">
                {Math.round(recipe.perServingCalories)} kcal
              </span>
              <div className="flex gap-2 shrink-0 text-[10px] font-medium">
                <span className="text-red-500">P{Math.round(recipe.perServingProtein)}</span>
                <span className="text-blue-500">C{Math.round(recipe.perServingCarbs)}</span>
                <span className="text-amber-500">F{Math.round(recipe.perServingFat)}</span>
              </div>
              <span className="text-xs text-muted/60 shrink-0">{recipe.category}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <p className="text-muted">No recipes match your search</p>
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

      {/* Editor Modal */}
      {isEditorOpen && (
        <RecipeEditorModal
          recipe={editingRecipe}
          onSave={handleSave}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingRecipe(null);
          }}
        />
      )}
    </div>
  );
}
