import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { ClientProgram, ProgramWithPhases } from "./types";
import {
  isSupabaseConfigured,
  assignProgramToClient,
  fetchClientAssignments,
  removeClientAssignment,
  updateAssignmentStatus,
  saveProgram as saveProgramToDb,
} from "./supabase/db";

// ==========================================
// Client Program Store — useSyncExternalStore pattern
// ==========================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let clientPrograms: ClientProgram[] = [];
const listeners = new Set<() => void>();
const programCache = new Map<string, ClientProgram[]>();
const loadedClients = new Set<string>();

function emitChange() {
  programCache.clear();
  listeners.forEach((l) => l());
}

/** Check if a CP id is a real Supabase assignment ID (numeric string) vs local temp ("cp-...") */
function isSupabaseAssignmentId(id: string): boolean {
  return /^\d+$/.test(id);
}

/**
 * Merge real DB IDs from the saved version into the current (possibly edited) programData.
 * This prevents the race condition where a fire-and-forget save overwrites edits made
 * by the coach between when the save started and when it completed.
 */
function mergeDbIds(current: ProgramWithPhases, saved: ProgramWithPhases): ProgramWithPhases {
  const merged: ProgramWithPhases = JSON.parse(JSON.stringify(current));
  merged.id = saved.id;
  merged.coach_id = saved.coach_id;
  merged.created_at = saved.created_at;
  merged.updated_at = saved.updated_at;
  // Merge phase and workout IDs (match by index since they correspond 1:1 at save time)
  for (let pi = 0; pi < Math.min(saved.phases.length, merged.phases.length); pi++) {
    merged.phases[pi].id = saved.phases[pi].id;
    merged.phases[pi].program_id = saved.id;
    for (let wi = 0; wi < Math.min(saved.phases[pi].workouts.length, merged.phases[pi].workouts.length); wi++) {
      merged.phases[pi].workouts[wi].id = saved.phases[pi].workouts[wi].id;
      merged.phases[pi].workouts[wi].phase_id = saved.phases[pi].id;
      // Merge section IDs
      const savedSections = saved.phases[pi].workouts[wi].workout_sections ?? [];
      const mergedSections = merged.phases[pi].workouts[wi].workout_sections ?? [];
      for (let si = 0; si < Math.min(savedSections.length, mergedSections.length); si++) {
        mergedSections[si].id = savedSections[si].id;
        mergedSections[si].workout_id = saved.phases[pi].workouts[wi].id;
      }
      // Merge exercise IDs (only for exercises that existed at save time)
      const savedExercises = saved.phases[pi].workouts[wi].exercises ?? [];
      const mergedExercises = merged.phases[pi].workouts[wi].exercises ?? [];
      for (let ei = 0; ei < Math.min(savedExercises.length, mergedExercises.length); ei++) {
        mergedExercises[ei].id = savedExercises[ei].id;
        mergedExercises[ei].workout_id = saved.phases[pi].workouts[wi].id;
      }
      // Any NEW exercises added after save started keep their temp IDs — they'll get real IDs on next persist
    }
  }
  return merged;
}

