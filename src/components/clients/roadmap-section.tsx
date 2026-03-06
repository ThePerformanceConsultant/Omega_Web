"use client";

import { CalendarDays, Flag } from "lucide-react";
import { useClientRoadmap } from "@/lib/roadmap-store";
import { derivePhaseBlocks, getCurrentWeek } from "./tabs/roadmap/roadmap-utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TOTAL_WEEKS = 52;

export function RoadmapSection({ clientId }: { clientId: string }) {
  const roadmap = useClientRoadmap(clientId);

  if (!roadmap) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-accent" />
            <h3 className="text-base font-bold">Roadmap</h3>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-muted">
          <CalendarDays size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No roadmap configured</p>
          <p className="text-xs mt-1">Plan phases and events for this client&#39;s season</p>
        </div>
      </div>
    );
  }

  const currentWeek = getCurrentWeek();
  const blocks = derivePhaseBlocks(roadmap.phases, roadmap.phaseAssignments);
  const totalPhaseWeeks = blocks.reduce((sum, b) => sum + (b.endWeek - b.startWeek + 1), 0);
  const currentBlock = blocks.find((b) => currentWeek >= b.startWeek && currentWeek <= b.endWeek);
  const nextEvent = roadmap.events
    .filter((e) => e.startWeek >= currentWeek)
    .sort((a, b) => a.startWeek - b.startWeek)[0];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-accent" />
          <h3 className="text-base font-bold">Roadmap {roadmap.year}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {currentBlock && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: currentBlock.color }}
            >
              Current: {currentBlock.name}
            </span>
          )}
          {nextEvent && (
            <span>
              Next: {nextEvent.name} (wk {nextEvent.startWeek})
            </span>
          )}
        </div>
      </div>

      {/* Month headers */}
      <div className="flex mb-1">
        {MONTHS.map((m) => (
          <div key={m} className="flex-1 text-center text-[10px] text-muted font-medium uppercase tracking-wider">
            {m}
          </div>
        ))}
      </div>

      {/* Phase blocks */}
      <div className="relative h-10 mb-2 rounded-lg overflow-hidden bg-black/[0.02]">
        {blocks.map((block) => {
          const leftPct = ((block.startWeek - 1) / TOTAL_WEEKS) * 100;
          const widthPct = ((block.endWeek - block.startWeek + 1) / TOTAL_WEEKS) * 100;
          return (
            <div
              key={`${block.phaseId}-${block.startWeek}`}
              className="absolute top-0 h-full flex items-center justify-center rounded-md text-[10px] font-semibold text-white overflow-hidden"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                backgroundColor: block.color,
              }}
              title={`${block.name} (Wk ${block.startWeek}–${block.endWeek})`}
            >
              <span className="truncate px-1">{block.name}</span>
            </div>
          );
        })}

        {/* Current week marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/80 z-10"
          style={{ left: `${((currentWeek - 0.5) / TOTAL_WEEKS) * 100}%` }}
          title={`Current: Week ${currentWeek}`}
        />
      </div>

      {/* Events row */}
      <div className="relative h-8 mb-4">
        {roadmap.events.map((evt) => {
          const leftPct = ((evt.startWeek - 0.5) / TOTAL_WEEKS) * 100;
          const widthPct = (evt.lengthWeeks / TOTAL_WEEKS) * 100;
          return (
            <div
              key={evt.id}
              className="absolute top-0 flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white whitespace-nowrap overflow-hidden"
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 2)}%`,
                backgroundColor: evt.color,
              }}
              title={`${evt.name} — Week ${evt.startWeek}${evt.lengthWeeks > 1 ? `–${evt.startWeek + evt.lengthWeeks - 1}` : ""}`}
            >
              <Flag size={10} />
              <span className="hidden md:inline truncate">{evt.name}</span>
            </div>
          );
        })}
      </div>

      {/* Stats summary */}
      <div className="flex items-center gap-6 pt-3 border-t border-black/5 text-xs text-muted">
        <span>
          <strong className="text-foreground">{roadmap.phases.length}</strong> phases
        </span>
        <span>
          <strong className="text-foreground">{totalPhaseWeeks}</strong> weeks planned
        </span>
        <span>
          <strong className="text-foreground">{roadmap.events.length}</strong> events
        </span>
        {currentBlock && (
          <span>
            <strong className="text-foreground">{currentBlock.endWeek - currentWeek + 1}</strong> weeks remaining in{" "}
            {currentBlock.name}
          </span>
        )}
      </div>
    </div>
  );
}
