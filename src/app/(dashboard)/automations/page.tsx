"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  Workflow,
  X,
} from "lucide-react";
import type {
  AutomationAssignableFolder,
  AutomationTemplate,
} from "@/lib/types";
import {
  fetchAutomationAssignableFolders,
  fetchCoachAutomationTemplates,
  upsertAutomationTemplate,
} from "@/lib/supabase/db";
import {
  AutomationTemplateStepEditor,
  createAutomationStepDraft,
  type AutomationStepDraft,
} from "@/components/automations/template-step-editor";

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
    parts.push(
      `${folder.descendantItemCount} ${folder.descendantItemCount === 1 ? "item" : "items"}`,
    );
  }
  if (parts.length === 0) return "No nested content yet";
  return parts.join(" • ");
}

function toStepDrafts(template: AutomationTemplate | null): AutomationStepDraft[] {
  if (!template || template.steps.length === 0) {
    return [createAutomationStepDraft(1)];
  }
  return template.steps.map((step) => ({
    id: `template-${step.id}`,
    dayOffset: step.dayOffset,
    title: step.title,
    message: step.message ?? "",
    assignments: step.assignments.map((assignment) => ({
      assignmentType: assignment.assignmentType,
      folderId: assignment.folderId,
    })),
    draftType: step.assignments[0]?.assignmentType ?? "course",
    draftFolderId: "",
  }));
}

