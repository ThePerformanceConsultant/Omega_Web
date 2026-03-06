"use client";

import { useState, useRef, useEffect } from "react";
import { StickyNote } from "lucide-react";
import { RoadmapWeekNote } from "@/lib/types";
import { roadmapStore } from "@/lib/roadmap-store";
import { getCurrentWeek } from "./roadmap-utils";

interface NotesSectionProps {
  clientId: string;
  weekNotes: RoadmapWeekNote[];
  editing: boolean;
}

export function NotesSection({ clientId, weekNotes, editing }: NotesSectionProps) {
  const currentWeek = getCurrentWeek();
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);
  const noteMap = new Map(weekNotes.map((n) => [n.week, n.text]));
  const [popoverWeek, setPopoverWeek] = useState<number | null>(null);

  return (
    <>
      {/* Label cell */}
      <div className="sticky left-0 z-10 bg-surface px-3 flex items-center gap-2 border-b border-black/5 py-1.5 min-h-[32px]">
        <StickyNote size={12} className="text-muted shrink-0" />
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Notes</span>
      </div>

      {/* 52 note cells */}
      {weeks.map((w) => {
        const hasNote = noteMap.has(w);
        const isCurrentWeek = w === currentWeek;

        return (
          <div
            key={w}
            className={`border-b border-black/5 flex items-center justify-center relative ${
              isCurrentWeek ? "bg-accent/5" : ""
            } ${editing || hasNote ? "cursor-pointer hover:bg-black/[0.03]" : ""}`}
            onClick={() => {
              if (editing || hasNote) {
                setPopoverWeek(popoverWeek === w ? null : w);
              }
            }}
          >
            {hasNote && (
              <div className="w-2.5 h-2.5 rounded-sm bg-accent/40" title={noteMap.get(w)} />
            )}
            {!hasNote && editing && (
              <div className="w-2.5 h-2.5 rounded-sm border border-dashed border-black/10" />
            )}

            {popoverWeek === w && (
              <NotePopover
                week={w}
                clientId={clientId}
                initialText={noteMap.get(w) || ""}
                editing={editing}
                onClose={() => setPopoverWeek(null)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function NotePopover({
  week,
  clientId,
  initialText,
  editing,
  onClose,
}: {
  week: number;
  clientId: string;
  initialText: string;
  editing: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 w-56 bg-white rounded-lg border border-black/10 shadow-lg p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[10px] text-muted font-medium mb-1.5">Week {week} Note</div>
      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-black/5 border border-black/10 text-xs text-foreground resize-none focus:outline-none focus:border-accent/50"
            rows={3}
            placeholder="Add a note..."
            autoFocus
          />
          <div className="flex justify-between mt-2">
            <button
              onClick={() => {
                roadmapStore.removeWeekNote(clientId, week);
                onClose();
              }}
              className="text-[10px] text-red-500 hover:text-red-700"
            >
              Clear
            </button>
            <button
              onClick={() => {
                if (text.trim()) {
                  roadmapStore.setWeekNote(clientId, week, text.trim());
                } else {
                  roadmapStore.removeWeekNote(clientId, week);
                }
                onClose();
              }}
              className="px-2.5 py-1 rounded bg-accent text-white text-[10px] font-medium"
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-foreground leading-relaxed">{initialText}</p>
      )}
    </div>
  );
}
