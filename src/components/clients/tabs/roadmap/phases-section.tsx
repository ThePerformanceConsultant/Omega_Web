"use client";

import { X } from "lucide-react";
import { RoadmapPhaseBlock } from "@/lib/types";
import { roadmapStore } from "@/lib/roadmap-store";
import { getCurrentWeek } from "./roadmap-utils";

interface PhasesSectionProps {
  clientId: string;
  phases: RoadmapPhaseBlock[];
  phaseAssignments: Record<number, string>;
  editing: boolean;
}

export function PhasesSection({
  clientId,
  phases,
  phaseAssignments,
  editing,
}: PhasesSectionProps) {
  const currentWeek = getCurrentWeek();
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  if (phases.length === 0) {
    return (
      <>
        <div className="sticky left-0 z-10 bg-surface px-3 flex items-center text-[10px] text-muted font-medium uppercase tracking-wider border-b border-black/5 py-3">
          PHASES
        </div>
        <div
          className="border-b border-black/5 flex items-center justify-center text-xs text-muted italic py-3"
          style={{ gridColumn: "span 52" }}
        >
          No phases yet — click &quot;+ Phase&quot; to add one
        </div>
      </>
    );
  }

  return (
    <>
      {phases.map((phase) => (
        <PhaseRow
          key={phase.id}
          clientId={clientId}
          phase={phase}
          phaseAssignments={phaseAssignments}
          editing={editing}
          weeks={weeks}
          currentWeek={currentWeek}
        />
      ))}
    </>
  );
}

function PhaseRow({
  clientId,
  phase,
  phaseAssignments,
  editing,
  weeks,
  currentWeek,
}: {
  clientId: string;
  phase: RoadmapPhaseBlock;
  phaseAssignments: Record<number, string>;
  editing: boolean;
  weeks: number[];
  currentWeek: number;
}) {
  return (
    <>
      {/* Label cell */}
      <div className="sticky left-0 z-10 bg-surface px-3 flex items-center gap-2 border-b border-black/5 py-1.5 min-h-[32px]">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: phase.color }}
        />
        <span className="text-xs font-medium text-foreground truncate flex-1" title={phase.name}>
          {phase.name}
        </span>
        {editing && (
          <button
            onClick={() => roadmapStore.removePhase(clientId, phase.id)}
            className="p-0.5 text-muted hover:text-red-500 transition-colors shrink-0"
            title="Remove phase"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* 52 checkbox cells */}
      {weeks.map((w) => {
        const assignedPhaseId = phaseAssignments[w];
        const isAssigned = assignedPhaseId === phase.id;
        const isCurrentWeek = w === currentWeek;

        return (
          <div
            key={w}
            className={`border-b border-black/5 flex items-center justify-center ${
              isCurrentWeek ? "bg-accent/5" : ""
            } ${editing ? "cursor-pointer hover:bg-black/[0.03]" : ""}`}
            onClick={() => {
              if (!editing) return;
              if (isAssigned) {
                roadmapStore.clearPhaseAssignment(clientId, w);
              } else {
                roadmapStore.setPhaseAssignment(clientId, w, phase.id);
              }
            }}
          >
            <div
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                isAssigned
                  ? "border-transparent"
                  : "border-black/15"
              }`}
              style={isAssigned ? { backgroundColor: phase.color, borderColor: phase.color } : {}}
            />
          </div>
        );
      })}
    </>
  );
}
