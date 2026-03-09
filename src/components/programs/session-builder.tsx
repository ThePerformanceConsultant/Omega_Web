"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  ArrowLeft,
  GripVertical,
  Play,
  Dumbbell,
  MoreHorizontal,
  List as ListIcon,
} from "lucide-react";
import {
  ProgramWithPhases,
  PhaseWorkoutWithSections,
  WorkoutExerciseWithSets,
  SetData,
} from "@/lib/types";
import { EXERCISES } from "@/lib/exercise-data";
import { Exercise, SET_TYPE_OPTIONS, SetType } from "@/lib/types";
import { ExerciseEditorModal } from "@/components/exercises/exercise-editor-modal";
import { ExerciseLibrarySidebar } from "./exercise-library-sidebar";
import { fetchExercises, isSupabaseConfigured } from "@/lib/supabase/db";

interface SessionBuilderProps {
  program: ProgramWithPhases;
  phaseIdx: number;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onProgramChange: (fn: (p: ProgramWithPhases) => void) => void;
  onBack: () => void;
  initialWorkoutIdx?: number;
}

export function SessionBuilder({
  program,
  phaseIdx,
  editing,
  onEditingChange,
  onProgramChange,
  onBack,
  initialWorkoutIdx = 0,
}: SessionBuilderProps) {
  const WEEKDAY_OPTIONS: Array<{ value: number; label: string; short: string }> = [
    { value: 2, label: "Monday", short: "Mon" },
    { value: 3, label: "Tuesday", short: "Tue" },
    { value: 4, label: "Wednesday", short: "Wed" },
    { value: 5, label: "Thursday", short: "Thu" },
    { value: 6, label: "Friday", short: "Fri" },
    { value: 7, label: "Saturday", short: "Sat" },
    { value: 1, label: "Sunday", short: "Sun" },
  ];

  const [workoutIdx, setWorkoutIdx] = useState(initialWorkoutIdx);
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>(EXERCISES);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragLibraryExercise, setDragLibraryExercise] = useState<Exercise | null>(null);
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
  const [dropTargetSection, setDropTargetSection] = useState<number | null>(null);
  const [dropExerciseTarget, setDropExerciseTarget] = useState<{
    sectionIdx: number;
    insertIndex: number;
    anchorIndex: number;
    position: "before" | "after";
  } | null>(null);
  const [dropTailSection, setDropTailSection] = useState<number | null>(null);
  const [showExMenu, setShowExMenu] = useState<number | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [isExEditorOpen, setIsExEditorOpen] = useState(false);

  const phase = program.phases[phaseIdx];
  const workout = phase?.workouts[workoutIdx];

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    fetchExercises()
      .then((rows) => {
        if (rows.length > 0) {
          setExerciseLibrary(rows);
        }
      })
      .catch((error) => {
        console.error("[SessionBuilder] Failed to fetch exercise library:", error);
      });
  }, []);

  // ─── Mutation helpers ───

  const updateWorkout = (fn: (wk: PhaseWorkoutWithSections) => void) => {
    onProgramChange((p) => {
      fn(p.phases[phaseIdx].workouts[workoutIdx]);
    });
  };

  const SET_PROPAGATE_FIELDS = [
    "weight", "min_reps", "max_reps", "rpe", "rest_seconds",
    "calories", "distance", "duration", "pct_1rm",
  ];

  const resetExerciseDragState = () => {
    setDragIdx(null);
    setDragLibraryExercise(null);
    setDropExerciseTarget(null);
    setDropTailSection(null);
  };

  const buildWorkoutExercise = (
    wk: PhaseWorkoutWithSections,
    ex: Exercise,
    sectionIndex: number
  ): WorkoutExerciseWithSets => {
    const nextExerciseId =
      wk.exercises.reduce((max, cur) => Math.max(max, Number(cur.id) || 0), 0) + 1;
    const nextSetId =
      wk.exercises.reduce(
        (max, cur) =>
          Math.max(
            max,
            ...cur.set_data.map((s) => Number(s.id) || 0)
          ),
        0
      ) + 1;

    return {
      id: nextExerciseId,
      workout_id: wk.id,
      section_id: null,
      exercise_id: ex.id,
      name: ex.name,
      muscle_group: ex.primary_muscle_group,
      sets: 3,
      weight: 0,
      min_reps: ex.default_reps_min || 8,
      max_reps: ex.default_reps_max || 12,
      rest_seconds: ex.default_rest_seconds,
      notes: ex.default_note || "",
      sort_order: wk.exercises.length,
      expanded: false,
      tracking_type: "Weight/Reps/RPE" as SetType,
      alternate_exercise_ids: [],
      section_index: sectionIndex,
      set_data: Array.from({ length: 3 }, (_, i) => ({
        id: nextSetId + i,
        set_number: i + 1,
        weight: 0,
        min_reps: ex.default_reps_min || 8,
        max_reps: ex.default_reps_max || 12,
        rest_seconds: ex.default_rest_seconds,
        done: false,
      })),
    };
  };

  const insertExerciseAt = (ex: Exercise, toIndex: number, sectionIndex: number) => {
    updateWorkout((wk) => {
      const insertAt = Math.max(0, Math.min(toIndex, wk.exercises.length));
      wk.exercises.splice(insertAt, 0, buildWorkoutExercise(wk, ex, sectionIndex));
    });
  };

  const addExercise = (ex: Exercise) => {
    const defaultSection = workout?.workout_sections.length ? 0 : -1;
    const insertAt = workout?.exercises.length ?? 0;
    insertExerciseAt(ex, insertAt, defaultSection);
  };

  const addFreeText = (sectionIndex: number) => {
    updateWorkout((wk) => {
      wk.exercises.push({
        id: Date.now(),
        workout_id: wk.id,
        section_id: null,
        exercise_id: null,
        name: "Whiteboard",
        muscle_group: "",
        sets: 0,
        weight: 0,
        min_reps: 0,
        max_reps: 0,
        rest_seconds: 0,
        notes: "",
        sort_order: wk.exercises.length,
        expanded: false,
        tracking_type: "Free Text" as SetType,
        alternate_exercise_ids: [],
        section_index: sectionIndex,
        set_data: [],
      });
    });
  };

  const removeExercise = (idx: number) => {
    updateWorkout((wk) => {
      wk.exercises.splice(idx, 1);
    });
    setShowExMenu(null);
  };

  const changeTrackingType = (idx: number, newType: SetType) => {
    updateWorkout((wk) => {
      const ex = wk.exercises[idx];
      ex.tracking_type = newType;
      const cols = SET_TYPE_OPTIONS[newType].columns;
      for (const s of ex.set_data) {
        for (const col of cols) {
          if (s[col.key] === undefined) {
            s[col.key] = col.type === "num" ? 0 : "";
          }
        }
      }
    });
    setShowExMenu(null);
  };

  const updateExField = (idx: number, field: string, value: number | string) => {
    updateWorkout((wk) => {
      const ex = wk.exercises[idx] as unknown as Record<string, unknown>;
      ex[field] = value;
      if (SET_PROPAGATE_FIELDS.includes(field)) {
        for (const s of wk.exercises[idx].set_data) {
          (s as Record<string, unknown>)[field] = value;
        }
      }
      if (field === "sets") {
        const numSets = value as number;
        const cur = wk.exercises[idx].set_data.length;
        if (numSets > cur) {
          const exRef = wk.exercises[idx];
          const lastSet = exRef.set_data[exRef.set_data.length - 1];
          const cols = SET_TYPE_OPTIONS[exRef.tracking_type as SetType]?.columns ?? [];
          for (let i = 0; i < numSets - cur; i++) {
            const newSet: SetData = {
              id: Date.now() + i,
              set_number: cur + i + 1,
              weight: exRef.weight,
              min_reps: exRef.min_reps,
              max_reps: exRef.max_reps,
              rest_seconds: exRef.rest_seconds,
              done: false,
            };
            for (const col of cols) {
              if (newSet[col.key] === undefined) {
                newSet[col.key] = lastSet?.[col.key] ?? (col.type === "num" ? 0 : "");
              }
            }
            exRef.set_data.push(newSet);
          }
        } else {
          wk.exercises[idx].set_data = wk.exercises[idx].set_data.slice(0, numSets);
        }
      }
    });
  };

  const updateSet = (exIdx: number, setIdx: number, field: string, value: number | string) => {
    updateWorkout((wk) => {
      (wk.exercises[exIdx].set_data[setIdx] as Record<string, unknown>)[field] = value;
    });
  };

  const moveExercise = (from: number, to: number, targetSectionIdx?: number) => {
    if (from === to && targetSectionIdx === undefined) return;
    updateWorkout((wk) => {
      const ex = wk.exercises.splice(from, 1)[0];
      if (targetSectionIdx !== undefined) {
        ex.section_index = targetSectionIdx;
      }
      const adjustedTo = to > from ? to - 1 : to;
      wk.exercises.splice(Math.min(adjustedTo, wk.exercises.length), 0, ex);
    });
  };

  const moveSection = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    updateWorkout((wk) => {
      const [sec] = wk.workout_sections.splice(fromIdx, 1);
      wk.workout_sections.splice(toIdx, 0, sec);
      for (const ex of wk.exercises) {
        if (ex.section_index === fromIdx) {
          ex.section_index = toIdx;
        } else if (fromIdx < toIdx && ex.section_index > fromIdx && ex.section_index <= toIdx) {
          ex.section_index--;
        } else if (fromIdx > toIdx && ex.section_index >= toIdx && ex.section_index < fromIdx) {
          ex.section_index++;
        }
      }
    });
  };

  const addSection = () => {
    updateWorkout((wk) => {
      wk.workout_sections.push({
        id: Date.now(),
        workout_id: wk.id,
        name: "New Section",
        notes: "",
        sort_order: wk.workout_sections.length,
      });
    });
  };

  const addWorkout = () => {
    const currentLen = phase ? phase.workouts.length : 0;
    onProgramChange((p) => {
      const ph = p.phases[phaseIdx];
      ph.workouts.push({
        id: Date.now(),
        phase_id: ph.id,
        name: "Workout " + (ph.workouts.length + 1),
        sort_order: ph.workouts.length,
        scheduled_weekday: null,
        workout_sections: [{ id: Date.now() + 1, workout_id: 0, name: "Main", notes: "", sort_order: 0 }],
        exercises: [],
      });
    });
    setWorkoutIdx(currentLen);
  };

  const openExerciseEditor = (exerciseName: string) => {
    const q = exerciseName.toLowerCase();
    let ex = exerciseLibrary.find((e) => e.name.toLowerCase() === q);
    if (!ex) ex = exerciseLibrary.find((e) => e.name.toLowerCase().includes(q));
    if (!ex) ex = exerciseLibrary.find((e) => q.includes(e.name.toLowerCase()));
    if (ex) {
      setEditingExercise(ex);
      setIsExEditorOpen(true);
    }
  };

  // ─── Render exercise row (shared between sectioned and unsectioned) ───

  const renderExerciseRow = (ex: WorkoutExerciseWithSets, origIdx: number, sectionIdx: number) => {
    const isFreeText = ex.tracking_type === "Free Text";
    const trackingCols =
      SET_TYPE_OPTIONS[ex.tracking_type]?.columns || SET_TYPE_OPTIONS["Weight/Reps/RPE"].columns;
    const gridCols = `32px 1fr 48px ${trackingCols.map(() => "56px").join(" ")} 56px ${editing ? "32px" : ""}`;
    const isDropAnchorBefore =
      dropExerciseTarget?.sectionIdx === sectionIdx &&
      dropExerciseTarget.anchorIndex === origIdx &&
      dropExerciseTarget.position === "before";
    const isDropAnchorAfter =
      dropExerciseTarget?.sectionIdx === sectionIdx &&
      dropExerciseTarget.anchorIndex === origIdx &&
      dropExerciseTarget.position === "after";
    const isExerciseDragActive = dragIdx !== null || dragLibraryExercise !== null;

    return (
      <div
        key={ex.id}
        draggable={editing}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData("text/plain", String(origIdx));
          setDragIdx(origIdx);
          setDragSectionIdx(null);
          setDropTailSection(null);
          setDropExerciseTarget(null);
        }}
        onDragOver={(e) => {
          if (!editing || !isExerciseDragActive) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
          const insertIndex = position === "before" ? origIdx : origIdx + 1;
          setDropTailSection(null);
          setDropExerciseTarget({
            sectionIdx,
            insertIndex,
            anchorIndex: origIdx,
            position,
          });
        }}
        onDragLeave={(e) => {
          if ((e.currentTarget as HTMLDivElement).contains(e.relatedTarget as Node)) return;
          if (
            dropExerciseTarget?.sectionIdx === sectionIdx &&
            dropExerciseTarget.anchorIndex === origIdx
          ) {
            setDropExerciseTarget(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const insertIndex =
            dropExerciseTarget?.sectionIdx === sectionIdx &&
            dropExerciseTarget.anchorIndex === origIdx
              ? dropExerciseTarget.insertIndex
              : origIdx;

          if (dragIdx !== null) {
            moveExercise(dragIdx, insertIndex, sectionIdx);
          } else if (dragLibraryExercise) {
            insertExerciseAt(dragLibraryExercise, insertIndex, sectionIdx);
          }
          resetExerciseDragState();
        }}
        onDragEnd={resetExerciseDragState}
        className={`relative rounded-xl mb-1 border transition-all ${
          dragIdx === origIdx
            ? "bg-accent/[0.06] border-accent/30 opacity-70"
            : "bg-black/[0.015] border-black/[0.04]"
        } ${isDropAnchorBefore ? "translate-y-1" : ""} ${isDropAnchorAfter ? "-translate-y-1" : ""}`}
      >
        {isDropAnchorBefore && (
          <div className="absolute -top-1 left-2 right-2 h-2 rounded bg-accent/20 border border-accent/40 pointer-events-none" />
        )}
        {isDropAnchorAfter && (
          <div className="absolute -bottom-1 left-2 right-2 h-2 rounded bg-accent/20 border border-accent/40 pointer-events-none" />
        )}

        {/* ─── Free Text layout ─── */}
        {isFreeText ? (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {editing && (
                  <span className="cursor-grab text-muted">
                    <GripVertical size={14} />
                  </span>
                )}
                <span className="text-sm font-semibold">{ex.name}</span>
                <span className="text-[10px] text-muted bg-black/5 px-2 py-0.5 rounded-full">Free Text</span>
              </div>
              {editing && (
                <div className="relative">
                  <button
                    onClick={() => setShowExMenu(showExMenu === origIdx ? null : origIdx)}
                    className="p-1 text-muted hover:text-foreground rounded transition-colors"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {showExMenu === origIdx && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowExMenu(null)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/10 rounded-lg shadow-lg w-56 py-1 overflow-hidden">
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">
                          Change Set Type
                        </div>
                        {Object.entries(SET_TYPE_OPTIONS).map(([key, val]) => (
                          <button
                            key={key}
                            onClick={() => changeTrackingType(origIdx, key as SetType)}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 transition-colors flex items-center justify-between ${
                              ex.tracking_type === key ? "text-accent font-semibold" : "text-foreground"
                            }`}
                          >
                            {val.label}
                            {ex.tracking_type === key && <span className="text-accent">&#10003;</span>}
                          </button>
                        ))}
                        <div className="border-t border-black/5 my-1" />
                        <button
                          onClick={() => removeExercise(origIdx)}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-red-50 text-red-600 transition-colors"
                        >
                          Delete Exercise
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {editing ? (
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm outline-none focus:border-accent/50 resize-y min-h-[80px]"
                placeholder="Enter workout instructions (e.g. 5 Rounds for Time: 10 Power Cleans, 15 Box Jumps...)"
                rows={4}
                value={ex.notes || ""}
                onChange={(e) => updateExField(origIdx, "notes", e.target.value)}
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap bg-black/[0.02] rounded-lg px-3 py-2">
                {ex.notes || <span className="text-muted italic">No instructions</span>}
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Per-exercise column header */}
        <div
          className="grid gap-1 px-2 pt-2 pb-1 items-center"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span />
          <span className="text-[10px] font-semibold text-muted uppercase">Exercise</span>
          <span className="text-[10px] font-semibold text-muted uppercase text-center">Sets</span>
          {trackingCols.map((col) => (
            <span key={col.key} className="text-[10px] font-semibold text-muted uppercase text-center">
              {col.label}
            </span>
          ))}
          <span className="text-[10px] font-semibold text-muted uppercase text-center">Rest</span>
          {editing && <span />}
        </div>

        {/* Exercise Row */}
        <div
          className="grid gap-1 px-2 py-2 items-center"
          style={{ gridTemplateColumns: gridCols }}
        >
          <button
            onClick={() => {
              updateWorkout((wk) => {
                wk.exercises[origIdx].expanded = !wk.exercises[origIdx].expanded;
              });
            }}
            className="p-1 text-muted hover:text-foreground transition-transform"
            style={{ transform: ex.expanded ? "rotate(90deg)" : "rotate(0)" }}
          >
            <Play size={12} />
          </button>

          <div className="flex items-center gap-2">
            {editing && (
              <span className="cursor-grab text-muted">
                <GripVertical size={14} />
              </span>
            )}
            <div>
              <button
                onClick={() => openExerciseEditor(ex.name)}
                className="text-sm font-semibold hover:text-accent transition-colors text-left"
                title="Click to edit exercise details"
              >
                {ex.name}
              </button>
              <div className="text-[10px] text-muted">{ex.muscle_group}</div>
            </div>
          </div>

          {/* Sets */}
          {editing ? (
            <input
              type="number"
              className="w-full px-1 py-1.5 rounded bg-black/5 border border-black/10 text-xs text-center outline-none focus:border-accent/50"
              value={ex.sets}
              min={1}
              onChange={(e) => {
                const newSets = Math.max(1, parseInt(e.target.value) || 1);
                updateExField(origIdx, "sets", newSets);
              }}
            />
          ) : (
            <span className="text-sm text-center">{ex.sets}</span>
          )}

          {/* Dynamic columns */}
          {trackingCols.map((col) => {
            const value =
              (ex as unknown as Record<string, unknown>)[col.key] ?? (col.type === "num" ? 0 : "");
            return editing ? (
              <input
                key={col.key}
                type={col.type === "num" ? "number" : "text"}
                className="w-full px-1 py-1.5 rounded bg-black/5 border border-black/10 text-xs text-center outline-none focus:border-accent/50"
                value={String(value)}
                onChange={(e) =>
                  updateExField(
                    origIdx,
                    col.key,
                    col.type === "num" ? parseFloat(e.target.value) || 0 : e.target.value
                  )
                }
              />
            ) : (
              <span key={col.key} className="text-sm text-center">
                {String(value)}
              </span>
            );
          })}

          {/* Rest */}
          {editing ? (
            <input
              type="number"
              className="w-full px-1 py-1.5 rounded bg-black/5 border border-black/10 text-xs text-center outline-none focus:border-accent/50"
              value={ex.rest_seconds}
              onChange={(e) =>
                updateExField(origIdx, "rest_seconds", parseInt(e.target.value) || 0)
              }
            />
          ) : (
            <span className="text-sm text-center">{ex.rest_seconds}</span>
          )}

          {/* Context Menu */}
          {editing && (
            <div className="relative">
              <button
                onClick={() => setShowExMenu(showExMenu === origIdx ? null : origIdx)}
                className="p-1 text-muted hover:text-foreground rounded transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>
              {showExMenu === origIdx && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExMenu(null)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/10 rounded-lg shadow-lg w-56 py-1 overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">
                      Change Set Type
                    </div>
                    {Object.entries(SET_TYPE_OPTIONS).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => changeTrackingType(origIdx, key as SetType)}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 transition-colors flex items-center justify-between ${
                          ex.tracking_type === key ? "text-accent font-semibold" : "text-foreground"
                        }`}
                      >
                        {val.label}
                        {ex.tracking_type === key && <span className="text-accent">&#10003;</span>}
                      </button>
                    ))}
                    <div className="border-t border-black/5 my-1" />
                    <button
                      onClick={() => {
                        setShowExMenu(null);
                        openExerciseEditor(ex.name);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-black/5 transition-colors text-foreground"
                    >
                      Add Alternatives
                    </button>
                    <div className="border-t border-black/5 my-1" />
                    <button
                      onClick={() => removeExercise(origIdx)}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-red-50 text-red-600 transition-colors"
                    >
                      Delete Exercise
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        {editing && (
          <div className="px-3 pb-2">
            <input
              className="w-full px-2 py-1.5 rounded bg-black/5 border border-black/10 text-xs outline-none focus:border-accent/50"
              placeholder="Add note for this exercise..."
              value={ex.notes || ""}
              onChange={(e) => updateExField(origIdx, "notes", e.target.value)}
            />
          </div>
        )}

        {/* Expanded Set Detail */}
        {ex.expanded && (
          <div className="border-t border-border-accent px-3 py-2 bg-black/[0.01]">
            {ex.set_data.map((s, setI) => (
              <div
                key={s.id}
                className="grid gap-1 py-1.5 items-center border-t border-black/[0.03] first:border-t-0"
                style={{
                  gridTemplateColumns: `32px 1fr 48px ${trackingCols.map(() => "56px").join(" ")} 56px`,
                }}
              >
                <span className="text-xs font-bold text-muted text-center">{setI + 1}</span>
                <span />
                <span />
                {trackingCols.map((col) => {
                  const val = s[col.key] ?? (col.type === "num" ? 0 : "");
                  return editing ? (
                    <input
                      key={col.key}
                      type={col.type === "num" ? "number" : "text"}
                      className="w-full px-1 py-1 rounded bg-black/5 border border-black/10 text-xs text-center outline-none focus:border-accent/50"
                      value={String(val)}
                      onChange={(e) =>
                        updateSet(
                          origIdx,
                          setI,
                          col.key,
                          col.type === "num" ? parseFloat(e.target.value) || 0 : e.target.value
                        )
                      }
                    />
                  ) : (
                    <span key={col.key} className="text-xs text-center">
                      {String(val)}
                    </span>
                  );
                })}
                {editing ? (
                  <input
                    type="number"
                    className="w-full px-1 py-1 rounded bg-black/5 border border-black/10 text-xs text-center outline-none focus:border-accent/50"
                    value={s.rest_seconds}
                    onChange={(e) =>
                      updateSet(origIdx, setI, "rest_seconds", parseInt(e.target.value) || 0)
                    }
                  />
                ) : (
                  <span className="text-xs text-center">{s.rest_seconds}</span>
                )}
              </div>
            ))}
            {editing && (
              <button
                onClick={() => {
                  updateWorkout((wk) => {
                    const exr = wk.exercises[origIdx];
                    exr.sets++;
                    const lastSet = exr.set_data[exr.set_data.length - 1];
                    const newSet: SetData = {
                      id: Date.now(),
                      set_number: exr.set_data.length + 1,
                      weight: exr.weight,
                      min_reps: exr.min_reps,
                      max_reps: exr.max_reps,
                      rest_seconds: exr.rest_seconds,
                      done: false,
                    };
                    // Copy tracking type columns from the last set
                    const cols = SET_TYPE_OPTIONS[exr.tracking_type as SetType]?.columns ?? [];
                    for (const col of cols) {
                      if (newSet[col.key] === undefined) {
                        newSet[col.key] = lastSet?.[col.key] ?? (col.type === "num" ? 0 : "");
                      }
                    }
                    exr.set_data.push(newSet);
                  });
                }}
                className="w-full mt-2 px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-xs text-muted hover:text-foreground transition-colors"
              >
                + Add Set
              </button>
            )}
          </div>
        )}
        </>
        )}
      </div>
    );
  };

  // ─── Main Render ───

  return (
    <div className="flex w-full h-full">
      {/* Exercise Library Sidebar */}
      <ExerciseLibrarySidebar
        exercises={exerciseLibrary}
        editing={editing}
        onAddExercise={addExercise}
        onOpenExerciseEditor={openExerciseEditor}
        onExerciseDragStart={(exercise) => {
          if (!editing) return;
          setDragLibraryExercise(exercise);
          setDragSectionIdx(null);
          setDropTargetSection(null);
          setDropExerciseTarget(null);
          setDropTailSection(null);
        }}
        onExerciseDragEnd={resetExerciseDragState}
      />

      {/* Main Builder Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Builder Top Bar — dark */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3 shrink-0 bg-gradient-to-r from-[#111111] to-[#1e1e1e]">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Back
          </button>
          <h2 className="text-base font-bold text-white">
            {program.name} &mdash; {phase?.name}
          </h2>
          <div className="flex-1" />
          <button
            onClick={() => onEditingChange(!editing)}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
          >
            {editing ? "Save" : "Edit"}
          </button>
        </div>

        {/* Workout Tabs — dark */}
        <div className="px-5 py-2 border-b border-white/10 flex gap-1.5 items-center overflow-x-auto shrink-0 bg-[#1a1a1a]">
          {phase?.workouts.map((w, i) => (
            <button
              key={w.id}
              onClick={() => setWorkoutIdx(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                workoutIdx === i
                  ? "bg-accent/20 text-accent"
                  : "bg-white/8 text-white/50 hover:text-white"
              }`}
            >
              <div className="flex flex-col items-center gap-0.5">
                {editing ? (
                  <input
                    className="bg-transparent border-none text-center outline-none font-semibold text-white"
                    style={{ width: Math.max(60, w.name.length * 8) }}
                    value={w.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      onProgramChange((p) => {
                        p.phases[phaseIdx].workouts[i].name = e.target.value;
                      });
                    }}
                  />
                ) : (
                  <span>{w.name}</span>
                )}
                {typeof w.scheduled_weekday === "number" && (
                  <span className="text-[10px] opacity-80">
                    {WEEKDAY_OPTIONS.find((opt) => opt.value === w.scheduled_weekday)?.short ?? "Day"}
                  </span>
                )}
              </div>
            </button>
          ))}
          {editing && (
            <button
              onClick={addWorkout}
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-success hover:bg-success/15 transition-colors"
            >
              <Plus size={18} />
            </button>
          )}
        </div>

        {/* Workout Content — Exercises nested inside Sections */}
        <div className="flex-1 overflow-y-auto p-5">
          {workout ? (
            <div>
              <div className="mb-4 flex items-center gap-3 px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Ideal Day
                </span>
                {editing ? (
                  <select
                    value={workout.scheduled_weekday ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onProgramChange((p) => {
                        p.phases[phaseIdx].workouts[workoutIdx].scheduled_weekday = raw ? Number(raw) : null;
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm outline-none focus:border-accent/50"
                  >
                    <option value="">Not set</option>
                    {WEEKDAY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-foreground">
                    {WEEKDAY_OPTIONS.find((opt) => opt.value === workout.scheduled_weekday)?.label ?? "Not set"}
                  </span>
                )}
              </div>

              {workout.workout_sections.map((sec, si) => {
                const sectionExercises = workout.exercises
                  .map((ex, origIdx) => ({ ex, origIdx }))
                  .filter(({ ex }) => ex.section_index === si);

                return (
                  <div
                    key={sec.id}
                    className={`rounded-xl mb-4 border transition-colors ${
                      dragSectionIdx === si
                        ? "bg-accent/[0.06] border-accent/30"
                        : dropTargetSection === si
                        ? "bg-accent/[0.04] border-accent/20"
                        : "bg-black/[0.02] border-black/[0.04]"
                    }`}
                    draggable={editing && dragIdx === null && dragLibraryExercise === null}
                    onDragStart={(e) => {
                      if (dragIdx !== null || dragLibraryExercise !== null) return;
                      setDragSectionIdx(si);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (dragIdx !== null || dragLibraryExercise !== null) return;
                      e.preventDefault();
                      if (dragSectionIdx !== null && dragSectionIdx !== si) {
                        setDropTargetSection(si);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragSectionIdx !== null) setDropTargetSection(null);
                    }}
                    onDrop={() => {
                      if (dragIdx !== null || dragLibraryExercise !== null) return;
                      if (dragSectionIdx !== null && dragSectionIdx !== si) {
                        moveSection(dragSectionIdx, si);
                      }
                      setDragSectionIdx(null);
                      setDropTargetSection(null);
                    }}
                    onDragEnd={() => {
                      setDragSectionIdx(null);
                      setDropTargetSection(null);
                    }}
                  >
                    {/* Section Header */}
                    <div className="p-3 pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        {editing && (
                          <span className="cursor-grab text-muted">
                            <GripVertical size={14} />
                          </span>
                        )}
                        <ListIcon size={14} className="text-accent" />
                        {editing ? (
                          <input
                            className="flex-1 px-2 py-1 rounded bg-black/5 border border-black/10 text-sm font-bold outline-none focus:border-accent/50"
                            value={sec.name}
                            onChange={(e) => {
                              onProgramChange((p) => {
                                p.phases[phaseIdx].workouts[workoutIdx].workout_sections[si].name =
                                  e.target.value;
                              });
                            }}
                          />
                        ) : (
                          <span className="text-sm font-bold">{sec.name}</span>
                        )}
                      </div>
                      {/* Section Notes */}
                      {editing ? (
                        <textarea
                          className="w-full px-2 py-1.5 rounded bg-black/5 border border-black/10 text-xs outline-none focus:border-accent/50 resize-none mb-2"
                          placeholder="Section notes..."
                          rows={2}
                          value={sec.notes || ""}
                          onChange={(e) => {
                            onProgramChange((p) => {
                              p.phases[phaseIdx].workouts[workoutIdx].workout_sections[si].notes =
                                e.target.value;
                            });
                          }}
                        />
                      ) : (
                        sec.notes && (
                          <p className="text-xs text-muted mb-2 pl-6">{sec.notes}</p>
                        )
                      )}
                    </div>

                    {/* Exercises inside this section */}
                    <div className="px-3 pb-3">
                      {sectionExercises.map(({ ex, origIdx }) =>
                        renderExerciseRow(ex, origIdx, si)
                      )}

                      {/* End-of-section drop zone (higher tolerance + clear slot) */}
                      {editing && sectionExercises.length > 0 && (
                        <div
                          className={`mt-1 h-8 rounded-lg border-2 border-dashed transition-colors ${
                            dropTailSection === si
                              ? "border-accent/50 bg-accent/[0.08]"
                              : "border-black/10 bg-transparent"
                          }`}
                          onDragOver={(e) => {
                            if (dragIdx === null && dragLibraryExercise === null) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setDropExerciseTarget(null);
                            setDropTailSection(si);
                          }}
                          onDragLeave={() => {
                            if (dropTailSection === si) setDropTailSection(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const insertIndex =
                              sectionExercises[sectionExercises.length - 1].origIdx + 1;
                            if (dragIdx !== null) {
                              moveExercise(dragIdx, insertIndex, si);
                            } else if (dragLibraryExercise) {
                              insertExerciseAt(dragLibraryExercise, insertIndex, si);
                            }
                            resetExerciseDragState();
                          }}
                        />
                      )}

                      {/* Empty section drop zone */}
                      {sectionExercises.length === 0 && (
                        <div
                          className={`py-6 border-2 border-dashed rounded-xl text-center text-xs text-muted transition-colors ${
                            dragIdx !== null || dragLibraryExercise !== null
                              ? "border-accent/30 bg-accent/[0.03]"
                              : "border-black/10"
                          }`}
                          onDragOver={(e) => {
                            if (dragIdx === null && dragLibraryExercise === null) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setDropExerciseTarget(null);
                            setDropTailSection(si);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragIdx !== null) {
                              moveExercise(dragIdx, workout.exercises.length, si);
                            } else if (dragLibraryExercise) {
                              insertExerciseAt(dragLibraryExercise, workout.exercises.length, si);
                            }
                            resetExerciseDragState();
                          }}
                        >
                          {editing
                            ? "Drop exercises here or add from the library"
                            : "No exercises in this section"}
                        </div>
                      )}

                      {/* Add Free Text button */}
                      {editing && (
                        <button
                          onClick={() => addFreeText(si)}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-dashed border-black/10 text-xs text-muted hover:text-foreground hover:border-accent/30 hover:bg-accent/[0.03] transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span className="text-base leading-none">+</span> Add Free Text
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Unsectioned exercises (section_index === -1) */}
              {(() => {
                const unsectioned = workout.exercises
                  .map((ex, origIdx) => ({ ex, origIdx }))
                  .filter(({ ex }) => ex.section_index === -1);
                if (unsectioned.length === 0) return null;
                return (
                  <div className="mb-4">
                    {unsectioned.map(({ ex, origIdx }) => renderExerciseRow(ex, origIdx, -1))}
                  </div>
                );
              })()}

              {editing && (
                <button
                  onClick={addSection}
                  className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-xs text-muted hover:text-foreground transition-colors mb-4"
                >
                  + Add Section
                </button>
              )}

              {/* Empty State */}
              {workout.exercises.length === 0 && workout.workout_sections.length === 0 && (
                <div className="py-10 text-center">
                  <Dumbbell size={40} className="mx-auto text-muted mb-3" />
                  <p className="text-muted">
                    Click <span className="text-success font-semibold">+</span> on exercises in the
                    library to add them
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-muted">Add a workout day to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Exercise Editor Modal */}
      {isExEditorOpen && (
        <ExerciseEditorModal
          exercise={editingExercise}
          allExercises={exerciseLibrary}
          onSave={() => {
            setIsExEditorOpen(false);
            setEditingExercise(null);
          }}
          onClose={() => {
            setIsExEditorOpen(false);
            setEditingExercise(null);
          }}
        />
      )}
    </div>
  );
}