export const clientProgramStore = {
  getProgramsForClient(clientId: string): ClientProgram[] {
    const cached = programCache.get(clientId);
    if (cached) return cached;
    const result = clientPrograms.filter((cp) => cp.clientId === clientId);
    programCache.set(clientId, result);
    return result;
  },

  /** Load assignments from Supabase for a given client (called once per client) */
  async loadFromSupabase(clientId: string) {
    if (!isSupabaseConfigured() || loadedClients.has(clientId)) return;
    // Only query Supabase if clientId is a real UUID
    if (!UUID_REGEX.test(clientId)) {
      loadedClients.add(clientId);
      return;
    }
    try {
      const assignments = await fetchClientAssignments(clientId);
      if (assignments.length > 0) {
        // Remove mock data for this client and replace with real data
        clientPrograms = clientPrograms.filter((cp) => cp.clientId !== clientId);
        for (const a of assignments) {
          if (a.programData) {
            clientPrograms.push({
              id: a.id,
              clientId: a.clientId,
              programId: a.programId,
              status: a.status as "active" | "inactive",
              assignedAt: a.assignedAt,
              startDate: a.startDate ?? new Date().toISOString().split("T")[0],
              programData: a.programData,
              assignmentDbId: a.id,
            });
          }
        }
        emitChange();
      }
      loadedClients.add(clientId);
    } catch (err) {
      console.error("Failed to load client assignments:", err);
    }
  },

  addProgram(clientId: string, programData: ProgramWithPhases) {
    const cp: ClientProgram = {
      id: "cp-" + Date.now(),
      clientId,
      programId: programData.id,
      status: "inactive",
      assignedAt: new Date().toISOString(),
      startDate: new Date().toISOString().split("T")[0],
      programData: JSON.parse(JSON.stringify(programData)),
    };
    clientPrograms = [...clientPrograms, cp];
    emitChange();

    // Fire-and-forget Supabase sync — only if clientId is a real UUID
    if (isSupabaseConfigured() && UUID_REGEX.test(clientId)) {
      const TEMP_ID_THRESHOLD = 1_000_000_000;
      const needsSave = programData.id > TEMP_ID_THRESHOLD;
      const programReady = needsSave
        ? saveProgramToDb(programData, "coach").then((saved) => {
            const idx = clientPrograms.findIndex((c) => c.id === cp.id);
            if (idx >= 0) {
              // Merge real DB IDs into current programData (preserving any edits made since save started)
              const current = clientPrograms[idx];
              const merged = mergeDbIds(current.programData, saved);
              clientPrograms[idx] = { ...current, programId: saved.id, programData: merged };
              emitChange();
            }
            return saved.id;
          })
        : Promise.resolve(programData.id);

      programReady
        .then((realId) => assignProgramToClient(clientId, realId, new Date().toISOString().split("T")[0]))
        .then((assignment) => {
          // Store real Supabase assignment ID — keep local id stable for UI references
          const idx = clientPrograms.findIndex((c) => c.id === cp.id);
          if (idx >= 0 && assignment?.id) {
            clientPrograms[idx] = { ...clientPrograms[idx], assignmentDbId: String(assignment.id) };
            emitChange();
          }
        })
        .catch((err) => console.error("[addProgram] Supabase sync failed:", err));
    }

    return cp.id;
  },

  createEmptyProgram(clientId: string, name: string) {
    const now = Date.now();
    const programData: ProgramWithPhases = {
      id: now,
      coach_id: "coach-1",
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
    const cp: ClientProgram = {
      id: "cp-" + now,
      clientId,
      programId: now,
      status: "inactive",
      assignedAt: new Date().toISOString(),
      startDate: new Date().toISOString().split("T")[0],
      programData,
    };
    clientPrograms = [...clientPrograms, cp];
    emitChange();

    // Fire-and-forget: save program to DB then create assignment
    // Only attempt assignment if clientId is a real UUID
    if (isSupabaseConfigured()) {
      saveProgramToDb(programData, "coach")
        .then((saved) => {
          // Merge real DB IDs into current programData (preserving any edits made since save started)
          const idx = clientPrograms.findIndex((c) => c.id === cp.id);
          if (idx >= 0) {
            const current = clientPrograms[idx];
            const merged = mergeDbIds(current.programData, saved);
            clientPrograms[idx] = { ...current, programId: saved.id, programData: merged };
            emitChange();
          }
          // Only assign if clientId is a real UUID (mock IDs like "c1" would fail)
          if (UUID_REGEX.test(clientId)) {
            return assignProgramToClient(clientId, saved.id, new Date().toISOString().split("T")[0]);
          }
          return null;
        })
        .then((assignment) => {
          // Store real Supabase assignment ID — keep local id stable for UI references
          if (assignment?.id) {
            const idx = clientPrograms.findIndex((c) => c.id === cp.id);
            if (idx >= 0) {
              clientPrograms[idx] = { ...clientPrograms[idx], assignmentDbId: String(assignment.id) };
              emitChange();
            }
          }
        })
        .catch((err) => console.error("[createEmptyProgram] Supabase sync failed:", err));
    }

    return cp.id;
  },

  updateProgramData(clientProgramId: string, fn: (p: ProgramWithPhases) => void) {
    clientPrograms = clientPrograms.map((cp) => {
      if (cp.id !== clientProgramId) return cp;
      const newData: ProgramWithPhases = JSON.parse(JSON.stringify(cp.programData));
      fn(newData);
      return { ...cp, programData: newData };
    });
    emitChange();
  },

  /** Persist the current program data to Supabase. Call when the coach finishes editing. */
  persistProgramData(clientProgramId: string) {
    if (!isSupabaseConfigured()) return;
    const cp = clientPrograms.find((c) => c.id === clientProgramId);
    if (!cp) return;
    saveProgramToDb(cp.programData, "coach")
      .then((saved) => {
        // Merge real DB IDs into current programData (preserving any edits made since save started)
        const idx = clientPrograms.findIndex((c) => c.id === clientProgramId);
        if (idx >= 0) {
          const current = clientPrograms[idx];
          const merged = mergeDbIds(current.programData, saved);
          clientPrograms[idx] = { ...current, programId: saved.id, programData: merged };
          emitChange();
        }
        console.log("[persistProgramData] ✅ Saved program to Supabase, id:", saved.id);
      })
      .catch((err) => console.error("[persistProgramData] Supabase save failed:", err));
  },

  toggleStatus(clientProgramId: string) {
    const cp = clientPrograms.find((c) => c.id === clientProgramId);
    const newStatus = cp?.status === "active" ? "inactive" : "active";
    clientPrograms = clientPrograms.map((cp) => {
      if (cp.id !== clientProgramId) return cp;
      return { ...cp, status: newStatus };
    });
    emitChange();

    // Use assignmentDbId for Supabase operations (real DB ID)
    const dbId = cp?.assignmentDbId ?? clientProgramId;
    if (isSupabaseConfigured() && isSupabaseAssignmentId(dbId)) {
      updateAssignmentStatus(dbId, newStatus).catch((err) =>
        console.error("[toggleStatus] Supabase update failed:", err)
      );
    }
  },

  removeProgram(clientProgramId: string) {
    // Look up assignmentDbId before removing from array
    const cp = clientPrograms.find((c) => c.id === clientProgramId);
    const dbId = cp?.assignmentDbId ?? clientProgramId;
    clientPrograms = clientPrograms.filter((cp) => cp.id !== clientProgramId);
    emitChange();

    // Use assignmentDbId for Supabase operations (real DB ID)
    if (isSupabaseConfigured() && isSupabaseAssignmentId(dbId)) {
      removeClientAssignment(dbId).catch((err) =>
        console.error("[removeProgram] Supabase delete failed:", err)
      );
    }
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useClientPrograms(clientId: string): ClientProgram[] {
  // Trigger Supabase load on first access
  useMemo(() => {
    clientProgramStore.loadFromSupabase(clientId);
  }, [clientId]);

  const getSnapshot = useMemo(
    () => () => clientProgramStore.getProgramsForClient(clientId),
    [clientId]
  );
  return useSyncExternalStore(clientProgramStore.subscribe, getSnapshot, getSnapshot);
}
