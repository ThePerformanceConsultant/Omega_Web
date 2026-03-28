"use client";

import { useMemo } from "react";
import { Play, Plus, Trash2, X } from "lucide-react";
import type {
  AutomationAssignableFolder,
  AutomationAssignmentType,
} from "@/lib/types";

export type AutomationStepDraft = {
  id: string;
  dayOffset: number;
  title: string;
  message: string;
  assignments: Array<{
    assignmentType: AutomationAssignmentType;
    folderId: number;
  }>;
  draftType: AutomationAssignmentType;
  draftFolderId: number | "";
};

export function createAutomationStepDraft(order: number): AutomationStepDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dayOffset: Math.max(0, order - 1),
    title: `Step ${order}`,
    message: "",
    assignments: [],
    draftType: "course",
    draftFolderId: "",
  };
}

function describeFolder(folder: AutomationAssignableFolder): string {
  const parts: string[] = [];
  if (folder.section === "courses" && folder.directChildFolderCount > 0) {
    parts.push(
      `${folder.directChildFolderCount} ${folder.directChildFolderCount === 1 ? "module" : "modules"}`,
    );
  }
  if (folder.descendantFolderCount > folder.directChildFolderCount) {
    const deeperCount = folder.descendantFolderCount - folder.directChildFolderCount;
    parts.push(`${deeperCount} nested ${deeperCount === 1 ? "folder" : "folders"}`);
  }
  if (folder.descendantItemCount > 0) {
    parts.push(`${folder.descendantItemCount} ${folder.descendantItemCount === 1 ? "item" : "items"}`);
  }
  if (parts.length === 0) return "No nested content yet";
  return parts.join(" • ");
}

