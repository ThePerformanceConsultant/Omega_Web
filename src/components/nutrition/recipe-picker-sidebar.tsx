"use client";

import { useState, useMemo } from "react";
import { Search, Plus, ChevronDown, ChefHat } from "lucide-react";
import { useRecipes } from "@/lib/recipe-store";
import type { Recipe } from "@/lib/types";
import { RECIPE_CATEGORIES } from "@/lib/types";

interface RecipePickerSidebarProps {
  onAddRecipe: (recipe: Recipe) => void;
}

export function RecipePickerSidebar({ onAddRecipe }: RecipePickerSidebarProps) {
  const recipes = useRecipes();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    let result = recipes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (category) {
      result = result.filter((r) => r.category === category);
    }
    return result;
  }, [recipes, search, category]);

  return (
    <div className="flex flex-col h-full border-r border-black/10 bg-surface/30">
      {/* Header */}
      <div className="px-3 pt-4 pb-2 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <ChefHat size={14} className="text-accent" />
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Recipe Library
          </h4>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-black/5 border border-black/10 text-xs text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((recipe) => (
          <button
            key={recipe.id}
            onClick={() => onAddRecipe(recipe)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/[0.04] transition-colors border-b border-black/[0.03] group"
          >
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
                <span className="text-red-500">P{Math.round(recipe.perServingProtein)}</span>
                <span className="text-blue-500">C{Math.round(recipe.perServingCarbs)}</span>
                <span className="text-amber-500">F{Math.round(recipe.perServingFat)}</span>
              </div>
            </div>
            <Plus
              size={14}
              className="text-accent/50 group-hover:text-accent shrink-0"
            />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-muted">No recipes found</p>
            <p className="text-[10px] text-muted/60 mt-1">
              Create recipes in the Recipe Library first
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
