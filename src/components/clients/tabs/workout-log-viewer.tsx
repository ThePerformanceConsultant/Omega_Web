"use client";

import { useState, useEffect } from "react";
import { Dumbbell, ArrowLeft, Clock, TrendingUp, Star, Activity, Zap, Flame, Trophy, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { WorkoutLogEntry } from "@/lib/types";
import { fetchWorkoutLogs } from "@/lib/supabase/db";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          className={i < rating ? "text-warning fill-warning" : "text-black/10"}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][d.getMonth()]}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatVolume(vol: number | null): string {
  if (!vol) return "—";
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k kg`;
  return `${vol.toFixed(0)} kg`;
}

// ─── PB Detection ───
function detectPBs(entry: WorkoutLogEntry, allLogs: WorkoutLogEntry[]): Map<string, { type: string; previous: string; current: string }> {
  const pbs = new Map<string, { type: string; previous: string; current: string }>();
  const priorLogs = allLogs.filter(l => l.id !== entry.id && new Date(l.date) < new Date(entry.date));

  for (const ex of entry.exerciseLogs) {
    let bestWeight = 0;
    let bestTotalVolume = 0;

    for (const prior of priorLogs) {
      for (const priorEx of prior.exerciseLogs) {
        if (priorEx.exerciseName === ex.exerciseName) {
          for (const s of priorEx.setLogs) {
            if (s.weight > bestWeight) bestWeight = s.weight;
          }
          const vol = priorEx.setLogs.reduce((sum, s) => sum + s.weight * s.reps, 0);
          if (vol > bestTotalVolume) bestTotalVolume = vol;
        }
      }
    }

    if (bestWeight === 0 && bestTotalVolume === 0) continue;

    let currentBestWeight = 0;
    const currentTotalVolume = ex.setLogs.reduce((sum, s) => {
      if (s.weight > currentBestWeight) currentBestWeight = s.weight;
      return sum + s.weight * s.reps;
    }, 0);

    if (currentBestWeight > bestWeight) {
      pbs.set(ex.exerciseName + "_weight", {
        type: "Weight",
        previous: `${bestWeight} kg`,
        current: `${currentBestWeight} kg`,
      });
    }
    if (currentTotalVolume > bestTotalVolume) {
      pbs.set(ex.exerciseName + "_volume", {
        type: "Volume",
        previous: `${bestTotalVolume.toFixed(0)} kg`,
        current: `${currentTotalVolume.toFixed(0)} kg`,
      });
    }
  }

  return pbs;
}

function exerciseHasPB(exerciseName: string, pbs: Map<string, { type: string; previous: string; current: string }>): { type: string; previous: string; current: string }[] {
  const results: { type: string; previous: string; current: string }[] = [];
  const weightPB = pbs.get(exerciseName + "_weight");
  const volumePB = pbs.get(exerciseName + "_volume");
  if (weightPB) results.push(weightPB);
  if (volumePB) results.push(volumePB);
  return results;
}

// ─── Detail View ───
export function WorkoutLogDetail({ entry, allLogs, onBack }: { entry: WorkoutLogEntry; allLogs: WorkoutLogEntry[]; onBack: () => void }) {
  const pbs = detectPBs(entry, allLogs);
  const hasRatings =
    (entry.rating != null && entry.rating > 0) ||
    (entry.ratingEnergy != null && entry.ratingEnergy > 0) ||
    (entry.ratingPump != null && entry.ratingPump > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold truncate">{entry.workoutName}</h3>
          <p className="text-xs text-muted">{formatDate(entry.date)}</p>
        </div>
        {entry.rating != null && entry.rating > 0 && <StarRating rating={entry.rating} />}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <Clock size={16} className="mx-auto mb-1.5 text-accent" />
          <p className="text-lg font-bold">{formatDuration(entry.durationMinutes)}</p>
          <p className="text-[10px] text-muted uppercase tracking-wider">Duration</p>
        </div>
        <div className="glass-card p-4 text-center">
          <TrendingUp size={16} className="mx-auto mb-1.5 text-success" />
          <p className="text-lg font-bold">{formatVolume(entry.totalVolume)}</p>
          <p className="text-[10px] text-muted uppercase tracking-wider">Volume</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Activity size={16} className="mx-auto mb-1.5 text-warning" />
          <p className="text-lg font-bold">{entry.srpe != null && entry.srpe > 0 ? entry.srpe : "—"}</p>
          <p className="text-[10px] text-muted uppercase tracking-wider">sRPE</p>
        </div>
      </div>

      {/* Personal Bests */}
      {pbs.size > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-accent" />
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Personal Bests</p>
          </div>
          <div className="space-y-2">
            {Array.from(pbs.entries()).map(([key, pb]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{
                backgroundColor: pb.type === "Weight" ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.08)",
                borderColor: pb.type === "Weight" ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)",
              }}>
                <div className="flex items-center gap-2">
                  {pb.type === "Weight" ? (
                    <TrendingUp size={16} className="text-success" />
                  ) : (
                    <Dumbbell size={16} className="text-accent" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">{key.replace(/_weight$|_volume$/, "")}</p>
                    <p className="text-[10px] font-medium" style={{ color: pb.type === "Weight" ? "rgb(34,197,94)" : "rgb(59,130,246)" }}>
                      {pb.type} PB
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-success">{pb.current}</p>
                  <p className="text-[10px] text-muted">was {pb.previous}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Ratings */}
      {hasRatings && (
        <div className="glass-card p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Session Ratings</p>
          <div className="flex items-center gap-6">
            {entry.rating != null && entry.rating > 0 && (
              <div className="flex items-center gap-2">
                <Star size={14} className="text-warning" />
                <span className="text-sm font-medium">Overall</span>
                <StarRating rating={entry.rating} />
              </div>
            )}
            {entry.ratingEnergy != null && entry.ratingEnergy > 0 && (
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-accent" />
                <span className="text-sm font-medium">Energy</span>
                <span className="text-sm text-muted">{entry.ratingEnergy}/5</span>
              </div>
            )}
            {entry.ratingPump != null && entry.ratingPump > 0 && (
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-warning" />
                <span className="text-sm font-medium">Pump</span>
                <span className="text-sm text-muted">{entry.ratingPump}/5</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session notes */}
      {entry.notes && (
        <div className="glass-card p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Session Notes</p>
          <p className="text-sm">{entry.notes}</p>
        </div>
      )}

      {/* Exercise breakdown */}
      {entry.exerciseLogs.map((ex) => (
        <div key={ex.id} className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold">{ex.exerciseName}</h4>
              {ex.setLogs.length === 0 && (
                <span className="text-[10px] text-muted bg-black/5 px-2 py-0.5 rounded-full">Free Text</span>
              )}
              {exerciseHasPB(ex.exerciseName, pbs).map((pb) => (
                <span
                  key={pb.type}
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-white px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: pb.type === "Weight" ? "rgb(34,197,94)" : "rgb(59,130,246)" }}
                >
                  {pb.type === "Weight" ? <TrendingUp size={9} /> : <Dumbbell size={9} />}
                  {pb.type} PB
                </span>
              ))}
            </div>
            {ex.setLogs.length > 0 && (
              <span className="text-xs text-muted">
                {(() => {
                  const done = ex.setLogs.filter(s => s.completed).length;
                  const total = ex.setLogs.length;
                  return done === total
                    ? `${total} sets`
                    : <span className="text-warning">{done}/{total} sets</span>;
                })()}
              </span>
            )}
          </div>

          {/* Free text exercises — show note sources distinctly */}
          {ex.setLogs.length === 0 && (ex.summary || ex.notes) ? (
            <div className="text-sm whitespace-pre-wrap bg-black/[0.02] rounded-lg px-3 py-2 space-y-1.5">
              {ex.summary && (
                <p>
                  <span className="font-semibold">Coach note:</span> {ex.summary}
                </p>
              )}
              {ex.notes && (
                <p>
                  <span className="font-semibold">Client note:</span> {ex.notes}
                </p>
              )}
            </div>
          ) : ex.setLogs.length > 0 ? (
            <>
              {/* Set table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5">
                      <th className="text-center py-1.5 pr-2 text-[10px] text-muted font-semibold uppercase tracking-wider w-8"></th>
                      <th className="text-left py-1.5 pr-4 text-[10px] text-muted font-semibold uppercase tracking-wider">Set</th>
                      <th className="text-left py-1.5 pr-4 text-[10px] text-muted font-semibold uppercase tracking-wider">Weight</th>
                      <th className="text-left py-1.5 pr-4 text-[10px] text-muted font-semibold uppercase tracking-wider">Reps</th>
                      <th className="text-left py-1.5 text-[10px] text-muted font-semibold uppercase tracking-wider">RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.setLogs.map((s) => (
                      <tr key={s.setNumber} className={`border-b border-black/5 last:border-b-0 ${!s.completed ? "bg-red-50/50" : ""}`}>
                        <td className="py-1.5 pr-2 text-center">
                          {s.completed ? (
                            <Check size={14} className="text-success inline-block" />
                          ) : (
                            <X size={14} className="text-red-500 inline-block" />
                          )}
                        </td>
                        <td className={`py-1.5 pr-4 ${s.completed ? "text-muted" : "text-red-400"}`}>{s.setNumber}</td>
                        <td className={`py-1.5 pr-4 ${s.completed ? "font-medium" : "text-red-400"}`}>{s.completed ? (s.weight > 0 ? `${s.weight} kg` : "—") : "—"}</td>
                        <td className={`py-1.5 pr-4 ${s.completed ? "" : "text-red-400"}`}>{s.completed ? (s.reps > 0 ? s.reps : "—") : "—"}</td>
                        <td className="py-1.5">{s.completed && s.rpe != null && s.rpe > 0 ? s.rpe : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(ex.summary || ex.notes) && (
                <div className="text-xs text-muted border-t border-black/5 pt-2 space-y-1">
                  {ex.summary && (
                    <p>
                      <span className="font-semibold">Coach note:</span> {ex.summary}
                    </p>
                  )}
                  {ex.notes && (
                    <p className="italic">
                      <span className="font-semibold not-italic">Client note:</span> {ex.notes}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      ))}

      {entry.exerciseLogs.length === 0 && (
        <div className="glass-card p-6 text-center text-muted text-sm">
          No exercise data recorded for this session.
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export function WorkoutLogViewer({ clientId }: { clientId: string }) {
  const [logs, setLogs] = useState<WorkoutLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WorkoutLogEntry | null>(null);
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchWorkoutLogs(clientId);
        if (!cancelled) {
          setLogs(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch workout logs:", err);
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    setPage(0);
  }, [clientId, logs.length]);

  if (selectedLog) {
    return <WorkoutLogDetail entry={selectedLog} allLogs={logs} onBack={() => setSelectedLog(null)} />;
  }

  if (loading) {
    return (
      <div className="glass-card p-8 text-center text-muted text-sm">
        Loading training log...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted text-sm">
        <Dumbbell size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No workout sessions recorded</p>
        <p className="text-xs mt-1">Sessions will appear here once the client completes workouts</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(logs.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleLogs = logs.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  // ─── List View ───
  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5">
              <th className="text-left py-2.5 px-5 text-xs text-muted font-semibold uppercase tracking-wider">Workout</th>
              <th className="text-left py-2.5 pr-4 text-xs text-muted font-semibold uppercase tracking-wider">Duration</th>
              <th className="text-left py-2.5 pr-4 text-xs text-muted font-semibold uppercase tracking-wider">sRPE</th>
              <th className="text-left py-2.5 pr-4 text-xs text-muted font-semibold uppercase tracking-wider">Sets</th>
              <th className="text-left py-2.5 pr-4 text-xs text-muted font-semibold uppercase tracking-wider">Rating</th>
              <th className="text-left py-2.5 pr-4 text-xs text-muted font-semibold uppercase tracking-wider">Note</th>
              <th className="text-left py-2.5 pr-5 text-xs text-muted font-semibold uppercase tracking-wider">Completed</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((log) => (
              <tr
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="border-b border-black/5 last:border-b-0 hover:bg-black/[0.02] transition-colors cursor-pointer"
              >
                <td className="py-2.5 px-5 font-medium">{log.workoutName}</td>
                <td className="py-2.5 pr-4 text-muted whitespace-nowrap">{formatDuration(log.durationMinutes)}</td>
                <td className="py-2.5 pr-4 text-muted">{log.srpe != null && log.srpe > 0 ? log.srpe : "—"}</td>
                <td className="py-2.5 pr-4 text-sm">
                  {(() => {
                    const allSets = log.exerciseLogs.flatMap(e => e.setLogs);
                    const done = allSets.filter(s => s.completed).length;
                    const total = allSets.length;
                    if (total === 0) return <span className="text-muted">—</span>;
                    return done === total
                      ? <span className="text-success">{total}/{total}</span>
                      : <span className="text-warning">{done}/{total}</span>;
                  })()}
                </td>
                <td className="py-2.5 pr-4">
                  {log.rating != null && log.rating > 0 ? (
                    <StarRating rating={log.rating} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-muted italic max-w-[300px] truncate">
                  {log.notes || "—"}
                </td>
                <td className="py-2.5 pr-5 text-muted whitespace-nowrap">{formatDate(log.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length > rowsPerPage && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-black/5 bg-black/[0.01]">
          <p className="text-xs text-muted">
            Showing {Math.min((currentPage + 1) * rowsPerPage, logs.length)} of {logs.length} sessions
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-black/10 text-xs text-muted hover:text-foreground hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={12} />
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  onClick={() => setPage(index)}
                  className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                    index === currentPage
                      ? "bg-black/10 text-foreground"
                      : "text-muted hover:bg-black/[0.04]"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-black/10 text-xs text-muted hover:text-foreground hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
