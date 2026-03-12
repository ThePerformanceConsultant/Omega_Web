"use client";

import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { Task, CoachNote } from "./types";
import {
  fetchClientTasks,
  createClientTask,
  updateClientTask,
  deleteClientTask,
  fetchCoachNotes,
  createCoachNote,
  updateCoachNote,
  deleteCoachNote,
} from "./supabase/db";
import { createClient } from "./supabase/client";

// =============================================
// Supabase-backed store for client tasks & notes
// =============================================

let tasks: Task[] = [];
let notes: CoachNote[] = [];
const listeners = new Set<() => void>();

const taskCache = new Map<string, Task[]>();
const noteCache = new Map<string, CoachNote[]>();
const _hydratedClients = new Set<string>();
let _coachId: string | null = null;

async function resolveCoachId(): Promise<string | null> {
  if (_coachId) return _coachId;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      _coachId = user.id;
      return _coachId;
    }
  } catch (err) {
    console.error("[clientStore] resolveCoachId failed:", err);
  }
  return null;
}

function emitChange() {
  taskCache.clear();
  noteCache.clear();
  listeners.forEach((l) => l());
}

function fromDbTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    clientId: row.client_id as string,
    title: row.title as string,
    completed: (row.completed as boolean) ?? false,
    completedAt: (row.completed_at as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    owner: (row.owner as "coach" | "client") ?? "coach",
    isWeeklyFocus: (row.is_weekly_focus as boolean) ?? false,
    createdAt: row.created_at as string,
  };
}

function fromDbNote(row: Record<string, unknown>): CoachNote {
  return {
    id: String(row.id),
    clientId: row.client_id as string,
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

export const clientStore = {
  /** Set the coach ID for creating tasks/notes */
  setCoachId(id: string) {
    _coachId = id;
  },

  /** Hydrate tasks & notes for a specific client */
  async hydrateClient(clientId: string) {
    if (_hydratedClients.has(clientId)) return;
    // Fetch independently so one failure doesn't block the other
    const [taskRows, noteRows] = await Promise.all([
      fetchClientTasks(clientId).catch((err) => {
        console.warn("[clientStore] fetchClientTasks failed:", err?.message ?? err);
        return [] as Record<string, unknown>[];
      }),
      fetchCoachNotes(clientId).catch((err) => {
        console.warn("[clientStore] fetchCoachNotes failed:", err?.message ?? err);
        return [] as Record<string, unknown>[];
      }),
    ]);
    // Merge — replace any existing for this client
    tasks = [
      ...tasks.filter((t) => t.clientId !== clientId),
      ...(taskRows ?? []).map(fromDbTask),
    ];
    notes = [
      ...notes.filter((n) => n.clientId !== clientId),
      ...(noteRows ?? []).map(fromDbNote),
    ];
    _hydratedClients.add(clientId);
    emitChange();
  },

  getTasksForClient(clientId: string): Task[] {
    const cached = taskCache.get(clientId);
    if (cached) return cached;
    const result = tasks
      .filter((t) => t.clientId === clientId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    taskCache.set(clientId, result);
    return result;
  },

  async addTask(task: Omit<Task, "id" | "createdAt">) {
    // Enforce weekly focus max of 3
    if (task.isWeeklyFocus && task.owner === "client") {
      const existing = tasks.filter(
        (t) => t.clientId === task.clientId && t.isWeeklyFocus && !t.completed
      );
      if (existing.length >= 3) return;
    }

    // Optimistic local update
    const tempId = `temp-${Date.now()}`;
    const newTask: Task = {
      ...task,
      id: tempId,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    tasks = [...tasks, newTask];
    emitChange();

    // Persist to Supabase
    const coachId = await resolveCoachId();
    if (!coachId) {
      console.error("[clientStore] addTask: no coachId — task not persisted");
      return;
    }
    try {
      const saved = await createClientTask({
        coachId,
        clientId: task.clientId,
        title: task.title,
        dueDate: task.dueDate,
        owner: task.owner,
        isWeeklyFocus: task.isWeeklyFocus,
      });
      tasks = tasks.map((t) => t.id === tempId ? fromDbTask(saved) : t);
      emitChange();
    } catch (err) {
      console.error("[clientStore] addTask failed:", err);
    }
  },

  async toggleTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newCompleted = !task.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : null;
    tasks = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: newCompleted, completedAt: newCompletedAt } : t
    );
    emitChange();

    try {
      await updateClientTask(taskId, { completed: newCompleted, completed_at: newCompletedAt });
    } catch (err) {
      console.error("[clientStore] toggleTask failed:", err);
    }
  },

  async removeTask(taskId: string) {
    tasks = tasks.filter((t) => t.id !== taskId);
    emitChange();

    try {
      await deleteClientTask(taskId);
    } catch (err) {
      console.error("[clientStore] removeTask failed:", err);
    }
  },

  getNotesForClient(clientId: string): CoachNote[] {
    const cached = noteCache.get(clientId);
    if (cached) return cached;
    const result = notes
      .filter((n) => n.clientId === clientId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    noteCache.set(clientId, result);
    return result;
  },

  async addNote(clientId: string, content: string) {
    const tempId = `temp-${Date.now()}`;
    const newNote: CoachNote = {
      id: tempId,
      clientId,
      content,
      createdAt: new Date().toISOString(),
    };
    notes = [...notes, newNote];
    emitChange();

    const coachId = await resolveCoachId();
    if (!coachId) {
      console.error("[clientStore] addNote: no coachId — note not persisted");
      return;
    }
    try {
      const saved = await createCoachNote(coachId, clientId, content);
      notes = notes.map((n) => n.id === tempId ? fromDbNote(saved) : n);
      emitChange();
    } catch (err) {
      console.error("[clientStore] addNote failed:", err);
    }
  },

  async updateNote(noteId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;

    const original = notes.find((n) => n.id === noteId);
    if (!original) return;

    notes = notes.map((n) => (n.id === noteId ? { ...n, content: trimmed } : n));
    emitChange();

    try {
      const saved = await updateCoachNote(noteId, trimmed);
      notes = notes.map((n) => (n.id === noteId ? fromDbNote(saved) : n));
      emitChange();
    } catch (err) {
      notes = notes.map((n) => (n.id === noteId ? original : n));
      emitChange();
      console.error("[clientStore] updateNote failed:", err);
    }
  },

  async removeNote(noteId: string) {
    const removed = notes.find((n) => n.id === noteId);
    if (!removed) return;

    notes = notes.filter((n) => n.id !== noteId);
    emitChange();

    try {
      await deleteCoachNote(noteId);
    } catch (err) {
      notes = [...notes, removed].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      emitChange();
      console.error("[clientStore] removeNote failed:", err);
    }
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useClientTasks(clientId: string): Task[] {
  const getSnapshot = useMemo(
    () => () => clientStore.getTasksForClient(clientId),
    [clientId]
  );
  return useSyncExternalStore(clientStore.subscribe, getSnapshot, getSnapshot);
}

export function useCoachNotes(clientId: string): CoachNote[] {
  const getSnapshot = useMemo(
    () => () => clientStore.getNotesForClient(clientId),
    [clientId]
  );
  return useSyncExternalStore(clientStore.subscribe, getSnapshot, getSnapshot);
}
