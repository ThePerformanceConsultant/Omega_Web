"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  ArrowLeft,
  Copy,
  X,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { ProgramWithPhases } from "@/lib/types";
import { SessionBuilder } from "@/components/programs/session-builder";
import { fetchPrograms, saveProgram } from "@/lib/supabase/db";

type ViewMode = "list" | "phases" | "builder";

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramWithPhases[]>([]);

  useEffect(() => {
    fetchPrograms(undefined, { templatesOnly: true })
      .then((data) => setPrograms(data))
      .catch(console.error);
  }, []);
  const [view, setView] = useState<ViewMode>("list");
  const [progIdx, setProgIdx] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [newProgramModal, setNewProgramModal] = useState(false);
  const [assignModal, setAssignModal] = useState<ProgramWithPhases | null>(null);
  const [newProgramName, setNewProgramName] = useState("");

  const prog = programs[progIdx];

  // Deep clone helper
  const deep = () => JSON.parse(JSON.stringify(programs)) as ProgramWithPhases[];

  // Persist program to Supabase (fire-and-forget, updates local state with real IDs)
  const persistProgram = (programData: ProgramWithPhases) => {
    saveProgram(programData, "coach", { isTemplate: true })
      .then((saved) => {
        // Replace local temp-ID program with the saved version (real DB IDs)
        setPrograms((prev) => {
          const updated = JSON.parse(JSON.stringify(prev)) as ProgramWithPhases[];
          const idx = updated.findIndex((p) => p.id === programData.id || p.id === saved.id);
          if (idx >= 0) updated[idx] = saved;
          return updated;
        });
      })
      .catch((err) => console.error("[Programs] Save failed:", err));
  };

  // Create new program
  const createProgram = () => {
    const name = newProgramName.trim() || "New Program";
    const p = deep();
    const newProg: ProgramWithPhases = {
      id: Date.now(),
      coach_id: "coach-1",
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      phases: [
        {
          id: Date.now() + 1,
          program_id: Date.now(),
          name: "Phase 1",
          weeks: 4,
          focus: "General",
          description: "Define the aims of this phase.",
          sort_order: 0,
          workouts: [],
        },
      ],
    };
    p.push(newProg);
    setPrograms(p);
    setProgIdx(p.length - 1);
    setPhaseIdx(0);
    setView("phases");
    setNewProgramModal(false);
    setNewProgramName("");
    // Fire-and-forget save to Supabase
    persistProgram(newProg);
  };

  // Duplicate program (called from onClick, not during render)
  const duplicateProgram = (idx: number) => {
    const p = deep();
    const copy = JSON.parse(JSON.stringify(p[idx]));
    copy.id = crypto.randomUUID();
    copy.name += " (Copy)";
    p.push(copy);
    setPrograms(p);
    // Fire-and-forget save to Supabase
    persistProgram(copy);
  };

  // =========================================
  // LIST VIEW
  // =========================================
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{programs.length} programs</p>
          <div className="flex gap-2">
            <button
              onClick={() => setNewProgramModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
            >
              <Plus size={16} /> New Program
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {programs.map((p, i) => (
            <div key={p.id} className="glass-card p-5">
              <h3 className="text-lg font-bold mb-1.5">{p.name}</h3>
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {p.phases.map((ph) => (
                  <span
                    key={ph.id}
                    className="px-2 py-0.5 rounded-full text-xs bg-black/5 text-muted"
                  >
                    {ph.name}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <div className="text-xl font-bold">{p.phases.length}</div>
                  <div className="text-xs text-muted">Phases</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {p.phases.reduce((a, ph) => a + ph.weeks, 0)}
                  </div>
                  <div className="text-xs text-muted">Weeks</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {p.phases.reduce((a, ph) => a + ph.workouts.length, 0)}
                  </div>
                  <div className="text-xs text-muted">Workouts</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setProgIdx(i);
                    setPhaseIdx(0);
                    setView("phases");
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => setAssignModal(p)}
                  className="px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Assign
                </button>
                <button
                  onClick={() => duplicateProgram(i)}
                  className="p-2 rounded-lg bg-black/5 border border-black/10 text-muted hover:text-foreground transition-colors"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* New Program Modal */}
        {newProgramModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-card p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">New Program</h2>
                <button onClick={() => setNewProgramModal(false)} className="text-muted hover:text-foreground">
                  <X size={20} />
                </button>
              </div>
              <label className="block text-xs text-muted mb-1.5">Program Name</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 mb-4"
                placeholder="e.g. Strength Block"
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && createProgram()}
              />
              <button
                onClick={createProgram}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
              >
                Create Program
              </button>
            </div>
          </div>
        )}

        {/* Assign Modal */}
        {assignModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-card p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Assign &quot;{assignModal.name}&quot;</h2>
                <button onClick={() => setAssignModal(null)} className="text-muted hover:text-foreground">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-muted mb-4">
                Client assignment will be available once Supabase is connected.
              </p>
              <button
                onClick={() => setAssignModal(null)}
                className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================
  // PHASES VIEW
  // =========================================
  if (view === "phases" && prog) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); setEditing(false); }}
            className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Back
          </button>
          {editing ? (
            <input
              className="text-2xl font-bold bg-transparent border-b border-accent/40 outline-none"
              value={prog.name}
              onChange={(e) => {
                const p = deep();
                p[progIdx].name = e.target.value;
                setPrograms(p);
              }}
            />
          ) : (
            <h1 className="text-2xl font-bold">{prog.name}</h1>
          )}
          <div className="flex-1" />
          <button
            onClick={() => {
              if (editing && prog) {
                // Save to Supabase when finishing edits
                persistProgram(prog);
              }
              setEditing(!editing);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              editing
                ? "bg-gradient-to-br from-accent to-accent-light text-white"
                : "bg-black/5 border border-black/10 text-muted hover:text-foreground"
            }`}
          >
            {editing ? "Done Editing" : "Edit Program"}
          </button>
        </div>

        <div className="space-y-4">
          {prog.phases.map((ph, i) => (
            <div key={ph.id} className="glass-card p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  {editing ? (
                    <input
                      className="text-lg font-bold bg-transparent border-b border-black/20 outline-none focus:border-accent/50 mb-1.5 w-full"
                      value={ph.name}
                      onChange={(e) => {
                        const p = deep();
                        p[progIdx].phases[i].name = e.target.value;
                        setPrograms(p);
                      }}
                    />
                  ) : (
                    <h3 className="text-lg font-bold mb-1">{ph.name}</h3>
                  )}
                  <div className="flex gap-2 mb-2">
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-16 px-2 py-1 rounded bg-black/5 border border-black/10 text-sm text-center outline-none focus:border-accent/50"
                          value={ph.weeks}
                          onChange={(e) => {
                            const p = deep();
                            p[progIdx].phases[i].weeks = parseInt(e.target.value) || 1;
                            setPrograms(p);
                          }}
                        />
                        <span className="text-xs text-muted">weeks</span>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-accent/15 text-accent">
                        {ph.weeks} weeks
                      </span>
                    )}
                    {editing ? (
                      <input
                        className="px-2 py-1 rounded bg-black/5 border border-black/10 text-sm outline-none focus:border-accent/50 w-48"
                        placeholder="Focus area"
                        value={ph.focus || ""}
                        onChange={(e) => {
                          const p = deep();
                          p[progIdx].phases[i].focus = e.target.value;
                          setPrograms(p);
                        }}
                      />
                    ) : (
                      ph.focus && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-success/15 text-success">
                          {ph.focus}
                        </span>
                      )
                    )}
                  </div>
                  {editing ? (
                    <textarea
                      className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-muted outline-none focus:border-accent/50 resize-vertical"
                      rows={2}
                      value={ph.description || ""}
                      onChange={(e) => {
                        const p = deep();
                        p[progIdx].phases[i].description = e.target.value;
                        setPrograms(p);
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted leading-relaxed">{ph.description}</p>
                  )}
                </div>
                {editing && prog.phases.length > 1 && (
                  <button
                    onClick={() => {
                      const p = deep();
                      p[progIdx].phases.splice(i, 1);
                      p[progIdx].phases.forEach((phase, idx) => { phase.sort_order = idx; });
                      setPrograms(p);
                    }}
                    className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors self-start mt-1"
                    title="Delete phase"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {ph.workouts.map((w) => (
                  <span key={w.id} className="px-2 py-1 rounded text-xs bg-black/5 text-foreground">
                    {w.name}
                  </span>
                ))}
                {ph.workouts.length === 0 && (
                  <span className="text-xs text-muted">No workouts yet</span>
                )}
              </div>
              <button
                onClick={() => {
                  setPhaseIdx(i);
                  setView("builder");
                }}
                className="mt-3 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium flex items-center gap-2"
              >
                Open Session Builder <ChevronRight size={14} />
              </button>
            </div>
          ))}
        </div>

        {editing && (
          <button
            onClick={() => {
              const p = deep();
              p[progIdx].phases.push({
                id: Date.now(),
                program_id: prog.id,
                name: "New Phase",
                weeks: 4,
                focus: "TBD",
                description: "Define aims here.",
                sort_order: prog.phases.length,
                workouts: [],
              });
              setPrograms(p);
            }}
            className="px-4 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors"
          >
            + Add Phase
          </button>
        )}
      </div>
    );
  }

  // =========================================
  // SESSION BUILDER VIEW — now uses shared component
  // =========================================
  return (
    <div className="h-[calc(100vh-65px)] -m-6">
      <SessionBuilder
        program={prog}
        phaseIdx={phaseIdx}
        editing={editing}
        onEditingChange={(newEditing) => {
          // Persist to Supabase when the coach clicks "Save" (editing → view mode)
          if (editing && !newEditing && prog) persistProgram(prog);
          setEditing(newEditing);
        }}
        onProgramChange={(fn) => {
          const p = deep();
          fn(p[progIdx]);
          setPrograms(p);
        }}
        onBack={() => {
          // Save to Supabase when leaving the session builder
          if (prog) persistProgram(prog);
          setView("phases");
          setEditing(false);
        }}
      />
    </div>
  );
}
