"use client";

import { useState } from "react";
import { X, Search, FileStack } from "lucide-react";
import type { MealPlanTemplate } from "@/lib/types";

interface TemplateSelectorModalProps {
  templates: MealPlanTemplate[];
  onSelect: (template: MealPlanTemplate) => void;
  onClose: () => void;
}

export function TemplateSelectorModal({
  templates,
  onSelect,
  onClose,
}: TemplateSelectorModalProps) {
  const [search, setSearch] = useState("");

  const filtered = templates.filter((t) =>
    (t.name || "Untitled").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Select Template
            </h3>
            <p className="text-[10px] text-muted mt-0.5">
              Choose a meal plan template from your library
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-black/5">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm focus:outline-none focus:border-accent/50"
              autoFocus
            />
          </div>
        </div>

        {/* Template list */}
        <div className="max-h-[380px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">
              No templates found
            </p>
          ) : (
            filtered.map((template) => {
              const dt = template.dayTypes[0];
              return (
                <button
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-accent/5 transition-colors text-left border-b border-black/[0.03] last:border-b-0"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <FileStack size={14} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {template.name || "Untitled Plan"}
                    </p>
                    {template.description && (
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-1">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
                      <span>
                        {template.dayTypes.length} day type
                        {template.dayTypes.length !== 1 ? "s" : ""}
                      </span>
                      {dt && (
                        <>
                          <span>·</span>
                          <span>{dt.targetCalories} kcal</span>
                          <span>·</span>
                          <span>
                            P{dt.targetProteinGrams}g · C
                            {dt.targetCarbsGrams}g · F
                            {dt.targetFatGrams}g
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
