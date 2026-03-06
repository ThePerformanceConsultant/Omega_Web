"use client";

import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { useClientRoadmap, roadmapStore } from "@/lib/roadmap-store";
import { RoadmapHeader } from "./roadmap-header";
import { CalendarOverview } from "./calendar-overview";
import { PhasesSection } from "./phases-section";
import { NotesSection } from "./notes-section";
import { StatsSection } from "./stats-section";
import { DistributionChart } from "./distribution-chart";
import { EventsSection } from "./events-section";
import { AddPhaseModal } from "./add-phase-modal";
import { AddEventModal } from "./add-event-modal";

export function RoadmapTab({ clientId }: { clientId: string }) {
  const roadmap = useClientRoadmap(clientId);
  const [editing, setEditing] = useState(false);
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);

  // Hydrate from Supabase on mount
  useEffect(() => {
    roadmapStore.hydrate(clientId);
  }, [clientId]);

  // Empty state
  if (!roadmap) {
    return (
      <div className="glass-card p-8 text-center">
        <CalendarDays size={40} className="mx-auto mb-4 text-muted opacity-30" />
        <h3 className="text-base font-bold mb-2">No Roadmap</h3>
        <p className="text-sm text-muted mb-4">
          Create a periodisation roadmap for this client&apos;s season
        </p>
        <button
          onClick={() => roadmapStore.createRoadmap(clientId)}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
        >
          Create Roadmap
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RoadmapHeader
        clientId={clientId}
        year={roadmap.year}
        phases={roadmap.phases}
        phaseAssignments={roadmap.phaseAssignments}
        editing={editing}
        onEditingChange={setEditing}
        onAddPhase={() => setAddPhaseOpen(true)}
        onAddEvent={() => setAddEventOpen(true)}
      />

      <div className="glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div
            className="min-w-fit"
            style={{
              display: "grid",
              gridTemplateColumns: "160px repeat(52, 48px)",
            }}
          >
            {/* Calendar Overview: months + week numbers */}
            <CalendarOverview year={roadmap.year} />

            {/* Phases: one row per phase with checkbox grid */}
            <PhasesSection
              clientId={clientId}
              phases={roadmap.phases}
              phaseAssignments={roadmap.phaseAssignments}
              editing={editing}
            />

            {/* Notes: per-week notes with popover */}
            <NotesSection
              clientId={clientId}
              weekNotes={roadmap.weekNotes}
              editing={editing}
            />

            {/* Stats: editable per-week cells */}
            <StatsSection
              clientId={clientId}
              stats={roadmap.stats}
              statEntries={roadmap.statEntries}
              editing={editing}
            />

            {/* Distribution: derived phase blocks Gantt chart */}
            <DistributionChart
              phases={roadmap.phases}
              phaseAssignments={roadmap.phaseAssignments}
            />

            {/* Events: multi-week spanning pills */}
            <EventsSection
              clientId={clientId}
              events={roadmap.events}
              editing={editing}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {addPhaseOpen && (
        <AddPhaseModal
          onAdd={(data) => {
            roadmapStore.addPhase(clientId, {
              id: "rp-" + Date.now(),
              name: data.name,
              color: data.color,
              description: data.description,
            });
          }}
          onClose={() => setAddPhaseOpen(false)}
        />
      )}
      {addEventOpen && (
        <AddEventModal
          onAdd={(data) => {
            roadmapStore.addEvent(clientId, {
              id: "re-" + Date.now(),
              name: data.name,
              color: data.color,
              startWeek: data.startWeek,
              lengthWeeks: data.lengthWeeks,
              notes: data.notes,
            });
          }}
          onClose={() => setAddEventOpen(false)}
        />
      )}
    </div>
  );
}
