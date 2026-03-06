"use client";

import { useState } from "react";
import { X, Plus, BarChart3 } from "lucide-react";
import { RoadmapStat, RoadmapStatEntry } from "@/lib/types";
import { roadmapStore } from "@/lib/roadmap-store";
import { getCurrentWeek } from "./roadmap-utils";

interface StatsSectionProps {
  clientId: string;
  stats: RoadmapStat[];
  statEntries: RoadmapStatEntry[];
  editing: boolean;
}

export function StatsSection({ clientId, stats, statEntries, editing }: StatsSectionProps) {
  const currentWeek = getCurrentWeek();
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);
  const [addingRow, setAddingRow] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState("");

  // Build lookup: statId→week→value
  const entryLookup = new Map<string, Map<number, string>>();
  for (const e of statEntries) {
    if (!entryLookup.has(e.statId)) entryLookup.set(e.statId, new Map());
    entryLookup.get(e.statId)!.set(e.week, e.value);
  }

  return (
    <>
      {/* Section header */}
      <div className="sticky left-0 z-10 bg-surface-light px-3 flex items-center gap-2 border-b border-black/10 py-1.5 min-h-[28px]">
        <BarChart3 size={12} className="text-muted shrink-0" />
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Stats</span>
      </div>
      <div
        className="bg-surface-light border-b border-black/10"
        style={{ gridColumn: "span 52" }}
      />

      {/* Stat rows */}
      {stats.map((stat) => (
        <StatRow
          key={stat.id}
          clientId={clientId}
          stat={stat}
          weeks={weeks}
          currentWeek={currentWeek}
          values={entryLookup.get(stat.id) || new Map()}
          editing={editing}
        />
      ))}

      {/* Add stat row */}
      {editing && (
        <>
          <div className="sticky left-0 z-10 bg-surface px-3 flex items-center border-b border-black/5 py-1">
            {addingRow ? (
              <div className="flex items-center gap-1 w-full">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label"
                  className="w-16 px-1.5 py-0.5 rounded bg-black/5 border border-black/10 text-[10px] focus:outline-none focus:border-accent/50"
                  autoFocus
                />
                <input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-12 px-1.5 py-0.5 rounded bg-black/5 border border-black/10 text-[10px] focus:outline-none focus:border-accent/50"
                />
                <button
                  onClick={() => {
                    if (newLabel.trim()) {
                      roadmapStore.addStat(clientId, {
                        id: "rs-" + Date.now(),
                        label: newLabel.trim(),
                        unit: newUnit.trim(),
                        isDefault: false,
                      });
                      setNewLabel("");
                      setNewUnit("");
                      setAddingRow(false);
                    }
                  }}
                  className="text-[10px] text-accent font-medium hover:underline"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingRow(false); setNewLabel(""); setNewUnit(""); }}
                  className="text-[10px] text-muted hover:text-foreground"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingRow(true)}
                className="text-[10px] text-accent font-medium hover:underline flex items-center gap-1"
              >
                <Plus size={10} /> Add Stat
              </button>
            )}
          </div>
          <div className="border-b border-black/5" style={{ gridColumn: "span 52" }} />
        </>
      )}
    </>
  );
}

function StatRow({
  clientId,
  stat,
  weeks,
  currentWeek,
  values,
  editing,
}: {
  clientId: string;
  stat: RoadmapStat;
  weeks: number[];
  currentWeek: number;
  values: Map<number, string>;
  editing: boolean;
}) {
  return (
    <>
      {/* Label cell */}
      <div className="sticky left-0 z-10 bg-surface px-3 flex items-center gap-1.5 border-b border-black/5 py-1 min-h-[28px]">
        <span className="text-[10px] font-medium text-foreground truncate" title={`${stat.label}${stat.unit ? ` (${stat.unit})` : ""}`}>
          {stat.label}
        </span>
        {stat.unit && (
          <span className="text-[9px] text-muted shrink-0">({stat.unit})</span>
        )}
        {editing && !stat.isDefault && (
          <button
            onClick={() => roadmapStore.removeStat(clientId, stat.id)}
            className="p-0.5 text-muted hover:text-red-500 transition-colors shrink-0 ml-auto"
            title="Remove stat"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* 52 value cells */}
      {weeks.map((w) => {
        const val = values.get(w) || "";
        const isCurrentWeek = w === currentWeek;

        return (
          <div
            key={w}
            className={`border-b border-black/5 flex items-center justify-center ${
              isCurrentWeek ? "bg-accent/5" : ""
            }`}
          >
            {editing ? (
              <input
                defaultValue={val}
                onBlur={(e) => {
                  roadmapStore.setStatEntry(clientId, stat.id, w, e.target.value);
                }}
                className="w-full h-full text-center text-[10px] bg-transparent focus:bg-black/5 focus:outline-none rounded px-0.5"
                title={`${stat.label} — Week ${w}`}
              />
            ) : (
              <span className="text-[10px] text-foreground">{val}</span>
            )}
          </div>
        );
      })}
    </>
  );
}
