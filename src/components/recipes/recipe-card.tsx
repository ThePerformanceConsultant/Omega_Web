"use client";

import { Clock, Flame, UtensilsCrossed } from "lucide-react";
import type { Recipe } from "@/lib/types";

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <button
      onClick={onClick}
      className="glass-card overflow-hidden text-left group hover:border-accent/30 transition-all w-full"
    >
      {/* Image / Placeholder */}
      <div className="aspect-video bg-gradient-to-br from-black/[0.02] to-black/[0.06] relative flex items-center justify-center">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <UtensilsCrossed size={28} className="text-muted/20" />
        )}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-foreground shadow-sm">
          {recipe.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate">
          {recipe.name}
        </h4>

        {/* Macro row */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs font-medium text-foreground">
            <Flame size={11} className="text-accent" />
            {Math.round(recipe.perServingCalories)} kcal
          </span>
          <span className="text-[10px] text-red-500 font-medium">
            P{Math.round(recipe.perServingProtein)}
          </span>
          <span className="text-[10px] text-blue-500 font-medium">
            C{Math.round(recipe.perServingCarbs)}
          </span>
          <span className="text-[10px] text-amber-500 font-medium">
            F{Math.round(recipe.perServingFat)}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-2">
          {recipe.prepTimeMinutes && (
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Clock size={10} />
              {recipe.prepTimeMinutes} min
            </span>
          )}
          <span className="text-[10px] text-muted">
            {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] text-muted">
            {recipe.ingredients.length} ingredients
          </span>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[9px] bg-accent/8 text-accent font-medium"
              >
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-[9px] text-muted">+{recipe.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
