"use client";

import { useState } from "react";
import {
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Dumbbell,
  CheckCircle,
  XCircle,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { ClientWorkoutView } from "@/lib/types";
import {
  useClientPrograms,
  clientProgramStore,
} from "@/lib/client-program-store";
import { ClientProgram } from "@/lib/types";
import { SessionBuilder } from "@/components/programs/session-builder";
import { WorkoutLogViewer } from "./workout-log-viewer";

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return status === "active" ? (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">
      Active
    </span>
  ) : (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/5 text-muted">
      Inactive
    </span>
  );
}

function ProgramMenu({
  cp,
  onClose,
}: {
  cp: ClientProgram;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg border border-black/10 shadow-lg py-1">
      <button
        className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 transition-colors"
        onClick={() => {
          onClose();
        }}
      >
        Edit
      </button>
      <button
        className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 transition-colors"
        onClick={() => {
          onClose();
        }}
      >
        Save as template
      </button>
      <button
        className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 transition-colors"
        onClick={() => {
          clientProgramStore.toggleStatus(cp.id);
          onClose();
        }}
      >
        {cp.status === "active" ? (
          <span className="flex items-center gap-2">
            <XCircle size={14} /> Set as Inactive
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CheckCircle size={14} /> Set as Active
          </span>
        )}
      </button>
      <div className="border-t border-black/5 my-1" />
      <button
        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
        onClick={() => {
          clientProgramStore.removeProgram(cp.id);
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
}

/** Compute phase date ranges from assignment start_date + cumulative weeks */
function computePhaseDates(startDate: string, phases: { weeks: number }[]) {
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let accumulated = 0;
  return phases.map((ph) => {
    const phaseStart = new Date(start);
    phaseStart.setDate(phaseStart.getDate() + accumulated * 7);
    const phaseEnd = new Date(start);
    phaseEnd.setDate(phaseEnd.getDate() + (accumulated + ph.weeks) * 7 - 1);
    const isCurrent = today >= phaseStart && today <= phaseEnd;
    const isPast = today > phaseEnd;
    const isFuture = today < phaseStart;
    let currentWeek = 0;
    if (isCurrent) {
      const daysDiff = Math.floor((today.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24));
      currentWeek = Math.floor(daysDiff / 7) + 1;
    }
    accumulated += ph.weeks;
    return { phaseStart, phaseEnd, isCurrent, isPast, isFuture, currentWeek };
  });
}

function formatDateShort(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function WorkoutsTab({ clientId }: { clientId: string }) {
  const clientPrograms = useClientPrograms(clientId);
  const [view, setView] = useState<ClientWorkoutView>("list");
  const [selectedCpId, setSelectedCpId] = useState<string | null>(null);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [newProgramModal, setNewProgramModal] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [innerTab, setInnerTab] = useState<"program" | "training-log">("program");

  const selectedCp = clientPrograms.find((cp) => cp.id === selectedCpId);
  const prog = selectedCp?.programData;
  const phase = prog?.phases[phaseIdx];

  const innerTabToggle = (
    <div className="flex items-center gap-1 mb-4">
      <button
        onClick={() => setInnerTab("program")}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          innerTab === "program"
            ? "bg-accent/15 text-accent"
            : "text-muted hover:text-foreground hover:bg-black/5"
        }`}
      >
        Program
      </button>
      <button
        onClick={() => setInnerTab("training-log")}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          innerTab === "training-log"
            ? "bg-accent/15 text-accent"
            : "text-muted hover:text-foreground hover:bg-black/5"
        }`}
      >
        Training Log
      </button>
    </div>
  );

  // ─── TRAINING LOG VIEW ───
  if (innerTab === "training-log") {
    return (
      <div className="space-y-4">
        {innerTabToggle}
        <WorkoutLogViewer clientId={clientId} />
      </div>
    );
  }

  // ─── LIST VIEW ───
  if (view === "list") {
    return (
      <div className="space-y-4">
        {innerTabToggle}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {clientPrograms.length} program{clientPrograms.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => setNewProgramModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
          >
            <Plus size={16} /> Add Workout Program
          </button>
        </div>

        {/* Program Table */}
        <div className="glass-card p-0 overflow-visible">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-black/5 text-xs font-semibold text-muted uppercase tracking-wider">
            <span>Name</span>
            <span className="w-32 text-center">Phases</span>
            <span className="w-20 text-center">Status</span>
            <span className="w-10" />
          </div>

          {clientPrograms.length === 0 && (
            <div className="p-8 text-center text-muted text-sm">
              <Dumbbell size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No programs assigned</p>
              <p className="text-xs mt-1">Add a workout program to get started</p>
            </div>
          )}

          {clientPrograms.map((cp) => (
            <div
              key={cp.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 border-b border-black/5 last:border-b-0 hover:bg-black/[0.02] transition-colors cursor-pointer"
              onClick={() => {
                setSelectedCpId(cp.id);
                setPhaseIdx(0);
                setView("phases");
              }}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{cp.programData.name}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {cp.programData.phases.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 rounded text-[10px] bg-black/5 text-muted"
                    >
                      {p.name}
                    </span>
                  ))}
                  {cp.programData.phases.length > 3 && (
                    <span className="text-[10px] text-muted">
                      +{cp.programData.phases.length - 3}
                    </span>
                  )}
                </div>
              </div>
              <span className="w-32 text-center text-sm text-muted">
                {cp.programData.phases.length} phase{cp.programData.phases.length !== 1 ? "s" : ""}
              </span>
              <div className="w-20 flex justify-center">
                <StatusBadge status={cp.status} />
              </div>
              <div className="w-10 relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === cp.id ? null : cp.id);
                  }}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen === cp.id && (
                  <ProgramMenu cp={cp} onClose={() => setMenuOpen(null)} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* New program modal */}
        {newProgramModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setNewProgramModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-base font-bold mb-4">New Workout Program</h3>
              <input
                type="text"
                placeholder="Program name"
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newProgramName.trim()) {
                    const cpId = clientProgramStore.createEmptyProgram(clientId, newProgramName.trim());
                    setNewProgramName("");
                    setNewProgramModal(false);
                    setSelectedCpId(cpId);
                    setView("phases");
                  }
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setNewProgramModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!newProgramName.trim()}
                  onClick={() => {
                    const cpId = clientProgramStore.createEmptyProgram(clientId, newProgramName.trim());
                    setNewProgramName("");
                    setNewProgramModal(false);
                    setSelectedCpId(cpId);
                    setView("phases");
                  }}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── PHASES VIEW ───
  if (view === "phases" && prog && selectedCp) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Persist any edits before navigating back
              if (editing && selectedCp) {
                clientProgramStore.persistProgramData(selectedCp.id);
              }
              setView("list");
              setSelectedCpId(null);
              setEditing(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Programs
          </button>
          <h2 className="text-lg font-bold flex-1 min-w-0 truncate">{prog.name}</h2>
          <StatusBadge status={selectedCp.status} />
          <button
            onClick={() => {
              if (editing) {
                // Persist to Supabase when finishing editing
                clientProgramStore.persistProgramData(selectedCp.id);
              }
              setEditing(!editing);
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              editing
                ? "bg-accent text-white"
                : "bg-black/5 text-muted hover:text-foreground"
            }`}
          >
            {editing ? "Save" : "Edit"}
          </button>
        </div>

        {/* Phase cards */}
        {(() => {
          const phaseDates = computePhaseDates(selectedCp.startDate, prog.phases);
          return prog.phases.map((ph, pIdx) => {
            const dates = phaseDates[pIdx];
            return (
          <div
            key={ph.id}
            className={`glass-card p-5 space-y-3 ${dates?.isCurrent ? "ring-2 ring-accent/30" : ""}`}
          >
            <div className="flex items-center gap-3">
              {editing ? (
                <input
                  value={ph.name}
                  onChange={(e) => {
                    clientProgramStore.updateProgramData(selectedCp.id, (p) => {
                      p.phases[pIdx].name = e.target.value;
                    });
                  }}
                  className="text-base font-bold bg-transparent border-b border-accent/50 focus:outline-none flex-1"
                />
              ) : (
                <h3 className="text-base font-bold flex-1">{ph.name}</h3>
              )}
              {dates?.isCurrent && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent uppercase">
                  Current · Week {dates.currentWeek} of {ph.weeks}
                </span>
              )}
              {dates?.isPast && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/5 text-muted uppercase">
                  Complete
                </span>
              )}
              {dates?.isFuture && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/5 text-muted uppercase">
                  Upcoming
                </span>
              )}
              <span className="text-xs text-muted">
                {editing ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      value={ph.weeks}
                      onChange={(e) => {
                        clientProgramStore.updateProgramData(selectedCp.id, (p) => {
                          p.phases[pIdx].weeks = parseInt(e.target.value) || 1;
                        });
                      }}
                      className="w-12 text-center bg-black/5 rounded border border-black/10 text-xs py-0.5"
                    />
                    weeks
                  </span>
                ) : (
                  `${ph.weeks} weeks`
                )}
              </span>
              {editing && prog.phases.length > 1 && (
                <button
                  onClick={() => {
                    clientProgramStore.updateProgramData(selectedCp.id, (p) => {
                      p.phases.splice(pIdx, 1);
                      p.phases.forEach((phase, i) => { phase.sort_order = i; });
                    });
                  }}
                  className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete phase"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Date range */}
            {dates && (
              <p className="text-[11px] text-muted">
                {formatDateShort(dates.phaseStart)} – {formatDateShort(dates.phaseEnd)}
              </p>
            )}

            {editing ? (
              <input
                value={ph.focus || ""}
                onChange={(e) => {
                  clientProgramStore.updateProgramData(selectedCp.id, (p) => {
                    p.phases[pIdx].focus = e.target.value;
                  });
                }}
                placeholder="Focus"
                className="w-full text-sm bg-transparent border-b border-black/10 focus:outline-none focus:border-accent/50 text-muted"
              />
            ) : (
              ph.focus && <p className="text-sm text-muted">{ph.focus}</p>
            )}

            {editing && (
              <textarea
                value={ph.description || ""}
                onChange={(e) => {
                  clientProgramStore.updateProgramData(selectedCp.id, (p) => {
                    p.phases[pIdx].description = e.target.value;
                  });
                }}
                placeholder="Description"
                rows={2}
                className="w-full text-sm bg-black/5 rounded-lg border border-black/10 px-3 py-2 focus:outline-none focus:border-accent/50 resize-none text-muted"
              />
            )}

            {/* Workout pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {ph.workouts.map((wk) => (
                <span
                  key={wk.id}
                  className="px-2.5 py-1 rounded-lg text-xs bg-black/5 text-muted"
                >
                  {wk.name}
                </span>
              ))}
              {ph.workouts.length === 0 && (
                <span className="text-xs text-muted/50 italic">No workouts</span>
              )}
            </div>

            <button
              onClick={() => {
                setPhaseIdx(pIdx);
                setView("builder");
              }}
              className="text-sm text-accent font-medium hover:underline flex items-center gap-1"
            >
              Open Session Builder <ChevronRight size={14} />
            </button>
          </div>
            );
          });
        })()}

        {/* Add phase */}
        {editing && (
          <button
            onClick={() => {
              clientProgramStore.updateProgramData(selectedCp.id, (p) => {
                p.phases.push({
                  id: Date.now(),
                  program_id: p.id,
                  name: "New Phase",
                  weeks: 4,
                  focus: "TBD",
                  description: "Define aims here.",
                  sort_order: p.phases.length,
                  workouts: [],
                });
              });
            }}
            className="w-full p-4 rounded-lg border-2 border-dashed border-black/10 text-muted text-sm font-medium hover:border-accent/30 hover:text-accent transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add Phase
          </button>
        )}
      </div>
    );
  }

  // ─── BUILDER VIEW — uses shared SessionBuilder component ───
  if (view === "builder" && prog && phase && selectedCp) {
    return (
      <div className="h-[calc(100vh-280px)] min-h-0 -mx-4 rounded-xl overflow-hidden border border-black/10">
        <SessionBuilder
          program={prog}
          phaseIdx={phaseIdx}
          editing={editing}
          onEditingChange={(nextEditing) => {
            // Persist when leaving edit mode via the top-bar "Save" button.
            if (editing && !nextEditing) {
              clientProgramStore.persistProgramData(selectedCp.id);
            }
            setEditing(nextEditing);
          }}
          onProgramChange={(fn) => {
            clientProgramStore.updateProgramData(selectedCp.id, fn);
          }}
          onBack={() => {
            // Persist to Supabase when leaving session builder
            clientProgramStore.persistProgramData(selectedCp.id);
            setView("phases");
            setEditing(false);
          }}
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className="glass-card p-8 text-center text-muted text-sm">
      <Dumbbell size={32} className="mx-auto mb-3 opacity-30" />
      Something went wrong.{" "}
      <button onClick={() => setView("list")} className="text-accent hover:underline">
        Go back
      </button>
    </div>
  );
}
