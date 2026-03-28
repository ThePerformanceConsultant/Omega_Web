"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, Check, CheckCircle2, CircleDot, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  CheckInTimelineTag,
  ClientCheckInHistoryItem,
  ClientCheckInTemplate,
  FORM_QUESTION_TYPE_META,
  FormAnswer,
  FormQuestion,
  FormTemplate,
} from "@/lib/types";
import {
  createFormAssignment,
  fetchClientCheckInPanelData,
  fetchFormTemplatesWithQuestions,
  isDuplicateFormAssignmentError,
} from "@/lib/supabase/db";
import { clientStore, useCoachNotes } from "@/lib/client-store";
import { RichTextBlock } from "@/components/forms/RichTextBlock";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusClasses(status: ClientCheckInHistoryItem["status"]): string {
  if (status === "completed") return "bg-success/15 text-success";
  if (status === "missed") return "bg-danger/10 text-danger";
  return "bg-warning/15 text-warning";
}

function statusLabel(status: ClientCheckInHistoryItem["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "missed") return "Missed";
  return "Pending";
}

function timelineClasses(tag: CheckInTimelineTag): string {
  if (tag === "upcoming") return "bg-blue-500/12 text-blue-700";
  if (tag === "due") return "bg-warning/15 text-warning";
  if (tag === "overdue") return "bg-danger/10 text-danger";
  return "";
}

function timelineLabel(tag: CheckInTimelineTag): string {
  if (tag === "upcoming") return "Upcoming";
  if (tag === "due") return "Due";
  if (tag === "overdue") return "Overdue";
  return "";
}

function isLegacySectionHeaderQuestion(question: FormQuestion): boolean {
  if (!(question.questionType === "short_text" || question.questionType === "long_text")) return false;
  if (question.isRequired) return false;
  const body = (question.placeholder ?? "").trim();
  if (!body) return false;
  const bodyLower = body.toLowerCase();
  if (bodyLower.includes("your answer") || bodyLower.includes("type your answer")) return false;
  return body.length >= 60;
}

function SignaturePreview({ dataUrl }: { dataUrl: string }) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) {
          if (!cancelled) setProcessedSrc(dataUrl);
          return;
        }

        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
        if (!sourceCtx) {
          if (!cancelled) setProcessedSrc(dataUrl);
          return;
        }

        sourceCtx.drawImage(image, 0, 0);
        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const luminances: number[] = [];
        const totalPixelCount = width * height;
        let brightCount = 0;
        let darkCount = 0;
        let luminanceSum = 0;
        let minLum = 255;
        let maxLum = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3];
          if (alpha === 0) continue;
          const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          luminances.push(luminance);
          luminanceSum += luminance;
          if (luminance < minLum) minLum = luminance;
          if (luminance > maxLum) maxLum = luminance;
          if (luminance >= 128) brightCount += 1;
          else darkCount += 1;
        }

        if (luminances.length === 0) {
          if (!cancelled) setProcessedSrc(dataUrl);
          return;
        }

        const nonTransparentRatio = totalPixelCount > 0 ? luminances.length / totalPixelCount : 0;
        const averageLum = luminanceSum / luminances.length;
        const contrast = maxLum - minLum;
        const sparseInkOnlyCapture = nonTransparentRatio < 0.35 || contrast < 8;
        const threshold = (minLum + maxLum) / 2;
        const inkIsBright = sparseInkOnlyCapture ? averageLum >= 128 : brightCount < darkCount;
        const minAlpha = sparseInkOnlyCapture ? 0.04 : 0.1;

        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3];
          if (alpha === 0) continue;

          const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          const inkStrength = inkIsBright
            ? (luminance - threshold) / Math.max(1, 255 - threshold)
            : (threshold - luminance) / Math.max(1, threshold);

          const normalized = Math.max(0, Math.min(1, inkStrength));
          if (normalized < minAlpha) {
            pixels[i + 3] = 0;
            continue;
          }

          pixels[i] = 0;
          pixels[i + 1] = 0;
          pixels[i + 2] = 0;
          pixels[i + 3] = Math.round(normalized * alpha);
        }

        sourceCtx.putImageData(imageData, 0, 0);

        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = width;
        outputCanvas.height = height;
        const outputCtx = outputCanvas.getContext("2d");
        if (!outputCtx) {
          if (!cancelled) setProcessedSrc(dataUrl);
          return;
        }

        outputCtx.fillStyle = "#ffffff";
        outputCtx.fillRect(0, 0, width, height);
        outputCtx.drawImage(sourceCanvas, 0, 0);

        if (!cancelled) {
          setProcessedSrc(outputCanvas.toDataURL("image/png"));
        }
      } catch {
        if (!cancelled) setProcessedSrc(dataUrl);
      }
    };

    image.onerror = () => {
      if (!cancelled) setProcessedSrc(dataUrl);
    };

    image.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  return (
    <img
      src={processedSrc ?? dataUrl}
      alt="Client signature"
      className="max-h-40 rounded-lg border border-black/10 bg-white p-2"
    />
  );
}

