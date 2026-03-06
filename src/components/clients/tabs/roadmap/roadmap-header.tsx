"use client";

import { useState } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { RoadmapPhaseBlock } from "@/lib/types";
import { roadmapStore } from "@/lib/roadmap-store";
import { getCurrentWeek } from "./roadmap-utils";

interface RoadmapHeaderProps {
  clientId: string;
  year: number;
  phases: RoadmapPhaseBlock[];
  phaseAssignments: Record<number, string>;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onAddPhase: () => void;
  onAddEvent: () => void;
}

export function RoadmapHeader({
  clientId,
  year,
  phases,
  phaseAssignments,
  editing,
  onEditingChange,
  onAddPhase,
  onAddEvent,
}: RoadmapHeaderProps) {
  const currentWeek = getCurrentWeek();
  const currentPhaseId = phaseAssignments[currentWeek];
  const currentPhase = currentPhaseId ? phases.find((p) => p.id === currentPhaseId) : undefined;
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await roadmapStore.save(clientId);
      onEditingChange(false);
    } catch {
      // save failed — stay in edit mode so user doesn't lose work
      console.error("[roadmap] save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    await roadmapStore.discard(clientId);
    onEditingChange(false);
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-accent" />
        <h3 className="text-base font-bold">Roadmap {year}</h3>
        {currentPhase && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium ml-2 text-white"
            style={{ backgroundColor: currentPhase.color }}
          >
            Current: {currentPhase.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing && (
          <>
            <button
              onClick={onAddPhase}
              className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Plus size={14} /> Phase
            </button>
            <button
              onClick={onAddEvent}
              className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Plus size={14} /> Event
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-black/5 text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </>
        )}
        <button
          onClick={() => {
            if (editing) {
              handleSave();
            } else {
              onEditingChange(true);
            }
          }}
          disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            editing
              ? "bg-accent text-white"
              : "bg-black/5 text-muted hover:text-foreground"
          } ${saving ? "opacity-50 cursor-wait" : ""}`}
        >
          {saving ? "Saving…" : editing ? "Save" : "Edit"}
        </button>
      </div>
    </div>
  );
}
