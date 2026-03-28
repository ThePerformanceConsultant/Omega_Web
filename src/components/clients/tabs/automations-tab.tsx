"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  AutomationAssignmentType,
  AutomationTemplate,
  ClientAutomationAssignment,
} from "@/lib/types";
import {
  assignAutomationTemplateToClient,
  fetchClientAutomations,
  fetchCoachAutomationTemplates,
  fetchVaultFolders,
  runDueAutomationSteps,
  upsertAutomationTemplate,
} from "@/lib/supabase/db";

type AssignableFolder = {
  id: number;
  name: string;
  section: "courses" | "resources";
};

type StepDraft = {
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

function createStepDraft(order: number): StepDraft {
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

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClasses(status: ClientAutomationAssignment["status"]): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "paused":
      return "bg-amber-100 text-amber-700";
    case "completed":
      return "bg-sky-100 text-sky-700";
    default:
      return "bg-black/10 text-muted";
  }
}

export function AutomationsTab({ clientId }: { clientId: string }) {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [assignments, setAssignments] = useState<ClientAutomationAssignment[]>([]);
  const [courseFolders, setCourseFolders] = useState<AssignableFolder[]>([]);
  const [resourceFolders, setResourceFolders] = useState<AssignableFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [mode, setMode] = useState<"existing" | "create">("existing");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([createStepDraft(1)]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await runDueAutomationSteps({ clientId, limit: 250 }).catch(() => undefined);

      const [fetchedTemplates, fetchedAssignments, fetchedCourseFolders, fetchedResourceFolders] =
        await Promise.all([
          fetchCoachAutomationTemplates(),
          fetchClientAutomations(clientId),
          fetchVaultFolders("courses", null),
          fetchVaultFolders("resources", null),
        ]);

      setTemplates(fetchedTemplates);
      setAssignments(fetchedAssignments);
      setCourseFolders(
        (fetchedCourseFolders ?? []).map((row: Record<string, unknown>) => ({
          id: Number(row.id),
          name: String(row.name ?? "Untitled"),
          section: "courses",
        })),
      );
      setResourceFolders(
        (fetchedResourceFolders ?? []).map((row: Record<string, unknown>) => ({
          id: Number(row.id),
          name: String(row.name ?? "Untitled"),
          section: "resources",
        })),
      );
    } catch (err) {
      console.error("[AutomationsTab] load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedTemplate = useMemo(
    () => templates.find((entry) => entry.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const totalAssignableCount = courseFolders.length + resourceFolders.length;

  function resetFlow() {
    setMode(templates.length > 0 ? "existing" : "create");
    setSelectedTemplateId(templates[0]?.id ?? "");
    setStartDate(new Date().toISOString().slice(0, 10));
    setTemplateName("");
    setTemplateDescription("");
    setSteps([createStepDraft(1)]);
    setError(null);
  }

  function openCreateFlow() {
    resetFlow();
    setShowCreateFlow(true);
  }

  function closeCreateFlow() {
    setShowCreateFlow(false);
    setSubmitting(false);
  }

  function updateStep(stepId: string, updater: (step: StepDraft) => StepDraft) {
    setSteps((prev) => prev.map((step) => (step.id === stepId ? updater(step) : step)));
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

  async function handleSubmitFlow(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let templateId: number | null = null;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";

      if (mode === "existing") {
        if (selectedTemplateId === "") {
          throw new Error("Select a template to assign.");
        }
        templateId = Number(selectedTemplateId);
      } else {
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

        const template = await upsertAutomationTemplate({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          isActive: true,
          steps: cleanedSteps,
        });
        templateId = template?.id ?? null;
      }

      if (!templateId) {
        throw new Error("Unable to create/select automation template.");
      }

      await assignAutomationTemplateToClient({
        templateId,
        clientId,
        startDate,
        timezone,
      });

      closeCreateFlow();
      await loadData();
    } catch (err) {
      console.error("[AutomationsTab] submit failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save automation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="glass-card p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Automations</h3>
          <p className="text-sm text-muted">Step-scheduled assignments for client course/resource delivery.</p>
        </div>
        <button
          onClick={openCreateFlow}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/15 text-sm font-semibold text-foreground hover:bg-black/[0.04] transition-colors"
        >
          <Plus size={15} />
          Add automation
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted">Loading automations...</div>
      ) : assignments.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center border border-black/10 rounded-2xl bg-black/[0.02]">
          <Bot size={28} className="text-muted/60" />
          <p className="text-base font-semibold text-foreground">No automations assigned</p>
          <p className="text-sm text-muted">Assign a template to automatically deliver courses/resources over time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const progress = assignment.totalSteps > 0
              ? Math.round((assignment.executedSteps / assignment.totalSteps) * 100)
              : 0;
            const lastExecuted = assignment.steps
              .filter((step) => step.runStatus === "executed" && step.executedAt)
              .sort((a, b) => new Date(b.executedAt || 0).getTime() - new Date(a.executedAt || 0).getTime())[0] ?? null;

            return (
              <details key={assignment.assignmentId} className="rounded-2xl border border-black/10 bg-white overflow-hidden group">
                <summary className="list-none cursor-pointer px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{assignment.templateName}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusBadgeClasses(assignment.status)}`}>
                        {assignment.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      Next due: {formatDateTime(assignment.nextDueAt)} • Last executed: {formatDateTime(lastExecuted?.executedAt ?? null)}
                    </p>
                  </div>
                  <div className="w-32 hidden md:block">
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[11px] text-muted mt-1 text-right">{assignment.executedSteps}/{assignment.totalSteps} steps</p>
                  </div>
                  <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
                </summary>

                <div className="border-t border-black/8 px-4 py-3 space-y-2">
                  {assignment.steps.map((step) => (
                    <div key={`${assignment.assignmentId}-${step.stepId}`} className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          Day {step.dayOffset} • {step.title}
                        </p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusBadgeClasses(
                          step.runStatus === "executed"
                            ? "completed"
                            : step.runStatus === "failed"
                              ? "cancelled"
                              : step.runStatus === "pending"
                                ? "active"
                                : "paused",
                        )}`}>
                          {step.runStatus}
                        </span>
                      </div>
                      {step.message && <p className="text-xs text-muted mt-1">{step.message}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {step.assignments.map((item) => (
                          <span
                            key={`${step.stepId}-${item.assignmentType}-${item.folderId}`}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent"
                          >
                            {item.assignmentType === "course" ? "Course" : "Resource"}: {item.folderName}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {showCreateFlow && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeCreateFlow}
        >
          <form
            className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitFlow}
          >
            <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">Assign automation</p>
                <p className="text-xs text-muted">Deliver course/resource steps to this client on a schedule.</p>
              </div>
              <button type="button" onClick={closeCreateFlow} className="p-1.5 rounded-lg hover:bg-black/[0.04] text-muted">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    mode === "existing" ? "border-accent bg-accent/5" : "border-black/10 hover:bg-black/[0.02]"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">Use existing template</p>
                  <p className="text-xs text-muted mt-1">{templates.length} templates available</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    mode === "create" ? "border-accent bg-accent/5" : "border-black/10 hover:bg-black/[0.02]"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">Create new template</p>
                  <p className="text-xs text-muted mt-1">Build a step schedule with day offsets.</p>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                {mode === "existing" ? (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Template</span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) =>
                        setSelectedTemplateId(e.target.value ? Number(e.target.value) : "")
                      }
                      className="w-full rounded-lg border border-black/12 bg-black/[0.03] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                    >
                      <option value="">Select template...</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    {selectedTemplate && (
                      <p className="text-xs text-muted">
                        {selectedTemplate.steps.length} steps • {selectedTemplate.activeAssignmentCount} active client assignments
                      </p>
                    )}
                  </label>
                ) : (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Template name</span>
                    <input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Week 1 onboarding drip"
                      className="w-full rounded-lg border border-black/12 bg-black/[0.03] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                    />
                  </label>
                )}

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Start date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-black/12 bg-black/[0.03] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                  />
                </label>
              </div>

              {mode === "create" && (
                <>
                  <label className="space-y-1 block">
                    <span className="text-xs font-semibold text-muted">Description (optional)</span>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-black/12 bg-black/[0.03] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 resize-none"
                    />
                  </label>

                  <div className="space-y-3">
                    {steps.map((step, index) => {
                      const stepFolders = step.draftType === "course" ? courseFolders : resourceFolders;

                      return (
                        <div key={step.id} className="rounded-xl border border-black/10 p-3 bg-black/[0.015] space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">Step {index + 1}</p>
                            {steps.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSteps((prev) => prev.filter((entry) => entry.id !== step.id))
                                }
                                className="p-1 rounded text-muted hover:text-danger hover:bg-black/[0.05]"
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
                                value={step.dayOffset}
                                onChange={(e) =>
                                  updateStep(step.id, (entry) => ({
                                    ...entry,
                                    dayOffset: Math.max(0, Number(e.target.value || 0)),
                                  }))
                                }
                                className="w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                              />
                            </label>

                            <label className="space-y-1">
                              <span className="text-[11px] font-semibold text-muted">Title</span>
                              <input
                                value={step.title}
                                onChange={(e) =>
                                  updateStep(step.id, (entry) => ({ ...entry, title: e.target.value }))
                                }
                                className="w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                              />
                            </label>
                          </div>

                          <label className="space-y-1 block">
                            <span className="text-[11px] font-semibold text-muted">Message (optional)</span>
                            <textarea
                              rows={2}
                              value={step.message}
                              onChange={(e) =>
                                updateStep(step.id, (entry) => ({ ...entry, message: e.target.value }))
                              }
                              className="w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40 resize-none"
                            />
                          </label>

                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-muted">Assignments</p>
                            <div className="flex flex-wrap gap-1.5">
                              {step.assignments.map((assignment) => {
                                const source =
                                  assignment.assignmentType === "course"
                                    ? courseFolders
                                    : resourceFolders;
                                const folderName =
                                  source.find((folder) => folder.id === assignment.folderId)?.name ??
                                  `#${assignment.folderId}`;
                                return (
                                  <button
                                    key={`${assignment.assignmentType}-${assignment.folderId}`}
                                    type="button"
                                    onClick={() =>
                                      removeAssignmentFromStep(
                                        step.id,
                                        assignment.assignmentType,
                                        assignment.folderId,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-1 text-[10px] hover:bg-accent/20"
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
                                onChange={(e) =>
                                  updateStep(step.id, (entry) => ({
                                    ...entry,
                                    draftType: e.target.value === "resource" ? "resource" : "course",
                                    draftFolderId: "",
                                  }))
                                }
                                className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                              >
                                <option value="course">Course</option>
                                <option value="resource">Resource</option>
                              </select>

                              <select
                                value={step.draftFolderId}
                                onChange={(e) =>
                                  updateStep(step.id, (entry) => ({
                                    ...entry,
                                    draftFolderId: e.target.value ? Number(e.target.value) : "",
                                  }))
                                }
                                className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
                              >
                                <option value="">Select {step.draftType}...</option>
                                {stepFolders.map((folder) => (
                                  <option key={`${step.draftType}-${folder.id}`} value={folder.id}>
                                    {folder.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => addAssignmentToStep(step.id)}
                                disabled={step.draftFolderId === ""}
                                className="rounded-lg border border-black/12 px-3 py-2 text-sm font-medium text-foreground hover:bg-black/[0.04] disabled:opacity-50"
                              >
                                Attach
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSteps((prev) => [...prev, createStepDraft(prev.length + 1)])}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/12 text-sm text-foreground hover:bg-black/[0.04]"
                  >
                    <Plus size={14} />
                    Add step
                  </button>
                </>
              )}

              {totalAssignableCount === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Add top-level course/resource folders in Vault before creating automation steps.
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-black/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateFlow}
                className="px-4 py-2 text-sm rounded-lg text-muted hover:bg-black/[0.04]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || totalAssignableCount === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? <Clock3 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {submitting ? "Saving..." : "Assign automation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