function renderAnswer(answer: FormAnswer | undefined, question: FormQuestion) {
  if (question.questionType === "section_header" || isLegacySectionHeaderQuestion(question)) {
    return (
      <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
        <RichTextBlock
          text={question.questionText}
          className="text-sm font-semibold text-foreground [&_p]:mb-1"
        />
        {question.placeholder ? (
          <RichTextBlock text={question.placeholder} className="text-sm text-muted" />
        ) : (
          <p className="text-xs text-muted italic">Section header (display only)</p>
        )}
      </div>
    );
  }

  if (!answer) return <span className="text-muted text-sm italic">No answer</span>;

  if (answer.answerText?.startsWith("data:image/")) {
    return <SignaturePreview dataUrl={answer.answerText} />;
  }

  switch (question.questionType) {
    case "star_rating":
      return (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={14} className={s <= (answer.numericValue ?? 0) ? "text-accent fill-accent" : "text-black/15"} />
          ))}
          <span className="text-xs text-muted ml-1">{answer.numericValue ?? 0}/5</span>
        </div>
      );
    case "number_scale":
      return (
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <span
              key={n}
              className={`w-5 h-5 rounded text-[10px] font-semibold flex items-center justify-center ${
                n === (answer.numericValue ?? 0) ? "bg-accent text-white" : "bg-black/5 text-muted"
              }`}
            >
              {n}
            </span>
          ))}
        </div>
      );
    case "yes_no":
      return (
        <span className={`inline-flex items-center gap-1.5 text-sm ${answer.boolValue ? "text-success" : "text-danger"}`}>
          {answer.boolValue ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {answer.boolValue ? "Yes" : "No"}
        </span>
      );
    case "slider": {
      const min = question.sliderMin ?? 0;
      const max = question.sliderMax ?? 10;
      const value = answer.numericValue ?? min;
      const width = max > min ? ((value - min) / (max - min)) * 100 : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${Math.max(0, Math.min(100, width))}%` }} />
          </div>
          <span className="text-sm font-medium">{value}</span>
        </div>
      );
    }
    case "multiple_choice":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(question.choices ?? []).map((choice) => {
            const selected = answer.selectedChoiceIds?.includes(choice.id);
            return (
              <span
                key={choice.id}
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selected ? "bg-accent/15 text-accent" : "bg-black/5 text-muted"
                }`}
              >
                {choice.text}
              </span>
            );
          })}
        </div>
      );
    case "metrics":
      return (
        <div className="grid grid-cols-2 gap-2">
          {(question.metricsConfig?.fields ?? []).map((field) => (
            <div key={field.id} className="rounded-lg bg-black/[0.03] px-2 py-1.5">
              <p className="text-[10px] text-muted">{field.label}</p>
              <p className="text-xs font-semibold">
                {answer.metricsValues?.[field.fieldKey] ?? "—"} {field.unit}
              </p>
            </div>
          ))}
        </div>
      );
    case "signature_draw":
      if (answer.answerText?.startsWith("data:image/")) {
        return <SignaturePreview dataUrl={answer.answerText} />;
      }
      return <span className="text-muted text-sm italic">Signature image unavailable</span>;
    default:
      return <p className="text-sm whitespace-pre-wrap">{answer.answerText || "—"}</p>;
  }
}

