"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  AutomationAssignableFolder,
  AutomationTemplate,
  ClientAutomationAssignment,
} from "@/lib/types";
import {
  assignAutomationTemplateToClient,
  fetchAutomationAssignableFolders,
  fetchClientAutomations,
  fetchCoachAutomationTemplates,
  runDueAutomationSteps,
  upsertAutomationTemplate,
} from "@/lib/supabase/db";
import {
  AutomationTemplateStepEditor,
  createAutomationStepDraft,
  type AutomationStepDraft,
} from "@/components/automations/template-step-editor";

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

export function AutomationsTab({ clientId }: { clientId: string }) {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [assignments, setAssignments] = useState<ClientAutomationAssignment[]>([]);
  const [courseFolders, setCourseFolders] = useState<AutomationAssignableFolder[]>([]);
  const [resourceFolders, setResourceFolders] = useState<AutomationAssignableFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [mode, setMode] = useState<"existing" | "create">("existing");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [steps, setSteps] = useState<AutomationStepDraft[]>([createAutomationStepDraft(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingFolders, setRefreshingFolders] = useState(false);

  const refreshAssignableFolders = useCallback(async () => {
    setRefreshingFolders(true);
    try {
      const [fetchedCourseFolders, fetchedResourceFolders] = await Promise.all([
        fetchAutomationAssignableFolders("courses"),
        fetchAutomationAssignableFolders("resources"),
      ]);
      setCourseFolders(fetchedCourseFolders);
      setResourceFolders(fetchedResourceFolders);
    } finally {
      setRefreshingFolders(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await runDueAutomationSteps({ clientId, limit: 250 }).catch(() => undefined);

      const [fetchedTemplates, fetchedAssignments] = await Promise.all([
        fetchCoachAutomationTemplates(),
        fetchClientAutomations(clientId),
        refreshAssignableFolders(),
      ]);

      setTemplates(fetchedTemplates);
      setAssignments(fetchedAssignments);
    } catch (err) {
      console.error("[AutomationsTab] load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, [clientId, refreshAssignableFolders]);

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
    setSteps([createAutomationStepDraft(1)]);
    setError(null);
  }

  function openCreateFlow() {
    resetFlow();
    void refreshAssignableFolders().catch((err) => {
      console.error("[AutomationsTab] assignable refresh failed:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh Vault content.");
    });
    setShowCreateFlow(true);
  }

  function closeCreateFlow() {
    setShowCreateFlow(false);
    setSubmitting(false);
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
          <p className="text-sm text-muted">
            Step-scheduled assignments for client course/resource delivery.
          </p>
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
          <p className="text-sm text-muted">
            Assign a template to automatically deliver courses/resources over time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const progress =
              assignment.totalSteps > 0
                ? Math.round((assignment.executedSteps / assignment.totalSteps) * 100)
                : 0;
            const lastExecuted =
              assignment.steps
                .filter((step) => step.runStatus === "executed" && step.executedAt)
                .sort(
                  (a, b) =>
                    new Date(b.executedAt || 0).getTime() -
                    new Date(a.executedAt || 0).getTime(),
                )[0] ?? null;

            return (
              <details
                key={assignment.assignmentId}
                className="rounded-2xl border border-black/10 bg-white overflow-hidden group"
              >
                <summary className="list-none cursor-pointer px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {assignment.templateName}
                      </p>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${statusBadgeClasses(assignment.status)}`}
                      >
                        {assignment.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      Next due: {formatDateTime(assignment.nextDueAt)} • Last executed:{" "}
                      {formatDateTime(lastExecuted?.executedAt ?? null)}
                    </p>
                  </div>
                  <div className="w-32 hidden md:block">
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted mt-1 text-right">
                      {assignment.executedSteps}/{assignment.totalSteps} steps
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-muted transition-transform group-open:rotate-180"
                  />
                </summary>

                <div className="border-t border-black/8 px-4 py-3 space-y-2">
                  {assignment.steps.map((step) => (
                    <div
                      key={`${assignment.assignmentId}-${step.stepId}`}
                      className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          Day {step.dayOffset} • {step.title}
                        </p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full ${statusBadgeClasses(
                            step.runStatus === "executed"
                              ? "completed"
                              : step.runStatus === "failed"
                                ? "cancelled"
                                : step.runStatus === "pending"
                                  ? "active"
                                  : "paused",
                          )}`}
                        >
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
                            {item.assignmentType === "course" ? "Course" : "Resource"}:{" "}
                            {item.folderName}
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
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitFlow}
          >
            <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">Assign automation</p>
                <p className="text-xs text-muted">
                  Deliver course/resource steps to this client on a schedule.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refreshAssignableFolders().catch((err) => {
                      console.error("[AutomationsTab] manual refresh failed:", err);
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Failed to refresh Vault content.",
                      );
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-foreground hover:bg-black/[0.04]"
                >
                  <RefreshCw size={13} className={refreshingFolders ? "animate-spin" : ""} />
                  Refresh content
                </button>
                <button
                  type="button"
                  onClick={closeCreateFlow}
                  className="p-1.5 rounded-lg hover:bg-black/[0.04] text-muted"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    mode === "existing"
                      ? "border-accent bg-accent/5"
                      : "border-black/10 hover:bg-black/[0.02]"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">Use existing template</p>
                  <p className="text-xs text-muted mt-1">{templates.length} templates available</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    mode === "create"
                      ? "border-accent bg-accent/5"
                      : "border-black/10 hover:bg-black/[0.02]"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">Create new template</p>
                  <p className="text-xs text-muted mt-1">
                    Build a step schedule with day offsets.
                  </p>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                {mode === "existing" ? (
                  <div className="space-y-3">
                    <label className="space-y-1 block">
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
                    </label>

                    {selectedTemplate && (
                      <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {selectedTemplate.name}
                            </p>
                            {selectedTemplate.description && (
                              <p className="text-xs text-muted mt-1">
                                {selectedTemplate.description}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-black/[0.05] text-muted">
                            {selectedTemplate.steps.length}{" "}
                            {selectedTemplate.steps.length === 1 ? "step" : "steps"}
                          </span>
                        </div>

                        <p className="text-xs text-muted">
                          {selectedTemplate.activeAssignmentCount} active client assignments
                        </p>

                        <div className="space-y-2">
                      {selectedTemplate.steps.map((step) => (
                            <div
                              key={step.id}
                              className="rounded-xl border border-black/8 bg-white px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">
                                  Day {step.dayOffset} • {step.title}
                                </p>
                                <span className="text-[10px] px-2 py-1 rounded-full bg-accent/10 text-accent">
                                  {step.assignments.length}{" "}
                                  {step.assignments.length === 1
                                    ? "assignment"
                                    : "assignments"}
                                </span>
                              </div>
                              {step.message && (
                                <p className="text-xs text-muted mt-1">{step.message}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {step.assignments.map((assignment) => (
                                  <span
                                    key={assignment.id}
                                    className="text-[10px] px-2 py-1 rounded-full bg-black/[0.04] text-foreground"
                                  >
                                    {assignment.assignmentType === "course"
                                      ? "Course"
                                      : "Resource"}
                                    : {assignment.folderName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
                    <span className="text-xs font-semibold text-muted">
                      Description (optional)
                    </span>
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
                  />
                </>
              )}

              {totalAssignableCount === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No assignable course or resource folders are available right now. If you added
                  content in Vault recently, use “Refresh content” to pull the latest folders and
                  nested items.
                </div>
              )}

              {(courseFolders.length > 0 || resourceFolders.length > 0) && mode === "create" && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {[...courseFolders, ...resourceFolders].slice(0, 4).map((folder) => (
                    <div
                      key={`${folder.section}-${folder.id}`}
                      className="rounded-2xl border border-black/10 bg-white p-4 space-y-2"
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
                              className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-1 text-[10px] text-foreground"
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
                {submitting ? (
                  <Clock3 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {submitting ? "Saving..." : "Assign automation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
