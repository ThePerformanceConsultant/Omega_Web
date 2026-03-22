"use client";

import { Star, Check, X as XIcon } from "lucide-react";
import { FormQuestion, FormTemplate, FORM_QUESTION_TYPE_META } from "@/lib/types";

interface MobilePreviewProps {
  template: FormTemplate;
}

export default function MobilePreview({ template }: MobilePreviewProps) {
  const sortedQuestions = [...template.questions].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="w-[320px] shrink-0">
      <div className="sticky top-6">
        <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Mobile Preview</p>

        {/* Phone frame */}
        <div className="relative mx-auto w-[280px] rounded-[2.2rem] border-[3px] border-black/80 bg-[#0f0f0f] shadow-xl overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20" />

          {/* Status bar */}
          <div className="h-12 bg-[#0f0f0f] flex items-end justify-between px-6 pb-1">
            <span className="text-[10px] text-white/60 font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-3.5 h-2 rounded-sm border border-white/40">
                <div className="w-2 h-1.5 bg-white/60 rounded-[1px] m-[1px]" />
              </div>
            </div>
          </div>

          {/* Nav bar */}
          <div className="px-4 py-2.5 bg-[#0f0f0f] border-b border-white/10">
            <p className="text-sm font-semibold text-white truncate text-center">{template.name || "Untitled Form"}</p>
          </div>

          {/* Content area */}
          <div className="h-[460px] overflow-y-auto px-3 py-3 space-y-3 bg-[#0f0f0f]">
            {sortedQuestions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-white/30 text-center">
                  Add questions to see<br />a live preview here
                </p>
              </div>
            ) : (
              sortedQuestions.map((q, i) => (
                <PreviewQuestion key={q.id} question={q} index={i} />
              ))
            )}
          </div>

          {/* Home indicator */}
          <div className="h-6 bg-[#0f0f0f] flex items-center justify-center">
            <div className="w-24 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewQuestion({ question, index }: { question: FormQuestion; index: number }) {
  const meta = FORM_QUESTION_TYPE_META[question.questionType] ?? { label: question.questionType, description: "", icon: "HelpCircle" };
  const isSectionHeader = question.questionType === "section_header";

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${isSectionHeader ? "bg-accent/10 border-accent/30" : "bg-white/[0.06] border-white/[0.08]"}`}>
      {isSectionHeader ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-white">
            {question.questionText || "Section title"}
          </p>
          {question.placeholder && (
            <p className="text-[9px] text-white/70 leading-snug">{question.placeholder}</p>
          )}
          <span className="text-[8px] text-white/40 uppercase tracking-wider">{meta.label}</span>
        </div>
      ) : (
        <>
          {/* Question header */}
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-bold text-[#D4A843]">{index + 1}.</span>
            <div className="flex-1">
              <p className="text-[11px] font-medium text-white/90 leading-snug">
                {question.questionText || "Question text..."}
              </p>
              <span className="text-[8px] text-white/30 uppercase tracking-wider">{meta.label}</span>
            </div>
            {question.isRequired && (
              <span className="text-[8px] text-red-400 font-medium">*</span>
            )}
          </div>

          {/* Type-specific preview */}
          <div className="ml-3">
            <QuestionTypePreview question={question} />
          </div>
        </>
      )}
    </div>
  );
}

function SignatureDrawPreview() {
  return (
    <div className="space-y-1.5">
      <div className="h-16 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
        <div className="w-[85%] border-b border-dashed border-[#D4A843]/40 pb-1">
          <span className="text-[9px] text-white/35 italic">Draw signature here</span>
        </div>
      </div>
      <p className="text-[8px] text-white/30">Client must draw before submitting</p>
    </div>
  );
}

function QuestionTypePreview({ question }: { question: FormQuestion }) {
  switch (question.questionType) {
    case "short_text":
    case "number":
      return (
        <div className="h-7 rounded-md bg-white/[0.05] border border-white/[0.08] flex items-center px-2">
          <span className="text-[9px] text-white/20">{question.placeholder || "Your answer..."}</span>
        </div>
      );

    case "long_text":
      return (
        <div className="h-14 rounded-md bg-white/[0.05] border border-white/[0.08] flex items-start p-2">
          <span className="text-[9px] text-white/20">{question.placeholder || "Write your answer..."}</span>
        </div>
      );

    case "number_scale":
      return (
        <div className="flex gap-[3px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div
              key={n}
              className="w-[18px] h-[18px] rounded-[4px] bg-white/[0.06] flex items-center justify-center"
            >
              <span className="text-[7px] text-white/40 font-medium">{n}</span>
            </div>
          ))}
        </div>
      );

    case "slider":
      return (
        <div className="space-y-1.5">
          <div className="text-center">
            <span className="text-sm font-bold text-[#D4A843]">
              {Math.round(((question.sliderMin ?? 0) + (question.sliderMax ?? 100)) / 2)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.08] relative overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-[#D4A843]" />
          </div>
          <div className="flex justify-between">
            <span className="text-[7px] text-white/30">{question.sliderMin ?? 0}</span>
            <span className="text-[7px] text-white/30">{question.sliderMax ?? 100}</span>
          </div>
        </div>
      );

    case "yes_no":
      return (
        <div className="flex gap-2">
          <div className="flex-1 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center gap-1">
            <Check size={10} className="text-white/30" />
            <span className="text-[9px] text-white/40 font-medium">Yes</span>
          </div>
          <div className="flex-1 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center gap-1">
            <XIcon size={10} className="text-white/30" />
            <span className="text-[9px] text-white/40 font-medium">No</span>
          </div>
        </div>
      );

    case "single_choice":
    case "multiple_choice":
      return (
        <div className="space-y-1.5">
          {(question.choices ?? []).slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
              <div className={`w-3.5 h-3.5 rounded-${question.allowsMultipleSelection ? "sm" : "full"} border border-white/20`} />
              <span className="text-[9px] text-white/50">{c.text || `Option ${c.sortOrder + 1}`}</span>
            </div>
          ))}
          {(question.choices ?? []).length > 5 && (
            <span className="text-[8px] text-white/20">+{(question.choices?.length ?? 0) - 5} more</span>
          )}
        </div>
      );

    case "metrics":
      return (
        <div className="space-y-1.5">
          {(question.metricsConfig?.fields ?? []).map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <span className="text-[9px] text-white/40 w-12 truncate">{f.label}</span>
              <div className="flex-1 h-6 rounded-md bg-white/[0.05] border border-white/[0.08]" />
              <span className="text-[8px] text-white/25">{f.unit}</span>
            </div>
          ))}
        </div>
      );

    case "star_rating":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={16} className="text-white/15" />
          ))}
        </div>
      );

    case "signature_caption":
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-white/25">✍</span>
            <span className="text-[7px] text-white/25">Type your name to confirm</span>
          </div>
          <div className="h-7 border-b border-[#D4A843]/40 flex items-center px-1">
            <span className="text-[9px] text-white/20 italic">{question.placeholder || "Type your name..."}</span>
          </div>
        </div>
      );

    case "signature_draw":
      return <SignatureDrawPreview />;

    default:
      return null;
  }
}
