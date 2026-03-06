"use client";

import { useState } from "react";
import { X, Play, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import {
  Exercise,
  MODALITY_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
  MOVEMENT_PATTERN_OPTIONS,
  TRACKING_FIELD_OPTIONS,
} from "@/lib/types";
import { normalizeYouTubeUrl, youtubeThumbnailUrl } from "@/lib/youtube";

interface ExerciseEditorModalProps {
  exercise: Exercise | null;
  allExercises: Exercise[];
  onSave: (exercise: Exercise) => void;
  onClose: () => void;
}

export function ExerciseEditorModal({
  exercise,
  allExercises,
  onSave,
  onClose,
}: ExerciseEditorModalProps) {
  const [form, setForm] = useState<Exercise>(
    exercise || {
      id: 0,
      coach_id: null,
      name: "",
      primary_muscle_group: "",
      muscle_groups: [],
      modality: "Strength",
      movement_patterns: [],
      video_url: null,
      thumbnail_url: null,
      instructions: null,
      default_note: null,
      default_reps_min: 6,
      default_reps_max: 15,
      default_rpe: 8,
      default_rest_seconds: 90,
      default_tracking_fields: ["Reps", "Weight", "RPE"],
      alternate_exercise_ids: [],
      is_global: false,
      created_at: new Date().toISOString(),
    }
  );

  const [alternateSearch, setAlternateSearch] = useState("");

  function handleVideoUrlChange(url: string) {
    const normalizedUrl = normalizeYouTubeUrl(url);
    const thumbnail = youtubeThumbnailUrl(normalizedUrl) || form.thumbnail_url;
    setForm({ ...form, video_url: normalizedUrl, thumbnail_url: thumbnail });
  }

  function toggleMuscleGroup(group: string) {
    const current = form.muscle_groups;
    if (current.includes(group)) {
      setForm({ ...form, muscle_groups: current.filter((g) => g !== group) });
    } else if (current.length < 3) {
      setForm({ ...form, muscle_groups: [...current, group] });
    }
  }

  function toggleMovementPattern(pattern: string) {
    const current = form.movement_patterns;
    if (current.includes(pattern)) {
      setForm({
        ...form,
        movement_patterns: current.filter((p) => p !== pattern),
      });
    } else {
      setForm({ ...form, movement_patterns: [...current, pattern] });
    }
  }

  function toggleTrackingField(field: string) {
    const current = form.default_tracking_fields;
    if (current.includes(field)) {
      setForm({
        ...form,
        default_tracking_fields: current.filter((f) => f !== field),
      });
    } else if (current.length < 3) {
      setForm({
        ...form,
        default_tracking_fields: [...current, field],
      });
    }
  }

  function addAlternateExercise(id: number) {
    if (!form.alternate_exercise_ids.includes(id)) {
      setForm({
        ...form,
        alternate_exercise_ids: [...form.alternate_exercise_ids, id],
      });
    }
    setAlternateSearch("");
  }

  function removeAlternateExercise(id: number) {
    setForm({
      ...form,
      alternate_exercise_ids: form.alternate_exercise_ids.filter(
        (eid) => eid !== id
      ),
    });
  }

  const alternateResults = alternateSearch.length > 1
    ? allExercises
        .filter(
          (ex) =>
            ex.id !== form.id &&
            !form.alternate_exercise_ids.includes(ex.id) &&
            ex.name.toLowerCase().includes(alternateSearch.toLowerCase())
        )
        .slice(0, 5)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full overflow-y-auto bg-white border-l border-border-accent shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-white/95 backdrop-blur-sm border-b border-border-accent">
          <h2 className="text-lg font-semibold">
            {exercise ? "Edit Exercise" : "New Exercise"}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSave(form)}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)]"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* 1. Naming & Searchability */}
          <section>
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
              Naming & Searchability
            </h3>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Exercise Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='e.g. "Barbell Bench Press"'
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
              />
              <p className="text-xs text-muted mt-1">
                Supports partial search — searching &quot;Bench&quot; will find &quot;Barbell Bench Press&quot;
              </p>
            </div>
          </section>

          {/* 2. Categorisation */}
          <section>
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
              Categorisation
            </h3>

            {/* Modality */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-muted mb-2">
                Modality
              </label>
              <div className="flex flex-wrap gap-2">
                {MODALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() =>
                      setForm({ ...form, modality: opt as Exercise["modality"] })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.modality === opt
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : "bg-black/5 text-muted border border-black/8 hover:border-black/20"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Muscle Groups */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-muted mb-2">
                Muscle Groups{" "}
                <span className="text-xs text-muted/60">
                  (max 3 — {form.muscle_groups.length}/3 selected)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleMuscleGroup(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.muscle_groups.includes(opt)
                        ? "bg-success/20 text-success border border-success/30"
                        : form.muscle_groups.length >= 3
                        ? "bg-black/3 text-muted/40 border border-black/5 cursor-not-allowed"
                        : "bg-black/5 text-muted border border-black/8 hover:border-black/20"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Movement Patterns */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Movement Pattern
              </label>
              <div className="flex flex-wrap gap-2">
                {MOVEMENT_PATTERN_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleMovementPattern(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.movement_patterns.includes(opt)
                        ? "bg-warning/20 text-warning border border-warning/30"
                        : "bg-black/5 text-muted border border-black/8 hover:border-black/20"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Media Assets */}
          <section>
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
              Media Assets
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-muted mb-1.5">
                Video URL (YouTube)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.video_url || ""}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                />
                {form.video_url && (
                  <a
                    href={form.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg bg-black/5 border border-black/10 text-muted hover:text-accent"
                  >
                    <Play size={18} />
                  </a>
                )}
              </div>
            </div>

            {/* Thumbnail preview */}
            {form.thumbnail_url && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Thumbnail
                </label>
                <div className="relative w-full max-w-xs aspect-video rounded-lg overflow-hidden border border-black/10">
                  <img
                    src={form.thumbnail_url}
                    alt="Thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <button className="absolute bottom-2 right-2 px-3 py-1 rounded bg-black/70 text-xs text-white flex items-center gap-1 hover:bg-black/90">
                    <ImageIcon size={12} /> Choose custom
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 4. Instructional Content */}
          <section>
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
              Instructional Content
            </h3>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Default Note
              </label>
              <textarea
                value={form.default_note || ""}
                onChange={(e) =>
                  setForm({ ...form, default_note: e.target.value || null })
                }
                placeholder="Generic coaching cues or warnings that auto-append to this exercise..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 resize-none"
              />
            </div>
          </section>

          {/* 5. Programming & Tracking */}
          <section>
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
              Programming & Tracking
            </h3>

            {/* Default Tracking Fields */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-muted mb-2">
                Default Tracking Fields{" "}
                <span className="text-xs text-muted/60">
                  (up to 3 — {form.default_tracking_fields.length}/3 selected)
                </span>
              </label>
              <p className="text-xs text-muted/60 mb-2">
                These + Rest Time will appear when assigning this exercise to a workout. Editable inside the workout builder.
              </p>
              <div className="flex flex-wrap gap-2">
                {TRACKING_FIELD_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleTrackingField(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.default_tracking_fields.includes(opt)
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : form.default_tracking_fields.length >= 3
                        ? "bg-black/3 text-muted/40 border border-black/5 cursor-not-allowed"
                        : "bg-black/5 text-muted border border-black/8 hover:border-black/20"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="mt-2 px-3 py-1.5 rounded-lg bg-black/3 border border-black/5 text-xs text-muted/60 inline-block">
                + Rest Time (always included)
              </div>
            </div>

            {/* Default Programming Values */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Min Reps
                </label>
                <input
                  type="number"
                  value={form.default_reps_min || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      default_reps_min: parseInt(e.target.value) || null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Max Reps
                </label>
                <input
                  type="number"
                  value={form.default_reps_max || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      default_reps_max: parseInt(e.target.value) || null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Default RPE
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.default_rpe || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      default_rpe: parseFloat(e.target.value) || null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Rest (s)
                </label>
                <input
                  type="number"
                  value={form.default_rest_seconds || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      default_rest_seconds: parseInt(e.target.value) || 90,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-foreground text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>

            {/* Default Alternate Exercises */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Default Alternate Exercises
              </label>
              <div className="relative mb-2">
                <input
                  type="text"
                  value={alternateSearch}
                  onChange={(e) => setAlternateSearch(e.target.value)}
                  placeholder="Search for alternate exercises..."
                  className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                />
                {alternateResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-accent rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                    {alternateResults.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => addAlternateExercise(ex.id)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-black/5 flex items-center gap-2"
                      >
                        <Plus size={14} className="text-success" />
                        <span>{ex.name}</span>
                        <span className="text-xs text-muted ml-auto">
                          {ex.primary_muscle_group}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.alternate_exercise_ids.length > 0 && (
                <div className="space-y-1">
                  {form.alternate_exercise_ids.map((altId) => {
                    const alt = allExercises.find((e) => e.id === altId);
                    if (!alt) return null;
                    return (
                      <div
                        key={altId}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 border border-black/8"
                      >
                        <span className="text-sm flex-1">{alt.name}</span>
                        <span className="text-xs text-muted">
                          {alt.primary_muscle_group}
                        </span>
                        <button
                          onClick={() => removeAlternateExercise(altId)}
                          className="text-muted hover:text-accent"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
