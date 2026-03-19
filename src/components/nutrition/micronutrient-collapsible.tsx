"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pill, Droplets, FlaskConical } from "lucide-react";
import {
  groupMicronutrients,
  type MicronutrientGroupItem,
} from "@/lib/plan-nutrition-utils";
import {
  formatPercentRdaInline,
  getNrvByNutrientKey,
  getPercentRda,
  getUlByNutrientKey,
} from "@/lib/nutrient-reference-values";

interface MicronutrientCollapsibleProps {
  micronutrients: Record<string, number>;
  /** Compact variant for smaller containers */
  compact?: boolean;
}

function formatValue(value: number): string {
  if (value < 0.01) return "< 0.01";
  if (value < 1) return value.toFixed(2);
  if (value < 10) return value.toFixed(1);
  return Math.round(value).toString();
}

function stateForNutrient(item: MicronutrientGroupItem): "accent" | "success" | "danger" {
  const ul = getUlByNutrientKey(item.key);
  if (ul != null && item.value > ul) return "danger";

  const nrv = getNrvByNutrientKey(item.key);
  if (nrv != null) {
    const lower = nrv * 0.9;
    const upper = nrv * 1.1;
    if (item.value >= lower && item.value <= upper) return "success";
  }
  return "accent";
}

function stateClasses(state: "accent" | "success" | "danger"): {
  border: string;
  fill: string;
} {
  if (state === "danger") {
    return {
      border: "border-red-500/60",
      fill: "bg-red-500/25",
    };
  }
  if (state === "success") {
    return {
      border: "border-emerald-600/55",
      fill: "bg-emerald-500/25",
    };
  }
  return {
    border: "border-amber-500/60",
    fill: "bg-amber-500/25",
  };
}

const GROUP_CONFIG = {
  mineral: {
    label: "Minerals",
    icon: FlaskConical,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
  },
  vitamin: {
    label: "Vitamins",
    icon: Pill,
    color: "text-violet-600",
    bgColor: "bg-violet-500/10",
  },
  lipid: {
    label: "Lipids",
    icon: Droplets,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
  },
} as const;

export function MicronutrientCollapsible({
  micronutrients,
  compact = false,
}: MicronutrientCollapsibleProps) {
  const [expanded, setExpanded] = useState(false);
  const groups = groupMicronutrients(micronutrients);

  const totalItems =
    groups.mineral.length + groups.vitamin.length + groups.lipid.length;

  if (totalItems === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-muted hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span>Full Nutrition Profile</span>
        <span className="text-muted/60">({totalItems})</span>
      </button>

      {expanded && (
        <div className={`mt-2 space-y-2 ${compact ? "" : "pl-1"}`}>
          {(["mineral", "vitamin", "lipid"] as const).map((group) => {
            const items = groups[group];
            if (items.length === 0) return null;
            const config = GROUP_CONFIG[group];
            const Icon = config.icon;

            return (
              <MicroGroupSection
                key={group}
                label={config.label}
                icon={<Icon size={10} className={config.color} />}
                bgColor={config.bgColor}
                color={config.color}
                items={items}
                compact={compact}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MicroGroupSection({
  label,
  icon,
  bgColor,
  color,
  items,
  compact,
}: {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  color: string;
  items: MicronutrientGroupItem[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`rounded-lg border border-black/5 overflow-hidden ${compact ? "" : ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-black/[0.02] transition-colors"
      >
        {open ? (
          <ChevronDown size={8} className="text-muted shrink-0" />
        ) : (
          <ChevronRight size={8} className="text-muted shrink-0" />
        )}
        <span className={`p-0.5 rounded ${bgColor}`}>{icon}</span>
        <span className={`text-[10px] font-semibold ${color}`}>{label}</span>
        <span className="text-[9px] text-muted ml-auto">{items.length}</span>
      </button>

      {open && (
        <div
          className={
            compact
              ? "px-2.5 pb-2 grid grid-cols-1 gap-x-4 gap-y-1"
              : "px-2.5 pb-2 grid grid-cols-2 gap-x-4 gap-y-1"
          }
        >
          {items.map((item) => {
            const nrv = getNrvByNutrientKey(item.key);
            const percent = getPercentRda(item.key, item.value);

            if (nrv != null && percent != null) {
              const state = stateForNutrient(item);
              const classes = stateClasses(state);
              const progress = Math.max(0, Math.min(item.value / nrv, 1));

              return (
                <div key={item.key}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted truncate min-w-0 flex-1">
                      {item.label}
                    </span>
                    <div
                      className={`relative h-6 rounded-full border ${classes.border} bg-black/5 overflow-hidden shrink-0 w-[232px]`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${classes.fill}`}
                        style={{ width: `${progress * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center px-3 text-[10px] font-semibold text-foreground tabular-nums whitespace-nowrap">
                        {formatValue(item.value)} {item.unit} / {formatValue(nrv)} {item.unit} ({formatPercentRdaInline(percent)})
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.key} className="flex items-baseline justify-between">
                <span className="text-[9px] text-muted truncate pr-1">
                  {item.label}
                </span>
                <span className="text-[9px] font-medium text-foreground tabular-nums shrink-0">
                  {formatValue(item.value)}
                  <span className="text-muted ml-0.5">{item.unit}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