export function CheckinsPanel({ clientId }: { clientId: string }) {
  const notes = useCoachNotes(clientId);
  const [templates, setTemplates] = useState<ClientCheckInTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<ClientCheckInTemplate[]>([]);
  const [history, setHistory] = useState<ClientCheckInHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("all");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState("");
  const [showAssignFormModal, setShowAssignFormModal] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState<string>("");
  const [assignDueDate, setAssignDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchClientCheckInPanelData(clientId),
      fetchFormTemplatesWithQuestions(),
    ])
      .then(([panelData, templateData]) => {
        if (!mounted) return;
        setTemplates(panelData.templates);
        setHistory(panelData.history);
        setAllTemplates(
          (templateData as FormTemplate[]).map((template) => ({
            id: template.id,
            name: template.name,
            formType: template.formType,
            questions: template.questions,
          }))
        );
        setSelectedTemplateId("all");
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load check-ins");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [clientId]);

  const templateById = useMemo(() => {
    const map = new Map<number, ClientCheckInTemplate>();
    for (const template of allTemplates) map.set(template.id, template);
    for (const template of templates) map.set(template.id, template);
    return map;
  }, [allTemplates, templates]);

  const filteredHistory = useMemo(() => {
    if (selectedTemplateId === "all") return history;
    const id = Number(selectedTemplateId);
    return history.filter((entry) => entry.templateId === id);
  }, [history, selectedTemplateId]);

  useEffect(() => {
    if (filteredHistory.length === 0) {
      setSelectedAssignmentId(null);
      return;
    }
    if (!selectedAssignmentId || !filteredHistory.some((entry) => entry.assignmentId === selectedAssignmentId)) {
      setSelectedAssignmentId(filteredHistory[0].assignmentId);
    }
  }, [filteredHistory, selectedAssignmentId]);

  const selectedEntry = useMemo(
    () => filteredHistory.find((entry) => entry.assignmentId === selectedAssignmentId) ?? null,
    [filteredHistory, selectedAssignmentId]
  );

  const selectedTemplate = selectedEntry ? templateById.get(selectedEntry.templateId) ?? null : null;
  const answersByQuestionId = useMemo(() => {
    const map = new Map<number, FormAnswer>();
    for (const answer of selectedEntry?.answers ?? []) map.set(answer.questionId, answer);
    return map;
  }, [selectedEntry]);

  const answersByOrder = useMemo(() => selectedEntry?.answers ?? [], [selectedEntry]);

  function getAnswerForQuestion(question: FormQuestion, index: number): FormAnswer | undefined {
    const byId = answersByQuestionId.get(question.id);
    if (byId) return byId;
    return answersByOrder[index];
  }

  async function refreshPanelData() {
    const data = await fetchClientCheckInPanelData(clientId);
    setTemplates(data.templates);
    setHistory(data.history);
  }

  async function handleAssignForm() {
    const templateId = Number(assignTemplateId);
    if (!templateId || !assignDueDate) {
      setAssignMessage({ type: "error", text: "Please select a form and due date." });
      return;
    }

    setAssigning(true);
    setAssignMessage(null);
    try {
      await createFormAssignment(templateId, clientId, assignDueDate);
      await refreshPanelData();
      setAssignMessage({ type: "success", text: "Form assigned successfully." });
      setShowAssignFormModal(false);
      setAssignTemplateId("");
    } catch (err) {
      if (isDuplicateFormAssignmentError(err)) {
        setAssignMessage({ type: "error", text: "That form is already assigned for the selected date." });
      } else {
        setAssignMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to assign form." });
      }
    } finally {
      setAssigning(false);
    }
  }

  function handleAddNote() {
    const text = noteDraft.trim();
    if (!text) return;
    clientStore.addNote(clientId, text);
    setNoteDraft("");
  }

  function handleStartEdit(noteId: string, content: string) {
    setEditingNoteId(noteId);
    setEditingNoteDraft(content);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setEditingNoteDraft("");
  }

  async function handleSaveEdit() {
    if (!editingNoteId) return;
    const text = editingNoteDraft.trim();
    if (!text) return;
    await clientStore.updateNote(editingNoteId, text);
    handleCancelEdit();
  }

  async function handleDeleteNote(noteId: string) {
    await clientStore.removeNote(noteId);
    if (editingNoteId === noteId) {
      handleCancelEdit();
    }
  }

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto pr-1 pb-32 space-y-5">
      <section className="space-y-2">
        <p className="text-xs text-muted">Review submitted check-ins alongside missed forms and keep review notes in one place.</p>
        <div className="flex items-center justify-between gap-3">
          <label className="block text-xs font-medium text-muted">Form</label>
          <button
            onClick={() => setShowAssignFormModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 text-xs font-medium text-foreground hover:bg-black/[0.03]"
          >
            <Plus size={12} />
            Assign Form
          </button>
        </div>
        <select
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm"
        >
          <option value="all">All forms</option>
          {templates.map((template) => (
            <option key={template.id} value={String(template.id)}>
              {template.name}
            </option>
          ))}
        </select>
        {assignMessage && (
          <p className={`text-xs ${assignMessage.type === "error" ? "text-danger" : "text-success"}`}>
            {assignMessage.text}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">History</h3>
          <span className="text-xs text-muted">{filteredHistory.length} item{filteredHistory.length === 1 ? "" : "s"}</span>
        </div>

        {loading && <p className="text-sm text-muted py-4">Loading check-ins…</p>}
        {!loading && error && <p className="text-sm text-danger py-4">{error}</p>}

        {!loading && !error && filteredHistory.length === 0 && (
          <p className="text-sm text-muted py-4">No assignments found for this form yet.</p>
        )}

        <div className="space-y-2">
          {!loading &&
            !error &&
            filteredHistory.map((entry) => {
              const active = entry.assignmentId === selectedAssignmentId;
              return (
                <button
                  key={entry.assignmentId}
                  onClick={() => setSelectedAssignmentId(entry.assignmentId)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    active ? "border-accent/40 bg-accent/5" : "border-black/10 hover:bg-black/[0.02]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{entry.templateName}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {entry.submittedAt ? `Submitted ${formatDate(entry.submittedAt)}` : `Due ${formatDate(entry.dueDate)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClasses(entry.status)}`}>
                        {statusLabel(entry.status)}
                      </span>
                      {entry.timelineTag !== "none" && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${timelineClasses(entry.timelineTag)}`}>
                          {timelineLabel(entry.timelineTag)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      <section className="border border-black/10 rounded-xl p-3 space-y-3">
        <h3 className="text-sm font-semibold">Selected Check-In</h3>
        {!selectedEntry && <p className="text-sm text-muted">Select a history item to review responses.</p>}

        {selectedEntry && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClasses(selectedEntry.status)}`}>
                {statusLabel(selectedEntry.status)}
              </span>
              {selectedEntry.timelineTag !== "none" && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${timelineClasses(selectedEntry.timelineTag)}`}>
                  {timelineLabel(selectedEntry.timelineTag)}
                </span>
              )}
              {selectedEntry.reviewed && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/15 text-success">Reviewed</span>
              )}
              <span className="text-xs text-muted">
                Due: {formatDate(selectedEntry.dueDate)} · Submitted: {formatDate(selectedEntry.submittedAt)}
              </span>
            </div>

            {selectedEntry.status === "completed" ? (
              <div className="space-y-3">
                {(selectedTemplate?.questions ?? []).map((question, index) => (
                  <div key={question.id} className="rounded-lg bg-black/[0.02] p-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-accent mt-0.5">{index + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{question.questionText}</p>
                        <span className="inline-flex mt-1 px-1.5 py-0.5 rounded bg-black/5 text-[10px] text-muted">
                          {FORM_QUESTION_TYPE_META[question.questionType].label}
                        </span>
                        <div className="mt-2">{renderAnswer(getAnswerForQuestion(question, index), question)}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {(selectedTemplate?.questions ?? []).length === 0 && (
                  <div className="rounded-lg border border-black/10 p-3">
                    <p className="text-xs text-muted">Template questions not available, but the form was completed.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-black/10 p-3 flex items-start gap-2">
                <CircleDot size={14} className="text-muted mt-0.5 shrink-0" />
                <p className="text-sm text-muted">
                  {selectedEntry.status === "missed"
                    ? "This check-in was due but has not been submitted."
                    : "This check-in is assigned and waiting for submission."}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="pt-1 space-y-2">
        <h3 className="text-sm font-semibold">Coach Notes</h3>
        <p className="text-xs text-muted">Use this while reviewing check-ins. Notes stay private to coach view.</p>
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1 pb-3">
          {notes.length === 0 && <p className="text-xs text-muted py-1">No notes yet.</p>}
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-black/[0.03] px-3 py-2">
              {editingNoteId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingNoteDraft}
                    onChange={(e) => setEditingNoteDraft(e.target.value)}
                    rows={2}
                    className="w-full px-2.5 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-black/10 text-xs hover:bg-black/[0.03]"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editingNoteDraft.trim()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-white text-xs hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check size={12} />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(note.id, note.content)}
                        className="w-7 h-7 rounded-md border border-black/10 text-muted hover:text-foreground hover:bg-black/[0.03] flex items-center justify-center"
                        aria-label="Edit note"
                        title="Edit note"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => void handleDeleteNote(note.id)}
                        className="w-7 h-7 rounded-md border border-black/10 text-danger hover:bg-danger/10 flex items-center justify-center"
                        aria-label="Delete note"
                        title="Delete note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted mt-1">{new Date(note.createdAt).toLocaleString("en-GB")}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      </div>

      <div className="absolute left-0 right-0 bottom-0 z-20 pb-1">
        <div className="rounded-2xl border border-black/10 bg-white/95 backdrop-blur-sm px-3 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="Add a note while reviewing..."
              className="flex-1 px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm resize-none"
            />
            <button
              onClick={handleAddNote}
              disabled={!noteDraft.trim()}
              className="w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {showAssignFormModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-black/10 bg-white shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">Assign Form</h4>
              <button
                onClick={() => setShowAssignFormModal(false)}
                className="text-muted hover:text-foreground"
                aria-label="Close assign form modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Form Template</label>
                <select
                  value={assignTemplateId}
                  onChange={(e) => setAssignTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm"
                >
                  <option value="">Select a form</option>
                  {allTemplates.map((template) => (
                    <option key={template.id} value={String(template.id)}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    Due Date
                  </span>
                </label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowAssignFormModal(false)}
                className="px-3 py-2 rounded-lg border border-black/10 text-sm hover:bg-black/[0.03]"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAssignForm()}
                disabled={assigning}
                className="px-3 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-light disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign Form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
