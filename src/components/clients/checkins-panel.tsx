"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDot, Plus, Star } from "lucide-react";
import {
  ClientCheckInHistoryItem,
  ClientCheckInTemplate,
  FORM_QUESTION_TYPE_META,
  FormAnswer,
  FormQuestion,
} from "@/lib/types";
import { fetchClientCheckInPanelData } from "@/lib/supabase/db";
import { clientStore, useCoachNotes } from "@/lib/client-store";

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

function renderAnswer(answer: FormAnswer | undefined, question: FormQuestion) {
  if (!answer) return <span className="text-muted text-sm italic">No answer</span>;

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
    default:
      return <p className="text-sm whitespace-pre-wrap">{answer.answerText || "—"}</p>;
  }
}

export function CheckinsPanel({ clientId }: { clientId: string }) {
  const notes = useCoachNotes(clientId);
  const [templates, setTemplates] = useState<ClientCheckInTemplate[]>([]);
  const [history, setHistory] = useState<ClientCheckInHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("all");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchClientCheckInPanelData(clientId)
      .then((data) => {
        if (!mounted) return;
        setTemplates(data.templates);
        setHistory(data.history);
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

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

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

  function handleAddNote() {
    const text = noteDraft.trim();
    if (!text) return;
    clientStore.addNote(clientId, text);
    setNoteDraft("");
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="text-xs text-muted">Review submitted check-ins alongside missed forms and keep review notes in one place.</p>
        <label className="block text-xs font-medium text-muted">Form</label>
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
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClasses(entry.status)}`}>
                      {statusLabel(entry.status)}
                    </span>
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
                        <div className="mt-2">{renderAnswer(answersByQuestionId.get(question.id), question)}</div>
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
        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          {notes.length === 0 && <p className="text-xs text-muted py-1">No notes yet.</p>}
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-black/[0.03] px-3 py-2">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="text-[10px] text-muted mt-1">{new Date(note.createdAt).toLocaleString("en-GB")}</p>
            </div>
          ))}
        </div>
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
      </section>
    </div>
  );
}