export function AutomationTemplateStepEditor({
  steps,
  onChange,
  courseFolders,
  resourceFolders,
  disabled = false,
}: {
  steps: AutomationStepDraft[];
  onChange: (steps: AutomationStepDraft[]) => void;
  courseFolders: AutomationAssignableFolder[];
  resourceFolders: AutomationAssignableFolder[];
  disabled?: boolean;
}) {
  const folderLookup = useMemo(() => {
    const map = new Map<string, AutomationAssignableFolder>();
    for (const folder of [...courseFolders, ...resourceFolders]) {
      const key = folder.section === "courses" ? "course" : "resource";
      map.set(`${key}:${folder.id}`, folder);
    }
    return map;
  }, [courseFolders, resourceFolders]);

  function updateStep(stepId: string, updater: (step: AutomationStepDraft) => AutomationStepDraft) {
    onChange(steps.map((step) => (step.id === stepId ? updater(step) : step)));
  }

  function addAssignmentToStep(stepId: string) {
    updateStep(stepId, (step) => {
      if (step.draftFolderId === "") return step;
      if (
        step.assignments.some(
          (entry) =>
            entry.assignmentType === step.draftType &&
            entry.folderId === Number(step.draftFolderId),
        )
      ) {
        return step;
      }
      return {
        ...step,
        assignments: [
          ...step.assignments,
          {
            assignmentType: step.draftType,
            folderId: Number(step.draftFolderId),
          },
        ],
      };
    });
  }

  function removeAssignmentFromStep(
    stepId: string,
    assignmentType: AutomationAssignmentType,
    folderId: number,
  ) {
    updateStep(stepId, (step) => ({
      ...step,
      assignments: step.assignments.filter(
        (entry) => !(entry.assignmentType === assignmentType && entry.folderId === folderId),
      ),
    }));
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const stepFolders = step.draftType === "course" ? courseFolders : resourceFolders;
        const selectedFolder =
          step.draftFolderId === ""
            ? null
            : stepFolders.find((folder) => folder.id === Number(step.draftFolderId)) ?? null;

        return (
          <div key={step.id} className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Step {index + 1}</p>
              {steps.length > 1 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(steps.filter((entry) => entry.id !== step.id))}
                  className="p-1 rounded text-muted hover:text-danger hover:bg-black/[0.05] disabled:opacity-50"
                  title="Remove step"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-[120px_1fr] gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-muted">Day offset</span>
                <input
                  type="number"
                  min={0}
                  disabled={disabled}
                  value={step.dayOffset}
                  onChange={(e) =>
                    updateStep(step.id, (entry) => ({
                      ...entry,
                      dayOffset: Math.max(0, Number(e.target.value || 0)),
                    }))
                  }
                  className="w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 disabled:opacity-60"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-muted">Title</span>
                <input
                  value={step.title}
                  disabled={disabled}
                  onChange={(e) =>
                    updateStep(step.id, (entry) => ({ ...entry, title: e.target.value }))
                  }
                  className="w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 disabled:opacity-60"
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-[11px] font-semibold text-muted">Message (optional)</span>
              <textarea
                rows={2}
                value={step.message}
                disabled={disabled}
                onChange={(e) =>
                  updateStep(step.id, (entry) => ({ ...entry, message: e.target.value }))
                }
                className="w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 resize-none disabled:opacity-60"
              />
            </label>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted">Assignments</p>
              <div className="flex flex-wrap gap-1.5">
                {step.assignments.map((assignment) => {
                  const folder = folderLookup.get(`${assignment.assignmentType}:${assignment.folderId}`);
                  const folderName = folder?.name ?? `#${assignment.folderId}`;
                  return (
                    <button
                      key={`${assignment.assignmentType}-${assignment.folderId}`}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        removeAssignmentFromStep(
                          step.id,
                          assignment.assignmentType,
                          assignment.folderId,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-1 text-[10px] hover:bg-accent/20 disabled:opacity-60"
                      title="Remove assignment"
                    >
                      {assignment.assignmentType === "course" ? "Course" : "Resource"}: {folderName}
                      <X size={11} />
                    </button>
                  );
                })}
                {step.assignments.length === 0 && (
                  <span className="text-xs text-muted">No assignments attached.</span>
                )}
              </div>

              <div className="grid sm:grid-cols-[130px_1fr_auto] gap-2">
                <select
                  value={step.draftType}
                  disabled={disabled}
                  onChange={(e) =>
                    updateStep(step.id, (entry) => ({
                      ...entry,
                      draftType: e.target.value === "resource" ? "resource" : "course",
                      draftFolderId: "",
                    }))
                  }
                  className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 disabled:opacity-60"
                >
                  <option value="course">Course</option>
                  <option value="resource">Resource</option>
                </select>

                <select
                  value={step.draftFolderId}
                  disabled={disabled}
                  onChange={(e) =>
                    updateStep(step.id, (entry) => ({
                      ...entry,
                      draftFolderId: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 disabled:opacity-60"
                >
                  <option value="">Select {step.draftType}...</option>
                  {stepFolders.map((folder) => (
                    <option key={`${step.draftType}-${folder.id}`} value={folder.id}>
                      {folder.pathLabel}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={disabled || step.draftFolderId === ""}
                  onClick={() => addAssignmentToStep(step.id)}
                  className="rounded-lg border border-black/12 px-3 py-2 text-sm font-medium text-foreground hover:bg-black/[0.04] disabled:opacity-50"
                >
                  Attach
                </button>
              </div>

              {selectedFolder && (
                <div className="rounded-xl border border-black/10 bg-white p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {selectedFolder.pathLabel}
                      </p>
                      {selectedFolder.description && (
                        <p className="text-xs text-muted mt-1 line-clamp-2">
                          {selectedFolder.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-black/[0.04] text-muted whitespace-nowrap">
                      {selectedFolder.section === "courses" ? "Course" : "Resource"}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted">
                    {describeFolder(selectedFolder)}
                  </p>

                  {selectedFolder.previewItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFolder.previewItems.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-1 text-[10px] text-foreground"
                          title={item.folderName}
                        >
                          {item.itemType === "video" && <Play size={10} className="text-accent" />}
                          {item.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...steps, createAutomationStepDraft(steps.length + 1)])}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/12 text-sm text-foreground hover:bg-black/[0.04] disabled:opacity-50"
      >
        <Plus size={14} />
        Add step
      </button>
    </div>
  );
}
