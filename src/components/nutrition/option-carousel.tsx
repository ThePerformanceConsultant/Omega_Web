"use client";

import { Plus, X } from "lucide-react";
import type { MealOption } from "@/lib/types";

interface OptionCarouselProps {
  options: MealOption[];
  activeOption: number; // optionNumber (1-based)
  maxOptions: number;
  onSelectOption: (optionNumber: number) => void;
  onAddOption: () => void;
  onRemoveOption: (optionNumber: number) => void;
}

export function OptionCarousel({
  options,
  activeOption,
  maxOptions,
  onSelectOption,
  onAddOption,
  onRemoveOption,
}: OptionCarouselProps) {
  const canAdd = options.length < maxOptions;

  return (
    <div className="flex items-center gap-1">
      {options.map((opt) => {
        const isActive = opt.optionNumber === activeOption;
        const hasContent =
          opt.recipeId !== null || opt.ingredients.length > 0;

        return (
          <div key={opt.id} className="relative group">
            <button
              onClick={() => onSelectOption(opt.optionNumber)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : hasContent
                  ? "bg-black/5 text-foreground border border-black/10 hover:bg-black/10"
                  : "bg-black/[0.02] text-muted border border-dashed border-black/10 hover:bg-black/5"
              }`}
            >
              Option {opt.optionNumber}
            </button>
            {/* Remove button — only show for non-first options on hover */}
            {opt.optionNumber > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOption(opt.optionNumber);
                }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={8} />
              </button>
            )}
          </div>
        );
      })}
      {canAdd && (
        <button
          onClick={onAddOption}
          className="w-7 h-7 rounded-md border border-dashed border-black/15 text-muted hover:text-accent hover:border-accent/30 flex items-center justify-center transition-colors"
          title="Add option"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