export default function AutomationsPage() {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [courseFolders, setCourseFolders] = useState<AutomationAssignableFolder[]>([]);
  const [resourceFolders, setResourceFolders] = useState<AutomationAssignableFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AutomationTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [steps, setSteps] = useState<AutomationStepDraft[]>([createAutomationStepDraft(1)]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedTemplates, fetchedCourseFolders, fetchedResourceFolders] =
        await Promise.all([
          fetchCoachAutomationTemplates(),
          fetchAutomationAssignableFolders("courses"),
          fetchAutomationAssignableFolders("resources"),
        ]);
      setTemplates(fetchedTemplates);
      setCourseFolders(fetchedCourseFolders);
      setResourceFolders(fetchedResourceFolders);
    } catch (err) {
      console.error("[AutomationsPage] load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const activeAssignments = templates.reduce(
      (sum, template) => sum + template.activeAssignmentCount,
      0,
    );
    return {
      templates: templates.length,
      activeAssignments,
      assignableBundles: courseFolders.length + resourceFolders.length,
    };
  }, [courseFolders.length, resourceFolders.length, templates]);

  function openCreate() {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDescription("");
    setSteps([createAutomationStepDraft(1)]);
    setShowEditor(true);
    setError(null);
  }

  function openEdit(template: AutomationTemplate) {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description ?? "");
    setSteps(toStepDrafts(template));
    setShowEditor(true);
    setError(null);
  }

  function closeEditor() {
    setShowEditor(false);
    setSaving(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!templateName.trim()) {
        throw new Error("Template name is required.");
      }

      const cleanedSteps = steps.map((step, index) => ({
        dayOffset: Math.max(0, Number(step.dayOffset || 0)),
        title: (step.title || "").trim() || `Step ${index + 1}`,
        message: step.message.trim() || null,
        assignments: step.assignments,
      }));

      if (cleanedSteps.length === 0) {
        throw new Error("Add at least one step.");
      }
      if (cleanedSteps.some((step) => step.assignments.length === 0)) {
        throw new Error("Every step needs at least one course or resource assignment.");
      }

      await upsertAutomationTemplate({
        id: editingTemplate?.id ?? null,
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        isActive: true,
        steps: cleanedSteps,
      });

      closeEditor();
      await loadData();
    } catch (err) {
      console.error("[AutomationsPage] save failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/80">
            Automation Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Automations
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Build reusable course and resource delivery sequences here, then assign them from a
            client profile with richer vault context.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void loadData();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-black/12 px-4 py-2 text-sm font-semibold text-foreground hover:bg-black/[0.04]"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent to-accent-light px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={15} />
            New template
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-accent/10 p-3 text-accent">
              <Workflow size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Templates
              </p>
              <p className="text-2xl font-semibold text-foreground">{stats.templates}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-accent/10 p-3 text-accent">
              <Users size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Live assignments
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {stats.activeAssignments}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-accent/10 p-3 text-accent">
              <Bot size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Assignable bundles
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {stats.assignableBundles}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-card border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-muted">
          Loading automations...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Template library</h2>
              <p className="text-xs text-muted">
                Reusable delivery schedules for courses and resources.
              </p>
            </div>

            {templates.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <Bot size={28} className="mx-auto text-muted/60" />
                <p className="mt-3 text-base font-semibold text-foreground">
                  No automation templates yet
                </p>
                <p className="mt-1 text-sm text-muted">
                  Create a template here, then assign it from a client profile.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="glass-card p-5 space-y-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground">
                            {template.name}
                          </h3>
                          <span className="rounded-full bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent">
                            {template.steps.length} {template.steps.length === 1 ? "step" : "steps"}
                          </span>
                          <span className="rounded-full bg-black/[0.05] px-2 py-1 text-[11px] font-medium text-muted">
                            {template.activeAssignmentCount} active clients
                          </span>
                        </div>
                        {template.description && (
                          <p className="mt-2 text-sm text-muted">
                            {template.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => openEdit(template)}
                        className="inline-flex items-center gap-2 rounded-full border border-black/12 px-4 py-2 text-sm font-semibold text-foreground hover:bg-black/[0.04]"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                    </div>

                    <div className="space-y-2">
                      {template.steps.map((step) => (
                        <div
                          key={step.id}
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">
                              Day {step.dayOffset} • {step.title}
                            </p>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-black/[0.04] text-muted">
                              {step.assignments.length}{" "}
                              {step.assignments.length === 1 ? "assignment" : "assignments"}
                            </span>
                          </div>
                          {step.message && (
                            <p className="mt-1 text-xs text-muted">{step.message}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {step.assignments.map((assignment) => (
                              <span
                                key={assignment.id}
                                className="rounded-full bg-accent/10 px-2 py-1 text-[10px] text-accent"
                              >
                                {assignment.assignmentType === "course" ? "Course" : "Resource"}:{" "}
                                {assignment.folderName}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Assignable vault bundles</h2>
              <p className="text-xs text-muted">
                Course and resource folders, including nested modules and lessons, that automations can unlock.
              </p>
            </div>

            {[...courseFolders, ...resourceFolders].length === 0 ? (
              <div className="glass-card p-8 text-sm text-muted">
                No assignable course or resource folders are available yet.
              </div>
            ) : (
              <div className="space-y-3">
                {[...courseFolders, ...resourceFolders].map((folder) => (
                  <div
                    key={`${folder.section}-${folder.id}`}
                    className="glass-card p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {folder.pathLabel}
                        </p>
                        {folder.description && (
                          <p className="text-xs text-muted mt-1 line-clamp-2">
                            {folder.description}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-black/[0.04] text-muted whitespace-nowrap">
                        {folder.section === "courses" ? "Course" : "Resource"}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted">{describeFolder(folder)}</p>

                    {folder.previewItems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {folder.previewItems.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-full bg-black/[0.04] px-2 py-1 text-[10px] text-foreground"
                            title={item.folderName}
                          >
                            {item.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {showEditor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
          onClick={closeEditor}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
            className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
          >
            <div className="border-b border-black/10 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {editingTemplate ? "Edit automation template" : "Create automation template"}
                </p>
                <p className="text-xs text-muted">
                  Build reusable delivery steps, then assign them from a client profile.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="p-1.5 rounded-lg text-muted hover:bg-black/[0.04]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-muted">Template name</span>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. New client onboarding"
                  className="w-full rounded-lg border border-black/12 bg-black/[0.03] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-muted">Description (optional)</span>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-black/12 bg-black/[0.03] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 resize-none"
                />
              </label>

              <AutomationTemplateStepEditor
                steps={steps}
                onChange={setSteps}
                courseFolders={courseFolders}
                resourceFolders={resourceFolders}
                disabled={saving}
              />
            </div>

            <div className="border-t border-black/10 px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-black/[0.04]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-accent-light px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {saving ? "Saving..." : editingTemplate ? "Update template" : "Create template"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
