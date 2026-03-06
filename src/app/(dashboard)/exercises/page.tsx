"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Plus, Grid3X3, List, X } from "lucide-react";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { ExerciseEditorModal } from "@/components/exercises/exercise-editor-modal";
import { EXERCISES } from "@/lib/exercise-data";
import {
  Exercise,
  MODALITY_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
  MOVEMENT_PATTERN_OPTIONS,
} from "@/lib/types";
import {
  isSupabaseConfigured,
  fetchExercises,
  saveExercise,
  getCoachId,
} from "@/lib/supabase/db";
import { youtubeThumbnailUrl } from "@/lib/youtube";

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>(EXERCISES);
  const [coachId, setCoachId] = useState<string | null>(null);

  // Load from Supabase on mount when configured
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    fetchExercises()
      .then((data) => {
        if (data.length > 0) setExercises(data);
      })
      .catch(console.error);
    getCoachId()
      .then((id) => setCoachId(id))
      .catch((err) => {
        console.error("[ExercisesPage] Failed to resolve coach id:", err);
      });
  }, []);
  const [search, setSearch] = useState("");
  const [filterModality, setFilterModality] = useState<string>("");
  const [filterMuscleGroup, setFilterMuscleGroup] = useState<string>("");
  const [filterMovementPattern, setFilterMovementPattern] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    let result = exercises;

    // Search: match name, muscle groups, modality, movement patterns
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (ex) =>
          ex.name.toLowerCase().includes(q) ||
          ex.muscle_groups.some((mg) => mg.toLowerCase().includes(q)) ||
          ex.modality.toLowerCase().includes(q) ||
          ex.movement_patterns.some((mp) => mp.toLowerCase().includes(q)) ||
          ex.primary_muscle_group.toLowerCase().includes(q)
      );
    }

    if (filterModality) {
      result = result.filter((ex) => ex.modality === filterModality);
    }

    if (filterMuscleGroup) {
      result = result.filter((ex) =>
        ex.muscle_groups.includes(filterMuscleGroup)
      );
    }

    if (filterMovementPattern) {
      result = result.filter((ex) =>
        ex.movement_patterns.includes(filterMovementPattern)
      );
    }

    return result;
  }, [exercises, search, filterModality, filterMuscleGroup, filterMovementPattern]);

  // Group by muscle group for display
  const grouped = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    for (const ex of filtered) {
      const key = ex.muscle_groups[0] || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(ex);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const hasActiveFilters = filterModality || filterMuscleGroup || filterMovementPattern;

  async function handleSave(updated: Exercise) {
    if (isSupabaseConfigured()) {
      try {
        const saved = await saveExercise(updated, coachId ?? "coach");
        if (updated.id === 0) {
          setExercises((prev) => [saved, ...prev]);
        } else {
          setExercises((prev) =>
            prev.map((ex) => (ex.id === saved.id ? saved : ex))
          );
        }
        setIsEditorOpen(false);
        setEditingExercise(null);
        return;
      } catch (err) {
        const details =
          err && typeof err === "object"
            ? {
                message: (err as { message?: string }).message,
                code: (err as { code?: string }).code,
                details: (err as { details?: string }).details,
                hint: (err as { hint?: string }).hint,
              }
            : { message: String(err) };
        console.error("Failed to save exercise:", details);
        return;
      }
    }

    if (updated.id === 0) {
      const maxId = exercises.length > 0 ? Math.max(...exercises.map((e) => e.id)) : 0;
      const newEx = { ...updated, id: maxId + 1 };
      setExercises((prev) => [newEx, ...prev]);
    } else {
      setExercises((prev) => prev.map((ex) => (ex.id === updated.id ? updated : ex)));
    }
    setIsEditorOpen(false);
    setEditingExercise(null);
  }

  function openEditor(exercise: Exercise | null) {
    setEditingExercise(exercise);
    setIsEditorOpen(true);
  }

  function clearFilters() {
    setFilterModality("");
    setFilterMuscleGroup("");
    setFilterMovementPattern("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">
            {filtered.length} of {exercises.length} exercises
          </p>
        </div>
        <button
          onClick={() => openEditor(null)}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
        >
          <Plus size={16} /> New Exercise
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, muscle group, modality, or movement pattern..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 rounded-lg border transition-colors flex items-center gap-2 text-sm ${
            hasActiveFilters
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-black/5 border-black/10 text-muted hover:text-foreground"
          }`}
        >
          <Filter size={16} />
          {hasActiveFilters && <span>Filtered</span>}
        </button>
        <div className="flex rounded-lg overflow-hidden border border-black/10">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2.5 ${
              viewMode === "grid" ? "bg-accent/15 text-accent" : "bg-black/5 text-muted"
            }`}
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2.5 ${
              viewMode === "list" ? "bg-accent/15 text-accent" : "bg-black/5 text-muted"
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-muted mb-1">
              Modality
            </label>
            <select
              value={filterModality}
              onChange={(e) => setFilterModality(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none"
            >
              <option value="">All</option>
              {MODALITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-muted mb-1">
              Muscle Group
            </label>
            <select
              value={filterMuscleGroup}
              onChange={(e) => setFilterMuscleGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none"
            >
              <option value="">All</option>
              {MUSCLE_GROUP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-muted mb-1">
              Movement Pattern
            </label>
            <select
              value={filterMovementPattern}
              onChange={(e) => setFilterMovementPattern(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none"
            >
              <option value="">All</option>
              {MOVEMENT_PATTERN_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-accent hover:bg-accent/10"
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* Exercise Grid */}
      {viewMode === "grid" ? (
        <div className="space-y-8">
          {grouped.map(([group, exs]) => (
            <div key={group}>
              <h3 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
                {group}
                <span className="text-xs font-normal text-muted/50">
                  ({exs.length})
                </span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {exs.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    onClick={() => openEditor(ex)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((ex) => {
            const thumbnailUrl = ex.thumbnail_url || youtubeThumbnailUrl(ex.video_url);
            return (
            <button
              key={ex.id}
              onClick={() => openEditor(ex)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-black/5 transition-colors text-left"
            >
              <div className="w-16 h-10 rounded overflow-hidden bg-surface/50 shrink-0">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[10px] text-muted">No img</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ex.name}</p>
                <p className="text-xs text-muted">
                  {ex.muscle_groups.join(" · ")}
                </p>
              </div>
              <span className="text-xs text-muted/60 shrink-0">
                {ex.modality}
              </span>
              <div className="flex gap-1 shrink-0">
                {ex.default_tracking_fields.map((tf) => (
                  <span
                    key={tf}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-black/5 text-muted/70"
                  >
                    {tf}
                  </span>
                ))}
              </div>
            </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <p className="text-muted">No exercises match your search</p>
          <button
            onClick={() => {
              setSearch("");
              clearFilters();
            }}
            className="mt-2 text-sm text-accent hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <ExerciseEditorModal
          exercise={editingExercise}
          allExercises={exercises}
          onSave={handleSave}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingExercise(null);
          }}
        />
      )}
    </div>
  );
}
