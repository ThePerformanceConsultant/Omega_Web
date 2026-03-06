"use client";

import { useState, useRef } from "react";
import { X, Flag, MessageSquareText } from "lucide-react";
import { RoadmapEvent } from "@/lib/types";
import { roadmapStore } from "@/lib/roadmap-store";
import { getCurrentWeek } from "./roadmap-utils";

interface EventsSectionProps {
  clientId: string;
  events: RoadmapEvent[];
  editing: boolean;
}

interface EventLane {
  events: RoadmapEvent[];
}

/**
 * Greedy lane allocation: sort events by startWeek, assign each to first non-overlapping lane.
 */
function allocateLanes(events: RoadmapEvent[]): EventLane[] {
  const sorted = [...events].sort((a, b) => a.startWeek - b.startWeek);
  const lanes: EventLane[] = [];

  for (const evt of sorted) {
    let placed = false;

    for (const lane of lanes) {
      const lastInLane = lane.events[lane.events.length - 1];
      const lastEnd = lastInLane.startWeek + lastInLane.lengthWeeks - 1;
      if (evt.startWeek > lastEnd) {
        lane.events.push(evt);
        placed = true;
        break;
      }
    }

    if (!placed) {
      lanes.push({ events: [evt] });
    }
  }

  return lanes;
}

export function EventsSection({ clientId, events, editing }: EventsSectionProps) {
  const currentWeek = getCurrentWeek();
  const lanes = allocateLanes(events);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  if (events.length === 0 && !editing) {
    return (
      <>
        <div className="sticky left-0 z-10 bg-surface-light px-3 flex items-center gap-2 border-b border-black/10 py-1.5 min-h-[28px]">
          <Flag size={12} className="text-muted shrink-0" />
          <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Events</span>
        </div>
        <div
          className="bg-surface-light border-b border-black/10 flex items-center justify-center text-xs text-muted italic py-2"
          style={{ gridColumn: "span 52" }}
        >
          No events
        </div>
      </>
    );
  }

  return (
    <>
      {/* Section header */}
      <div
        className="sticky left-0 z-10 bg-surface-light px-3 flex items-center gap-2 border-b border-black/10 py-1.5 min-h-[28px]"
        style={{ gridRow: `span ${Math.max(lanes.length, 1)}` }}
      >
        <Flag size={12} className="text-muted shrink-0" />
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Events</span>
      </div>

      {lanes.map((lane, laneIdx) => (
        <EventLaneRow
          key={laneIdx}
          clientId={clientId}
          lane={lane}
          currentWeek={currentWeek}
          editing={editing}
          activeEventId={activeEventId}
          onToggleEvent={(id) => setActiveEventId(activeEventId === id ? null : id)}
        />
      ))}
    </>
  );
}

function EventLaneRow({
  clientId,
  lane,
  currentWeek,
  editing,
  activeEventId,
  onToggleEvent,
}: {
  clientId: string;
  lane: EventLane;
  currentWeek: number;
  editing: boolean;
  activeEventId: string | null;
  onToggleEvent: (id: string) => void;
}) {
  const weekToEvent = new Map<number, RoadmapEvent>();
  for (const evt of lane.events) {
    for (let w = evt.startWeek; w < evt.startWeek + evt.lengthWeeks; w++) {
      weekToEvent.set(w, evt);
    }
  }

  const cells: React.ReactNode[] = [];
  let w = 1;
  while (w <= 52) {
    const evt = weekToEvent.get(w);
    if (evt && w === evt.startWeek) {
      const span = Math.min(evt.lengthWeeks, 53 - w);
      cells.push(
        <EventPill
          key={`evt-${evt.id}`}
          event={evt}
          span={span}
          clientId={clientId}
          editing={editing}
          isActive={activeEventId === evt.id}
          onToggle={() => onToggleEvent(evt.id)}
        />
      );
      w += span;
    } else {
      cells.push(
        <div
          key={`empty-${w}`}
          className={`border-b border-black/10 ${w === currentWeek ? "bg-accent/5" : ""}`}
        />
      );
      w++;
    }
  }

  return <>{cells}</>;
}

function EventPill({
  event,
  span,
  clientId,
  editing,
  isActive,
  onToggle,
}: {
  event: RoadmapEvent;
  span: number;
  clientId: string;
  editing: boolean;
  isActive: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showPopover = event.notes && (isActive || hovered);

  return (
    <div
      className="border-b border-black/10 flex items-center px-0.5 py-0.5 relative"
      style={{ gridColumn: `span ${span}` }}
    >
      <div
        className={`w-full h-7 rounded flex items-center justify-center gap-1 text-[10px] font-semibold text-white overflow-hidden transition-all cursor-pointer ${
          isActive ? "ring-2 ring-foreground ring-offset-1" : ""
        }`}
        style={{ backgroundColor: event.color }}
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {event.notes && (
          <MessageSquareText size={10} className="shrink-0 opacity-80" />
        )}
        <span className="truncate px-0.5">{event.name}</span>
        {editing && isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              roadmapStore.removeEvent(clientId, event.id);
            }}
            className="p-0.5 hover:bg-white/20 rounded shrink-0"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Notes popover */}
      {showPopover && (
        <EventNotesPopover event={event} />
      )}
    </div>
  );
}

function EventNotesPopover({ event }: { event: RoadmapEvent }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-30 w-52 bg-white rounded-lg border border-black/10 shadow-lg p-3 pointer-events-none"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: event.color }}
        />
        <span className="text-xs font-semibold text-foreground truncate">{event.name}</span>
      </div>
      <div className="text-[10px] text-muted mb-1">
        Wk {event.startWeek}
        {event.lengthWeeks > 1 ? `–${event.startWeek + event.lengthWeeks - 1}` : ""}
        {" · "}
        {event.lengthWeeks} week{event.lengthWeeks !== 1 ? "s" : ""}
      </div>
      <p className="text-xs text-foreground leading-relaxed">{event.notes}</p>
    </div>
  );
}
