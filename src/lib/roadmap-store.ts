import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { ClientRoadmap, RoadmapPhaseBlock, RoadmapEvent, RoadmapStat } from "./types";
import { fetchClientRoadmap, saveClientRoadmap } from "./supabase/db";

// ==========================================
// Roadmap Store — Supabase-backed
// Saves ONLY on explicit save(), never on mutation.
// ==========================================

let roadmaps: ClientRoadmap[] = [];
const listeners = new Set<() => void>();
const roadmapCache = new Map<string, ClientRoadmap | undefined>();

/** Track which clients have been hydrated this page session */
let lastHydratedAt = new Map<string, number>();
const HYDRATE_STALE_MS = 5_000; // re-fetch if older than 5 s

function emitChange() {
  roadmapCache.clear();
  listeners.forEach((l) => l());
}

/** Mutate in-memory only — no Supabase save */
function updateRoadmap(clientId: string, fn: (r: ClientRoadmap) => ClientRoadmap) {
  roadmaps = roadmaps.map((r) => (r.clientId === clientId ? fn(r) : r));
  emitChange();
}

export const roadmapStore = {
  getRoadmapForClient(clientId: string): ClientRoadmap | undefined {
    if (roadmapCache.has(clientId)) return roadmapCache.get(clientId);
    const result = roadmaps.find((r) => r.clientId === clientId);
    roadmapCache.set(clientId, result);
    return result;
  },

  /** Hydrate from Supabase for a specific client (re-fetches if stale) */
  async hydrate(clientId: string) {
    const lastTs = lastHydratedAt.get(clientId) ?? 0;
    if (Date.now() - lastTs < HYDRATE_STALE_MS) return;
    try {
      const data = await fetchClientRoadmap(clientId);
      if (data) {
        const roadmap: ClientRoadmap = {
          clientId,
          year: data.year,
          phases: (data.phases ?? []).map((p: Record<string, unknown>) => ({
            id: String(p.id),
            name: p.name as string,
            color: (p.color as string) ?? "#666",
            description: (p.description as string) ?? "",
          })),
          phaseAssignments: data.phaseAssignments ?? {},
          weekNotes: data.weekNotes ?? [],
          events: (data.events ?? []).map((e: Record<string, unknown>) => ({
            id: String(e.id),
            name: e.name as string,
            color: (e.color as string) ?? "#666",
            startWeek: Number(e.start_week ?? e.startWeek),
            lengthWeeks: Number(e.length_weeks ?? e.lengthWeeks ?? 1),
          })),
          stats: (data.stats ?? []).map((s: Record<string, unknown>) => ({
            id: String(s.id),
            label: s.label as string,
            unit: (s.unit as string) ?? "",
            isDefault: (s.is_default as boolean) ?? (s.isDefault as boolean) ?? true,
          })),
          statEntries: data.statEntries ?? [],
        };
        // Replace or add
        const idx = roadmaps.findIndex((r) => r.clientId === clientId);
        if (idx >= 0) {
          roadmaps = [...roadmaps.slice(0, idx), roadmap, ...roadmaps.slice(idx + 1)];
        } else {
          roadmaps = [...roadmaps, roadmap];
        }
        lastHydratedAt.set(clientId, Date.now());
        emitChange();
      } else {
        lastHydratedAt.set(clientId, Date.now());
      }
    } catch (err) {
      console.error("[roadmapStore] hydrate failed:", err);
    }
  },

  /** Force re-fetch from DB (ignores staleness check) */
  async forceHydrate(clientId: string) {
    lastHydratedAt.delete(clientId);
    await this.hydrate(clientId);
  },

  /** Persist current in-memory state to Supabase, then re-hydrate to sync IDs */
  async save(clientId: string): Promise<void> {
    const current = roadmaps.find((r) => r.clientId === clientId);
    if (!current) return;
    try {
      await saveClientRoadmap(clientId, current);
      // Re-hydrate to get fresh DB-generated IDs
      await this.forceHydrate(clientId);
    } catch (err) {
      console.error("[roadmapStore] save failed:", err);
      throw err;
    }
  },

  /** Discard unsaved in-memory changes by re-fetching from DB */
  async discard(clientId: string): Promise<void> {
    await this.forceHydrate(clientId);
  },

  createRoadmap(clientId: string) {
    const defaultStats: RoadmapStat[] = [
      { id: "rs1", label: "RPE", unit: "", isDefault: true },
      { id: "rs2", label: "Weekly Volume", unit: "kg", isDefault: true },
      { id: "rs3", label: "Frequency", unit: "sessions", isDefault: true },
      { id: "rs4", label: "CV", unit: "mins", isDefault: true },
      { id: "rs5", label: "Steps", unit: "steps", isDefault: true },
      { id: "rs6", label: "Bodyweight", unit: "lbs", isDefault: true },
      { id: "rs7", label: "Daily kCal", unit: "kCal", isDefault: true },
    ];
    const newRoadmap: ClientRoadmap = {
      clientId,
      year: new Date().getFullYear(),
      phases: [],
      phaseAssignments: {},
      weekNotes: [],
      events: [],
      stats: defaultStats,
      statEntries: [],
    };
    roadmaps = [...roadmaps, newRoadmap];
    emitChange();
    // Initial creation persists immediately
    saveClientRoadmap(clientId, newRoadmap)
      .then(() => this.forceHydrate(clientId))
      .catch((err) => console.error("[roadmapStore] createRoadmap save failed:", err));
  },

  // ── Phases ──

  addPhase(clientId: string, phase: RoadmapPhaseBlock) {
    updateRoadmap(clientId, (r) => ({ ...r, phases: [...r.phases, phase] }));
  },

  updatePhase(clientId: string, phaseId: string, updates: Partial<RoadmapPhaseBlock>) {
    updateRoadmap(clientId, (r) => ({
      ...r,
      phases: r.phases.map((p) => (p.id === phaseId ? { ...p, ...updates } : p)),
    }));
  },

  removePhase(clientId: string, phaseId: string) {
    updateRoadmap(clientId, (r) => {
      const newAssignments = { ...r.phaseAssignments };
      for (const [wk, pid] of Object.entries(newAssignments)) {
        if (pid === phaseId) delete newAssignments[Number(wk)];
      }
      return {
        ...r,
        phases: r.phases.filter((p) => p.id !== phaseId),
        phaseAssignments: newAssignments,
      };
    });
  },

  // ── Phase Assignments ──

  setPhaseAssignment(clientId: string, week: number, phaseId: string) {
    updateRoadmap(clientId, (r) => ({
      ...r,
      phaseAssignments: { ...r.phaseAssignments, [week]: phaseId },
    }));
  },

  clearPhaseAssignment(clientId: string, week: number) {
    updateRoadmap(clientId, (r) => {
      const newAssignments = { ...r.phaseAssignments };
      delete newAssignments[week];
      return { ...r, phaseAssignments: newAssignments };
    });
  },

  // ── Week Notes ──

  setWeekNote(clientId: string, week: number, text: string) {
    updateRoadmap(clientId, (r) => {
      const filtered = r.weekNotes.filter((n) => n.week !== week);
      return { ...r, weekNotes: [...filtered, { week, text }] };
    });
  },

  removeWeekNote(clientId: string, week: number) {
    updateRoadmap(clientId, (r) => ({
      ...r,
      weekNotes: r.weekNotes.filter((n) => n.week !== week),
    }));
  },

  // ── Events ──

  addEvent(clientId: string, event: RoadmapEvent) {
    updateRoadmap(clientId, (r) => ({ ...r, events: [...r.events, event] }));
  },

  updateEvent(clientId: string, eventId: string, updates: Partial<RoadmapEvent>) {
    updateRoadmap(clientId, (r) => ({
      ...r,
      events: r.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
    }));
  },

  removeEvent(clientId: string, eventId: string) {
    updateRoadmap(clientId, (r) => ({
      ...r,
      events: r.events.filter((e) => e.id !== eventId),
    }));
  },

  // ── Stats ──

  addStat(clientId: string, stat: RoadmapStat) {
    updateRoadmap(clientId, (r) => ({ ...r, stats: [...r.stats, stat] }));
  },

  removeStat(clientId: string, statId: string) {
    updateRoadmap(clientId, (r) => ({
      ...r,
      stats: r.stats.filter((s) => s.id !== statId),
      statEntries: r.statEntries.filter((e) => e.statId !== statId),
    }));
  },

  setStatEntry(clientId: string, statId: string, week: number, value: string) {
    updateRoadmap(clientId, (r) => {
      const filtered = r.statEntries.filter(
        (e) => !(e.statId === statId && e.week === week)
      );
      if (value.trim() === "") {
        return { ...r, statEntries: filtered };
      }
      return { ...r, statEntries: [...filtered, { statId, week, value }] };
    });
  },

  // ── Subscription ──

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useClientRoadmap(clientId: string): ClientRoadmap | undefined {
  const getSnapshot = useMemo(
    () => () => roadmapStore.getRoadmapForClient(clientId),
    [clientId]
  );
  return useSyncExternalStore(roadmapStore.subscribe, getSnapshot, getSnapshot);
}
