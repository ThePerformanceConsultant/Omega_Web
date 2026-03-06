"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, ChevronDown } from "lucide-react";
import { USDA_INGREDIENTS, INGREDIENT_CATEGORIES, USDAIngredient } from "@/lib/ingredient-data";
import {
  fetchIngredientCatalogCategories,
  isSupabaseConfigured,
  searchIngredientCatalog,
} from "@/lib/supabase/db";

function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

interface IngredientSearchPanelProps {
  onAdd: (ingredient: USDAIngredient) => void;
}

export function IngredientSearchPanel({ onAdd }: IngredientSearchPanelProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [remoteResults, setRemoteResults] = useState<USDAIngredient[] | null>(null);
  const [remoteCategories, setRemoteCategories] = useState<string[]>([]);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);

  const supabaseEnabled = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const categories = await fetchIngredientCatalogCategories();
        if (!cancelled) {
          setRemoteCategories(categories);
        }
      } catch (error) {
        console.error("[IngredientSearchPanel] Failed to load ingredient categories:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setRemoteResults(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setIsRemoteLoading(true);
          const results = await searchIngredientCatalog(search, category || undefined, 50);
          if (!cancelled) {
            setRemoteResults(results);
          }
        } catch (error) {
          console.error("[IngredientSearchPanel] Failed to search ingredient catalog:", error);
          if (!cancelled) {
            setRemoteResults(null);
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
  }, [category, search, supabaseEnabled]);

  const filtered = useMemo(() => {
    if (supabaseEnabled && remoteResults !== null) {
      return remoteResults;
    }

    const normalizedSearch = normalizeSearch(search);
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
    if (category) {
      result = result.filter((i) => i.category === category);
    }
    return result.slice(0, 50); // Limit for performance
  }, [category, remoteResults, search, supabaseEnabled]);

  const categories = useMemo(
    () => (supabaseEnabled && remoteCategories.length > 0 ? remoteCategories : INGREDIENT_CATEGORIES),
    [remoteCategories, supabaseEnabled]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-black/5 space-y-2">
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Add Ingredients
        </h4>

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
            placeholder="Search USDA foods..."
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
            {categories.map((cat) => (
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
        {filtered.map((ingredient) => (
          <button
            key={ingredient.fdcId}
            onClick={() => onAdd(ingredient)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/[0.04] transition-colors border-b border-black/[0.03] group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate group-hover:text-accent transition-colors">
                {ingredient.name}
              </p>
              <p className="text-[10px] text-muted">{ingredient.category}</p>
            </div>
            <span className="text-[10px] text-muted tabular-nums shrink-0">
              {ingredient.nutrients.calories != null
                ? `${Math.round(ingredient.nutrients.calories)} kcal`
                : "—"}
            </span>
            <Plus
              size={14}
              className="text-accent/50 group-hover:text-accent shrink-0"
            />
          </button>
        ))}
        {isRemoteLoading && (
          <p className="text-xs text-muted text-center py-3">Searching...</p>
        )}
        {filtered.length === 0 && (
          <p className="text-xs text-muted text-center py-8">No ingredients found</p>
        )}
      </div>
    </div>
  );
}
