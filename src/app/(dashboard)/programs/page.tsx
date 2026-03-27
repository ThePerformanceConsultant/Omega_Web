"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ArrowLeft,
  Copy,
  X,
  ChevronRight,
  Trash2,
  FolderPlus,
  Folder,
  GripVertical,
} from "lucide-react";
import { Client, ProgramFolder, ProgramWithPhases } from "@/lib/types";
import { SessionBuilder } from "@/components/programs/session-builder";
import {
  assignProgramToClient,
  createProgramFolder,
  deleteProgram,
  deleteProgramFolder,
  fetchClients,
  fetchProgramFolders,
  fetchPrograms,
  isSupabaseConfigured,
  moveProgramToFolder,
  saveProgram,
} from "@/lib/supabase/db";

type ViewMode = "list" | "phases" | "builder" | "onDemandBuilder";
type RootTab = "templates" | "on_demand";

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState<RootTab>("templates");
  const [view, setView] = useState<ViewMode>("list");

  const [programs, setPrograms] = useState<ProgramWithPhases[]>([]);
  const [onDemandPrograms, setOnDemandPrograms] = useState<ProgramWithPhases[]>([]);
  const [folders, setFolders] = useState<ProgramFolder[]>([]);

  const [progIdx, setProgIdx] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [editing, setEditing] = useState(false);

  const [onDemandIdx, setOnDemandIdx] = useState(0);
  const [onDemandEditing, setOnDemandEditing] = useState(true);
  const [draggedOnDemandProgramId, setDraggedOnDemandProgramId] = useState<number | null>(null);

  const [newProgramModal, setNewProgramModal] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");

  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [newOnDemandModal, setNewOnDemandModal] = useState(false);
  const [newOnDemandName, setNewOnDemandName] = useState("");
  const [newOnDemandFolderId, setNewOnDemandFolderId] = useState<string>("none");

  const [assignModal, setAssignModal] = useState<ProgramWithPhases | null>(null);
  const [assignClients, setAssignClients] = useState<Client[]>([]);
  const [assignClientId, setAssignClientId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const supabaseEnabled = isSupabaseConfigured();

  const templateProgram = programs[progIdx];
  const onDemandProgram = onDemandPrograms[onDemandIdx];

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [folders]
  );

  const ungroupedOnDemandPrograms = useMemo(
    () => onDemandPrograms.filter((program) => program.folder_id == null),
    [onDemandPrograms]
  );

  const onDemandByFolder = useMemo(() => {
    const grouped = new Map<number, ProgramWithPhases[]>();
    for (const folder of sortedFolders) grouped.set(folder.id, []);
    for (const program of onDemandPrograms) {
      if (program.folder_id == null) continue;
      const existing = grouped.get(program.folder_id) ?? [];
      existing.push(program);
      grouped.set(program.folder_id, existing);
    }
    return grouped;
  }, [onDemandPrograms, sortedFolders]);

  useEffect(() => {
    fetchAllProgramData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!assignModal || !supabaseEnabled) return;

    fetchClients()
      .then((rows) => {
        const mapped = rows as Client[];
        setAssignClients(mapped);
        if (mapped.length > 0) {
          setAssignClientId((prev) => prev || mapped[0].id);
        }
      })
      .catch((err) => {
        console.error("[Programs] fetchClients failed:", err);
        setAssignError("Failed to load clients.");
      });
  }, [assignModal, supabaseEnabled]);

  const deepTemplatePrograms = () => JSON.parse(JSON.stringify(programs)) as ProgramWithPhases[];
  const deepOnDemandPrograms = () => JSON.parse(JSON.stringify(onDemandPrograms)) as ProgramWithPhases[];

  async function fetchAllProgramData() {
    try {
      const [templateRows, onDemandRows, folderRows] = await Promise.all([
        fetchPrograms(undefined, { templatesOnly: true }),
        fetchPrograms(undefined, { onDemandOnly: true }),
        fetchProgramFolders(),
      ]);
      setPrograms(templateRows);
      setOnDemandPrograms(onDemandRows);
      setFolders(folderRows as ProgramFolder[]);
    } catch (err) {
      console.error("[Programs] initial fetch failed:", err);
    }
  }

  const persistTemplateProgram = (programData: ProgramWithPhases) => {
    saveProgram(programData, "coach", { isTemplate: true, isOnDemand: false })
      .then((saved) => {
        setPrograms((prev) => {
          const next = JSON.parse(JSON.stringify(prev)) as ProgramWithPhases[];
          const idx = next.findIndex((p) => p.id === programData.id || p.id === saved.id);
          if (idx >= 0) next[idx] = saved;
          return next;
        });
      })
      .catch((err) => console.error("[Programs] Template save failed:", err));
  };

  const persistOnDemandProgram = (programData: ProgramWithPhases) => {
    saveProgram(programData, "coach", {
      isTemplate: false,
      isOnDemand: true,
      folderId: programData.folder_id ?? null,
    })
      .then((saved) => {
        setOnDemandPrograms((prev) => {
          const next = JSON.parse(JSON.stringify(prev)) as ProgramWithPhases[];
          const idx = next.findIndex((p) => p.id === programData.id || p.id === saved.id);
          if (idx >= 0) next[idx] = saved;
          return next;
        });
      })
      .catch((err) => console.error("[Programs] On-demand save failed:", err));
  };

  const createTemplateProgram = () => {
    const name = newProgramName.trim() || "New Program";
    const p = deepTemplatePrograms();
    const now = Date.now();
    const newProg: ProgramWithPhases = {
      id: now,
      coach_id: "coach-1",
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_template: true,
      is_on_demand: false,
      folder_id: null,
      phases: [
        {
          id: now + 1,
          program_id: now,
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
    persistTemplateProgram(newProg);
  };

  const duplicateTemplateProgram = (idx: number) => {
    const p = deepTemplatePrograms();
    const copy = JSON.parse(JSON.stringify(p[idx])) as ProgramWithPhases;
    copy.id = Date.now();
    copy.name += " (Copy)";
    copy.is_template = true;
    copy.is_on_demand = false;
    copy.folder_id = null;
    p.push(copy);
    setPrograms(p);
    persistTemplateProgram(copy);
  };

  const createOnDemandSession = () => {
    const name = newOnDemandName.trim() || "New On-Demand Session";
    const now = Date.now();
    const folderId = newOnDemandFolderId === "none" ? null : Number(newOnDemandFolderId);

    const newProgram: ProgramWithPhases = {
      id: now,
      coach_id: "coach-1",
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_template: false,
      is_on_demand: true,
      folder_id: folderId,
      phases: [
        {
          id: now + 1,
          program_id: now,
          name: "On-Demand",
          weeks: 1,
          focus: "On-Demand",
          description: "",
          sort_order: 0,
          workouts: [
            {
              id: now + 2,
              phase_id: now + 1,
              name,
              sort_order: 0,
              scheduled_weekday: null,
              workout_sections: [],
              exercises: [],
            },
          ],
        },
      ],
    };

    setOnDemandPrograms((prev) => [newProgram, ...prev]);
    setOnDemandIdx(0);
    setOnDemandEditing(true);
    setView("onDemandBuilder");
    setNewOnDemandModal(false);
    setNewOnDemandName("");
    setNewOnDemandFolderId("none");

    persistOnDemandProgram(newProgram);
  };

  const createFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      const created = await createProgramFolder(trimmed);
      if (created) {
        setFolders((prev) => [...prev, created as ProgramFolder]);
      }
      setNewFolderModal(false);
      setNewFolderName("");
    } catch (err) {
      console.error("[Programs] create folder failed:", err);
    }
  };

  const moveOnDemandSession = async (programId: number, folderId: number | null) => {
    setOnDemandPrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? { ...program, folder_id: folderId }
          : program
      )
    );

    try {
      await moveProgramToFolder(programId, folderId);
    } catch (err) {
      console.error("[Programs] move session failed:", err);
      fetchAllProgramData();
    }
  };

  const deleteOnDemandSession = async (programId: number) => {
    setOnDemandPrograms((prev) => prev.filter((program) => program.id !== programId));
    try {
      await deleteProgram(programId);
    } catch (err) {
      console.error("[Programs] delete on-demand session failed:", err);
      fetchAllProgramData();
    }
  };

  const removeFolder = async (folderId: number) => {
    setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    setOnDemandPrograms((prev) =>
      prev.map((program) =>
        program.folder_id === folderId
          ? { ...program, folder_id: null }
          : program
      )
    );

    try {
      await deleteProgramFolder(folderId);
    } catch (err) {
      console.error("[Programs] delete folder failed:", err);
      fetchAllProgramData();
    }
  };

  const handleAssignProgram = async () => {
    if (!assignModal) return;
    if (!assignClientId) {
      setAssignError("Select a client before assigning.");
      return;
    }

    setAssignBusy(true);
    setAssignError(null);
    try {
      await assignProgramToClient(assignClientId, Number(assignModal.id), assignStartDate);
      setAssignModal(null);
      setAssignClientId("");
      setAssignStartDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      console.error("[Programs] assign failed:", err);
      setAssignError(err instanceof Error ? err.message : "Failed to assign program.");
    } finally {
      setAssignBusy(false);
    }
  };

  const openOnDemandBuilder = (idx: number) => {
    setOnDemandIdx(idx);
    setOnDemandEditing(true);
    setView("onDemandBuilder");
  };

  const sessionStats = (program: ProgramWithPhases) => {
    const workouts = program.phases.reduce((all, phase) => all + phase.workouts.length, 0);
    const exercises = program.phases.reduce(
      (all, phase) =>
        all + phase.workouts.reduce((sum, workout) => sum + workout.exercises.length, 0),
      0
    );
    return { workouts, exercises };
  };

  const onDemandCard = (program: ProgramWithPhases, idx: number) => {
    const stats = sessionStats(program);
    const folderName =
      program.folder_id == null
        ? "Unfoldered"
        : (folders.find((folder) => folder.id === program.folder_id)?.name ?? "Folder");

    return (
      <div
        key={program.id}
        draggable
        onDragStart={() => setDraggedOnDemandProgramId(program.id)}
        onDragEnd={() => setDraggedOnDemandProgramId(null)}
        className="glass-card p-4 border border-black/5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <GripVertical size={14} className="text-muted shrink-0" />
              <h3 className="text-base font-semibold truncate">{program.name}</h3>
            </div>
            <p className="text-xs text-muted">
              {stats.exercises} exercises · {stats.workouts} workout{stats.workouts === 1 ? "" : "s"}
            </p>
            <p className="text-[11px] text-muted mt-1">Folder: {folderName}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openOnDemandBuilder(idx)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-xs font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => deleteOnDemandSession(program.id)}
              className="p-2 rounded-lg bg-black/5 border border-black/10 text-muted hover:text-red-500"
              title="Delete session"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================
  // LIST VIEW (Templates + On-Demand tabs)
  // =========================================
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl bg-black/5 p-1 border border-black/10 w-fit">
            <button
              onClick={() => setActiveTab("templates")}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === "templates"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setActiveTab("on_demand")}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === "on_demand"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              On Demand
            </button>
          </div>

          {activeTab === "templates" ? (
            <button
              onClick={() => setNewProgramModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
            >
              <Plus size={16} /> New Program
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewOnDemandModal(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
              >
                <Plus size={16} /> On Demand Session
              </button>
              <button
                onClick={() => setNewFolderModal(true)}
                className="px-4 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-2"
              >
                <FolderPlus size={16} /> Folder
              </button>
            </div>
          )}
        </div>

        {activeTab === "templates" ? (
          <>
            <p className="text-sm text-muted">{programs.length} programs</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {programs.map((program, idx) => (
                <div key={program.id} className="glass-card p-5">
                  <h3 className="text-lg font-bold mb-1.5">{program.name}</h3>
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    {program.phases.map((phase) => (
                      <span
                        key={phase.id}
                        className="px-2 py-0.5 rounded-full text-xs bg-black/5 text-muted"
                      >
                        {phase.name}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <div className="text-xl font-bold">{program.phases.length}</div>
                      <div className="text-xs text-muted">Phases</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {program.phases.reduce((acc, phase) => acc + phase.weeks, 0)}
                      </div>
                      <div className="text-xs text-muted">Weeks</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {program.phases.reduce((acc, phase) => acc + phase.workouts.length, 0)}
                      </div>
                      <div className="text-xs text-muted">Workouts</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setProgIdx(idx);
                        setPhaseIdx(0);
                        setView("phases");
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setAssignModal(program);
                        setAssignError(null);
                      }}
                      className="px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => duplicateTemplateProgram(idx)}
                      className="p-2 rounded-lg bg-black/5 border border-black/10 text-muted hover:text-foreground transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">{onDemandPrograms.length} on-demand sessions</p>

            <div
              className="glass-card p-4 border border-dashed border-black/15"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedOnDemandProgramId == null) return;
                moveOnDemandSession(draggedOnDemandProgramId, null);
                setDraggedOnDemandProgramId(null);
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Folder size={14} className="text-muted" />
                <p className="text-sm font-medium">Ungrouped Sessions</p>
              </div>
              <div className="space-y-3">
                {ungroupedOnDemandPrograms.length > 0 ? (
                  ungroupedOnDemandPrograms.map((program) => {
                    const idx = onDemandPrograms.findIndex((p) => p.id === program.id);
                    return onDemandCard(program, idx);
                  })
                ) : (
                  <p className="text-xs text-muted">Drag a session here to remove it from a folder.</p>
                )}
              </div>
            </div>

            {sortedFolders.map((folder) => {
              const sessions = onDemandByFolder.get(folder.id) ?? [];
              return (
                <div
                  key={folder.id}
                  className="glass-card p-4 border border-black/5"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedOnDemandProgramId == null) return;
                    moveOnDemandSession(draggedOnDemandProgramId, folder.id);
                    setDraggedOnDemandProgramId(null);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Folder size={14} className="text-accent" />
                      <h3 className="text-sm font-semibold">{folder.name}</h3>
                    </div>
                    <button
                      onClick={() => removeFolder(folder.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50"
                      title="Delete folder"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {sessions.length > 0 ? (
                      sessions.map((program) => {
                        const idx = onDemandPrograms.findIndex((p) => p.id === program.id);
                        return onDemandCard(program, idx);
                      })
                    ) : (
                      <p className="text-xs text-muted">Drop an on-demand session here.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                onChange={(event) => setNewProgramName(event.target.value)}
                autoFocus
                onKeyDown={(event) => event.key === "Enter" && createTemplateProgram()}
              />
              <button
                onClick={createTemplateProgram}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
              >
                Create Program
              </button>
            </div>
          </div>
        )}

        {newOnDemandModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-card p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">New On-Demand Session</h2>
                <button onClick={() => setNewOnDemandModal(false)} className="text-muted hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              <label className="block text-xs text-muted mb-1.5">Session Name</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 mb-3"
                placeholder="e.g. Upper Body Pump"
                value={newOnDemandName}
                onChange={(event) => setNewOnDemandName(event.target.value)}
                autoFocus
              />

              <label className="block text-xs text-muted mb-1.5">Folder</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50 mb-4"
                value={newOnDemandFolderId}
                onChange={(event) => setNewOnDemandFolderId(event.target.value)}
              >
                <option value="none">No Folder</option>
                {sortedFolders.map((folder) => (
                  <option key={folder.id} value={String(folder.id)}>
                    {folder.name}
                  </option>
                ))}
              </select>

              <button
                onClick={createOnDemandSession}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
              >
                Create Session
              </button>
            </div>
          </div>
        )}

        {newFolderModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-card p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">New Folder</h2>
                <button onClick={() => setNewFolderModal(false)} className="text-muted hover:text-foreground">
                  <X size={20} />
                </button>
              </div>
              <label className="block text-xs text-muted mb-1.5">Folder Name</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 mb-4"
                placeholder="e.g. Travel Sessions"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                autoFocus
                onKeyDown={(event) => event.key === "Enter" && createFolder()}
              />
              <button
                onClick={createFolder}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
              >
                Create Folder
              </button>
            </div>
          </div>
        )}

        {assignModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-card p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Assign &quot;{assignModal.name}&quot;</h2>
                <button onClick={() => setAssignModal(null)} className="text-muted hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              {!supabaseEnabled ? (
                <p className="text-sm text-muted mb-4">
                  Supabase is not configured for this environment.
                </p>
              ) : (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Client</label>
                    <select
                      className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50"
                      value={assignClientId}
                      onChange={(event) => setAssignClientId(event.target.value)}
                    >
                      {assignClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-muted mb-1.5">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50"
                      value={assignStartDate}
                      onChange={(event) => setAssignStartDate(event.target.value)}
                    />
                  </div>

                  {assignError && <p className="text-xs text-red-500">{assignError}</p>}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setAssignModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-sm"
                >
                  Close
                </button>
                {supabaseEnabled && (
                  <button
                    onClick={() => void handleAssignProgram()}
                    disabled={assignBusy || assignClients.length === 0}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium disabled:opacity-60"
                  >
                    {assignBusy ? "Assigning..." : "Assign"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================
  // PHASES VIEW (Template Programs)
  // =========================================
  if (view === "phases" && templateProgram) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setView("list");
              setEditing(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {editing ? (
            <input
              className="text-2xl font-bold bg-transparent border-b border-accent/40 outline-none"
              value={templateProgram.name}
              onChange={(event) => {
                const next = deepTemplatePrograms();
                next[progIdx].name = event.target.value;
                setPrograms(next);
              }}
            />
          ) : (
            <h1 className="text-2xl font-bold">{templateProgram.name}</h1>
          )}

          <div className="flex-1" />

          <button
            onClick={() => {
              if (editing && templateProgram) {
                persistTemplateProgram(templateProgram);
              }
              setEditing((prev) => !prev);
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
          {templateProgram.phases.map((phase, idx) => (
            <div key={phase.id} className="glass-card p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  {editing ? (
                    <input
                      className="text-lg font-bold bg-transparent border-b border-black/20 outline-none focus:border-accent/50 mb-1.5 w-full"
                      value={phase.name}
                      onChange={(event) => {
                        const next = deepTemplatePrograms();
                        next[progIdx].phases[idx].name = event.target.value;
                        setPrograms(next);
                      }}
                    />
                  ) : (
                    <h3 className="text-lg font-bold mb-1">{phase.name}</h3>
                  )}

                  <div className="flex gap-2 mb-2">
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-16 px-2 py-1 rounded bg-black/5 border border-black/10 text-sm text-center outline-none focus:border-accent/50"
                          value={phase.weeks}
                          onChange={(event) => {
                            const next = deepTemplatePrograms();
                            next[progIdx].phases[idx].weeks = parseInt(event.target.value) || 1;
                            setPrograms(next);
                          }}
                        />
                        <span className="text-xs text-muted">weeks</span>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-accent/15 text-accent">
                        {phase.weeks} weeks
                      </span>
                    )}

                    {editing ? (
                      <input
                        className="px-2 py-1 rounded bg-black/5 border border-black/10 text-sm outline-none focus:border-accent/50 w-48"
                        placeholder="Focus area"
                        value={phase.focus || ""}
                        onChange={(event) => {
                          const next = deepTemplatePrograms();
                          next[progIdx].phases[idx].focus = event.target.value;
                          setPrograms(next);
                        }}
                      />
                    ) : (
                      phase.focus && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-success/15 text-success">
                          {phase.focus}
                        </span>
                      )
                    )}
                  </div>

                  {editing ? (
                    <textarea
                      className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-muted outline-none focus:border-accent/50 resize-vertical"
                      rows={2}
                      value={phase.description || ""}
                      onChange={(event) => {
                        const next = deepTemplatePrograms();
                        next[progIdx].phases[idx].description = event.target.value;
                        setPrograms(next);
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted leading-relaxed">{phase.description}</p>
                  )}
                </div>

                {editing && templateProgram.phases.length > 1 && (
                  <button
                    onClick={() => {
                      const next = deepTemplatePrograms();
                      next[progIdx].phases.splice(idx, 1);
                      next[progIdx].phases.forEach((item, order) => {
                        item.sort_order = order;
                      });
                      setPrograms(next);
                    }}
                    className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors self-start mt-1"
                    title="Delete phase"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 mt-3 flex-wrap">
                {phase.workouts.map((workout) => (
                  <span key={workout.id} className="px-2 py-1 rounded text-xs bg-black/5 text-foreground">
                    {workout.name}
                  </span>
                ))}
                {phase.workouts.length === 0 && (
                  <span className="text-xs text-muted">No workouts yet</span>
                )}
              </div>

              <button
                onClick={() => {
                  setPhaseIdx(idx);
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
              const next = deepTemplatePrograms();
              next[progIdx].phases.push({
                id: Date.now(),
                program_id: templateProgram.id,
                name: "New Phase",
                weeks: 4,
                focus: "TBD",
                description: "Define aims here.",
                sort_order: templateProgram.phases.length,
                workouts: [],
              });
              setPrograms(next);
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
  // TEMPLATE SESSION BUILDER
  // =========================================
  if (view === "builder" && templateProgram) {
    return (
      <div className="h-[calc(100vh-65px)] min-h-0 -m-6 overflow-hidden">
        <SessionBuilder
          program={templateProgram}
          phaseIdx={phaseIdx}
          editing={editing}
          onEditingChange={(nextEditing) => {
            if (editing && !nextEditing && templateProgram) {
              persistTemplateProgram(templateProgram);
            }
            setEditing(nextEditing);
          }}
          onProgramChange={(mutate) => {
            const next = deepTemplatePrograms();
            mutate(next[progIdx]);
            setPrograms(next);
          }}
          onBack={() => {
            if (templateProgram) persistTemplateProgram(templateProgram);
            setView("phases");
            setEditing(false);
          }}
        />
      </div>
    );
  }

  // =========================================
  // ON-DEMAND SESSION BUILDER
  // =========================================
  if (view === "onDemandBuilder" && onDemandProgram) {
    return (
      <div className="h-[calc(100vh-65px)] min-h-0 -m-6 overflow-hidden">
        <SessionBuilder
          program={onDemandProgram}
          phaseIdx={0}
          editing={onDemandEditing}
          onEditingChange={(nextEditing) => {
            if (onDemandEditing && !nextEditing && onDemandProgram) {
              persistOnDemandProgram(onDemandProgram);
            }
            setOnDemandEditing(nextEditing);
          }}
          onProgramChange={(mutate) => {
            const next = deepOnDemandPrograms();
            mutate(next[onDemandIdx]);
            setOnDemandPrograms(next);
          }}
          onBack={() => {
            if (onDemandProgram) persistOnDemandProgram(onDemandProgram);
            setView("list");
            setActiveTab("on_demand");
            setOnDemandEditing(true);
          }}
          initialWorkoutIdx={0}
        />
      </div>
    );
  }

  return null;
}
