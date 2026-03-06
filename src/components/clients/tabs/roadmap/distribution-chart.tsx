"use client";

import { RoadmapPhaseBlock } from "@/lib/types";
import { derivePhaseBlocks, getCurrentWeek } from "./roadmap-utils";

interface DistributionChartProps {
  phases: RoadmapPhaseBlock[];
  phaseAssignments: Record<number, string>;
}

export function DistributionChart({ phases, phaseAssignments }: DistributionChartProps) {
  const blocks = derivePhaseBlocks(phases, phaseAssignments);
  const currentWeek = getCurrentWeek();

  // Build spanning cells: iterate weeks 1-52, emit block spans or empty cells
  const cells: React.ReactNode[] = [];
  let w = 1;
  while (w <= 52) {
    const block = blocks.find((b) => w === b.startWeek);
    if (block) {
      const span = block.endWeek - block.startWeek + 1;
      const containsCurrent = currentWeek >= block.startWeek && currentWeek <= block.endWeek;
      cells.push(
        <div
          key={`block-${block.phaseId}-${block.startWeek}`}
          className={`border-b border-black/10 flex items-center py-1 px-0.5 ${
            containsCurrent ? "bg-accent/5" : ""
          }`}
          style={{ gridColumn: `span ${span}` }}
        >
          <div
            className="h-7 w-full rounded flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden"
            style={{ backgroundColor: block.color }}
            title={`${block.name} (Wk ${block.startWeek}–${block.endWeek})`}
          >
            <span className="truncate px-1.5">{block.name}</span>
          </div>
        </div>
      );
      w += span;
    } else {
      // Check if this week is inside any block (shouldn't be, since blocks are contiguous from startWeek)
      // Emit single empty cell
      cells.push(
        <div
          key={`empty-${w}`}
          className={`border-b border-black/10 flex items-center py-1 ${
            w === currentWeek ? "bg-accent/5" : ""
          }`}
        >
          <div className="h-7 w-full bg-black/[0.02] rounded" />
        </div>
      );
      w++;
    }
  }

  return (
    <>
      {/* Label cell */}
      <div className="sticky left-0 z-10 bg-surface-light px-3 flex items-center gap-2 border-b border-black/10 py-2 min-h-[36px]">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Distribution</span>
      </div>

      {cells}
    </>
  );
}
