"use client";

import { useSyncExternalStore } from "react";
import { FormTemplate } from "./types";
import {
  fetchFormTemplatesWithQuestions,
  saveFormTemplateWithQuestions,
  deleteFormTemplate as deleteFormTemplateDb,
  createFormAssignment,
  fetchFormAssignmentsForTemplate,
  removeFormAssignment,
} from "./supabase/db";

// =============================================
// Supabase-backed store for form templates
// Shared across pages with reactive updates.
// =============================================

let templates: FormTemplate[] = [];
const listeners = new Set<() => void>();
let hydrated = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emitChange() {
  listeners.forEach((l) => l());
}

export const formStore = {
  getTemplates() {
    return templates;
  },

  getById(id: number) {
    return templates.find((t) => t.id === id);
  },

  /** Hydrate from Supabase — call once on page load */
  async hydrate(coachId?: string) {
    if (hydrated) return;
    try {
      const fetched = await fetchFormTemplatesWithQuestions(coachId);
      templates = fetched as FormTemplate[];
      hydrated = true;
      emitChange();
    } catch (err) {
      console.error("[formStore] hydrate failed:", err);
    }
  },

  /** Force re-fetch from Supabase */
  async refresh(coachId?: string) {
    try {
      const fetched = await fetchFormTemplatesWithQuestions(coachId);
      templates = fetched as FormTemplate[];
      hydrated = true;
      emitChange();
    } catch (err) {
      console.error("[formStore] refresh failed:", err);
    }
  },

  async add(t: FormTemplate): Promise<number> {
    templates = [...templates, t];
    emitChange();
    const dbId = await saveFormTemplateWithQuestions(t, t.coachId);
    templates = templates.map((x) => (x.id === t.id ? { ...x, id: dbId } : x));
    emitChange();
    return dbId;
  },

  update(t: FormTemplate) {
    templates = templates.map((x) => (x.id === t.id ? t : x));
    emitChange();
    // Debounce Supabase save to prevent concurrent DELETE+INSERT race conditions
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveFormTemplateWithQuestions(t, t.coachId).catch((err) =>
        console.error("[formStore] update failed:", err)
      );
      saveTimer = null;
    }, 500);
  },

  remove(id: number) {
    const target = templates.find((t) => t.id === id);
    if (target && (target.formType === "onboarding" || target.formType === "nutrition_intake")) return;
    templates = templates.filter((t) => t.id !== id);
    emitChange();
    deleteFormTemplateDb(id).catch((err) =>
      console.error("[formStore] remove failed:", err)
    );
  },

  duplicate(original: FormTemplate) {
    const dup: FormTemplate = {
      ...structuredClone(original),
      id: Date.now(),
      name: original.name + " (Copy)",
      assignedClientIds: [],
      createdAt: new Date().toISOString().split("T")[0],
    };
    templates = [...templates, dup];
    emitChange();
    saveFormTemplateWithQuestions(dup, dup.coachId).then((dbId) => {
      templates = templates.map((x) => (x.id === dup.id ? { ...x, id: dbId } : x));
      emitChange();
    }).catch((err) => console.error("[formStore] duplicate failed:", err));
    return dup;
  },

  /** Assign a client to a template — creates form_assignment in Supabase */
  async assignClient(templateId: number, clientId: string, dueDate?: string, displayDays?: number) {
    const due = dueDate ?? new Date().toISOString().split("T")[0];
    try {
      await createFormAssignment(templateId, clientId, due, displayDays);
    } catch (err) {
      console.error("[formStore] assignClient failed:", err);
    }
  },

  /** Remove a client assignment */
  async unassignClient(templateId: number, clientId: string) {
    try {
      await removeFormAssignment(templateId, clientId);
    } catch (err) {
      console.error("[formStore] unassignClient failed:", err);
    }
  },

  /** Fetch assigned client IDs for a template */
  async fetchAssignedClients(templateId: number): Promise<string[]> {
    try {
      return await fetchFormAssignmentsForTemplate(templateId);
    } catch (err) {
      console.error("[formStore] fetchAssignedClients failed:", err);
      return [];
    }
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Reactive hook — re-renders when templates change. */
export function useFormTemplates(): FormTemplate[] {
  return useSyncExternalStore(
    formStore.subscribe,
    formStore.getTemplates,
    formStore.getTemplates
  );
}
