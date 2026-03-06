"use client";

import { useMemo, useState } from "react";
import { Search, Dumbbell, Plus } from "lucide-react";
import {
  Exercise,
  MODALITY_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
  MOVEMENT_PATTERN_OPTIONS,
} from "@/lib/types";
import { youtubeThumbnailUrl } from "@/lib/youtube";

interface ExerciseLibrarySidebarProps {
  exercises: Exercise[];
  editing: boolean;
  onAddExercise: (ex: Exercise) => void;
  onOpenExerciseEditor: (exerciseName: string) => void;
  onExerciseDragStart?: (exercise: Exercise) => void;
  onExerciseDragEnd?: () => void;
}

export function ExerciseLibrarySidebar({
  exercises,
  editing,
  onAddExercise,
  onOpenExerciseEditor,
  onExerciseDragStart,
  onExerciseDragEnd,
}: ExerciseLibrarySidebarProps) {
  const [exSearch, setExSearch] = useState("");
  const [exFilterModality, setExFilterModality] = useState("");
  const [exFilterMuscleGroup, setExFilterMuscleGroup] = useState("");
  const [exFilterMovementPattern, setExFilterMovementPattern] = useState("");

  const filteredExercises = useMemo(() => {
    return exercises.filter(
      (e) =>
        (!exFilterModality || e.modality === exFilterModality) &&
        (!exFilterMuscleGroup || e.muscle_groups.includes(exFilterMuscleGroup)) &&
        (!exFilterMovementPattern || e.movement_patterns.includes(exFilterMovementPattern)) &&
        (exSearch === "" || e.name.toLowerCase().includes(exSearch.toLowerCase()))
    );
  }, [exercises, exSearch, exFilterModality, exFilterMuscleGroup, exFilterMovementPattern]);

  return (
    <div className="w-64 border-r border-border-accent flex flex-col shrink-0 bg-background/50">
      <div className="p-3 px-4 border-b border-border-accent space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 outline-none focus:border-accent/50"
            placeholder="Search exercises..."
            value={exSearch}
            onChange={(e) => setExSearch(e.target.value)}
          />
        </div>
        <select
          value={exFilterModality}
          onChange={(e) => setExFilterModality(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none"
        >
          <option value="">All Modalities</option>
          {MODALITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <select
          value={exFilterMuscleGroup}
          onChange={(e) => setExFilterMuscleGroup(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none"
        >
          <option value="">All Muscle Groups</option>
          {MUSCLE_GROUP_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <select
          value={exFilterMovementPattern}
          onChange={(e) => setExFilterMovementPattern(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none"
        >
          <option value="">All Movement Patterns</option>
          {MOVEMENT_PATTERN_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filteredExercises.map((ex) => {
          const thumbnailUrl = ex.thumbnail_url || youtubeThumbnailUrl(ex.video_url);
          return (
          <div
            key={ex.id}
            className="flex items-center gap-2.5 px-2 py-2.5 border-b border-black/5"
            draggable={editing}
            onDragStart={(e) => {
              if (!editing) return;
              e.dataTransfer.setData("text/plain", String(ex.id));
              e.dataTransfer.effectAllowed = "copyMove";
              onExerciseDragStart?.(ex);
            }}
            onDragEnd={() => onExerciseDragEnd?.()}
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <Dumbbell size={16} className="text-accent" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onOpenExerciseEditor(ex.name)}
                className="text-xs font-semibold text-foreground hover:text-accent truncate block w-full text-left transition-colors"
                title="Click to view/edit exercise details"
              >
                {ex.name}
              </button>
              <div className="text-[10px] text-muted truncate">
                {ex.primary_muscle_group}
              </div>
            </div>
            {editing && (
              <button
                onClick={() => onAddExercise(ex)}
                className="p-1 shrink-0 text-success hover:bg-success/10 rounded transition-colors"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
