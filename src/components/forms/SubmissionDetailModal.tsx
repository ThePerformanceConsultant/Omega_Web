"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Star, CheckCircle, XCircle, Utensils } from "lucide-react";
import { FormSubmission, FormTemplate, FormQuestion, FORM_QUESTION_TYPE_META } from "@/lib/types";
import { markSubmissionReviewed } from "@/lib/supabase/db";

interface SubmissionDetailModalProps {
  submission: FormSubmission;
  template: FormTemplate | undefined;
  onClose: () => void;
  onReviewed?: (id: number) => void;
}

export default function SubmissionDetailModal({ submission, template, onClose, onReviewed }: SubmissionDetailModalProps) {
  const questions = template?.questions.sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const [reviewed, setReviewed] = useState(submission.reviewed);
  const [marking, setMarking] = useState(false);

  async function handleMarkReviewed() {
    setMarking(true);
    try {
      await markSubmissionReviewed(submission.id);
      setReviewed(true);
      onReviewed?.(submission.id);
    } catch (err) {
      console.error("[SubmissionDetail] mark reviewed failed:", err);
    } finally {
      setMarking(false);
    }
  }

  function renderAnswer(question: FormQuestion, index: number) {
    if (question.questionType === "section_header") {
      return (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
          <p className="text-xs font-semibold text-accent">Section Header</p>
          {question.placeholder && (
            <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{question.placeholder}</p>
          )}
        </div>
      );
    }

    const answer =
      submission.answers.find((a) => a.questionId === question.id)
      ?? submission.answers[index];
    if (!answer) return <span className="text-muted text-sm italic">No answer</span>;

    switch (question.questionType) {
      case "star_rating":
        return (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={16} className={s <= (answer.numericValue ?? 0) ? "text-accent fill-accent" : "text-black/15"} />
            ))}
            <span className="text-xs text-muted ml-1">{answer.numericValue}/5</span>
          </div>
        );
      case "number_scale":
        return (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <span key={n} className={`w-6 h-6 rounded text-[10px] font-semibold flex items-center justify-center ${
                n === (answer.numericValue ?? 0) ? "bg-accent text-white" : "bg-black/5 text-muted"
              }`}>{n}</span>
            ))}
          </div>
        );
      case "yes_no":
        return answer.boolValue ? (
          <span className="flex items-center gap-1.5 text-sm text-success"><CheckCircle size={14} /> Yes</span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-red-500"><XCircle size={14} /> No</span>
        );
      case "slider":
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full"
                style={{ width: `${((answer.numericValue ?? 0) / (question.sliderMax ?? 100)) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-foreground">{answer.numericValue}</span>
          </div>
        );
      case "multiple_choice":
        return (
          <div className="flex flex-wrap gap-1.5">
            {(question.choices ?? []).map((c) => {
              const isSelected = answer.selectedChoiceIds?.includes(c.id);
              return (
                <span key={c.id} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  isSelected ? "bg-accent/15 text-accent" : "bg-black/5 text-muted"
                }`}>
                  {c.text}
                </span>
              );
            })}
          </div>
        );
      case "metrics":
        return (
          <div className="grid grid-cols-2 gap-2">
            {(question.metricsConfig?.fields ?? []).map((f) => (
              <div key={f.id} className="flex items-center gap-2 bg-black/3 rounded-lg px-3 py-2">
                <span className="text-xs text-muted">{f.label}</span>
                <span className="text-sm font-medium text-foreground ml-auto">
                  {answer.metricsValues?.[f.fieldKey] ?? "—"} {f.unit}
                </span>
              </div>
            ))}
          </div>
        );
      case "signature_caption":
        return (
          <div className="italic text-sm text-foreground border-b border-accent/30 pb-1 inline-block">
            {answer.answerText}
          </div>
        );
      case "signature_draw":
        if (answer.answerText?.startsWith("data:image/")) {
          return (
            <img
              src={answer.answerText}
              alt="Submitted signature"
              className="max-h-44 rounded-lg border border-black/10 bg-white p-2"
            />
          );
        }
        return (
          <p className="text-sm text-muted italic">
            Signature image unavailable.
          </p>
        );
      default:
        return <p className="text-sm text-foreground">{answer.answerText || "—"}</p>;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{submission.templateName}</h2>
            <p className="text-sm text-muted mt-0.5">
              Submitted by {submission.clientName} on{" "}
              {new Date(submission.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              reviewed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}>
              {reviewed ? "Reviewed" : "Pending Review"}
            </span>
            {!reviewed && (
              <button
                onClick={handleMarkReviewed}
                disabled={marking}
                className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/15 transition-colors disabled:opacity-50"
              >
                {marking ? "Saving..." : "Mark as Reviewed"}
              </button>
            )}
            <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Answers */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {questions.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-sm font-bold text-accent">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{q.questionText}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${FORM_QUESTION_TYPE_META[q.questionType].label ? "bg-black/5 text-muted" : ""}`}>
                    {FORM_QUESTION_TYPE_META[q.questionType].label}
                  </span>
                </div>
              </div>
              <div className="ml-6">{renderAnswer(q, i)}</div>
            </div>
          ))}
          {questions.length === 0 && (
            <p className="text-sm text-muted text-center py-8">Template not found — cannot display answers.</p>
          )}
          {template?.formType === "nutrition_intake" && (
            <div className="mt-4 pt-3 border-t border-black/10">
              <Link
                href={`/clients/${submission.clientId}`}
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/15 transition-colors"
              >
                <Utensils size={14} /> View Client Meal Plan
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
