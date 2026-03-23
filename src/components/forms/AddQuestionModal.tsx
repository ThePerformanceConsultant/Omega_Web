"use client";

import { useState } from "react";
import {
  X, Type, AlignLeft, Hash, SlidersHorizontal, ToggleLeft,
  ListChecks, Ruler, Star, PenTool, Plus, Trash2, Heading1,
} from "lucide-react";
import {
  FORM_QUESTION_TYPES, FormQuestionType, FormQuestion,
  FORM_QUESTION_TYPE_META, ChoiceOption, MetricField,
} from "@/lib/types";

const ICON_MAP: Record<string, React.ElementType> = {
  Heading1,
  Type, AlignLeft, Hash, SlidersHorizontal, ToggleLeft,
  ListChecks, Ruler, Star, PenTool,
};

interface AddQuestionModalProps {
  existingQuestion?: FormQuestion;
  onSave: (question: FormQuestion) => void;
  onClose: () => void;
}

export default function AddQuestionModal({ existingQuestion, onSave, onClose }: AddQuestionModalProps) {
  const [selectedType, setSelectedType] = useState<FormQuestionType>(existingQuestion?.questionType ?? "short_text");
  const [questionText, setQuestionText] = useState(existingQuestion?.questionText ?? "");
  const [isRequired, setIsRequired] = useState(
    existingQuestion?.questionType === "section_header"
      ? false
      : (existingQuestion?.isRequired ?? true)
  );
  const [placeholder, setPlaceholder] = useState(existingQuestion?.placeholder ?? "");

  // Slider config
  const [sliderMin, setSliderMin] = useState(existingQuestion?.sliderMin ?? 0);
  const [sliderMax, setSliderMax] = useState(existingQuestion?.sliderMax ?? 100);
  const [sliderStep, setSliderStep] = useState(existingQuestion?.sliderStep ?? 1);

  // Multiple choice
  const [choices, setChoices] = useState<ChoiceOption[]>(
    existingQuestion?.choices ?? [{ id: 1, text: "", sortOrder: 0 }]
  );
  const [allowsMultiple, setAllowsMultiple] = useState(existingQuestion?.allowsMultipleSelection ?? false);

  // Metrics
  const [metricFields, setMetricFields] = useState<MetricField[]>(
    existingQuestion?.metricsConfig?.fields ?? [
      { id: 1, label: "Weight", unit: "kg", fieldKey: "weight" },
    ]
  );

  const isSectionHeader = selectedType === "section_header";

  function addChoice() {
    setChoices((prev) => [...prev, { id: Date.now(), text: "", sortOrder: prev.length }]);
  }

  function removeChoice(id: number) {
    setChoices((prev) => prev.filter((c) => c.id !== id));
  }

  function updateChoice(id: number, text: string) {
    setChoices((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  }

  function addMetricField() {
    setMetricFields((prev) => [...prev, { id: Date.now(), label: "", unit: "", fieldKey: `field_${Date.now()}` }]);
  }

  function removeMetricField(id: number) {
    setMetricFields((prev) => prev.filter((f) => f.id !== id));
  }

  function updateMetricField(id: number, key: "label" | "unit", value: string) {
    setMetricFields((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, [key]: value, fieldKey: key === "label" ? value.toLowerCase().replace(/\s+/g, "_") : f.fieldKey }
          : f
      )
    );
  }

  function handleSave() {
    const question: FormQuestion = {
      id: existingQuestion?.id ?? Date.now(),
      questionText,
      questionType: selectedType,
      sortOrder: existingQuestion?.sortOrder ?? 0,
      isRequired: selectedType === "section_header" ? false : isRequired,
      choices: selectedType === "multiple_choice" ? choices : null,
      allowsMultipleSelection: selectedType === "multiple_choice" ? allowsMultiple : false,
      metricsConfig:
        selectedType === "metrics"
          ? { id: existingQuestion?.metricsConfig?.id ?? Date.now(), fields: metricFields }
          : null,
      sliderMin: selectedType === "slider" ? sliderMin : null,
      sliderMax: selectedType === "slider" ? sliderMax : null,
      sliderStep: selectedType === "slider" ? sliderStep : null,
      placeholder:
        ["short_text", "long_text", "signature_caption", "section_header"].includes(selectedType) && placeholder.trim()
          ? placeholder
          : null,
    };
    onSave(question);
  }

  const isValid = questionText.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/10">
          <h2 className="text-lg font-semibold text-foreground">
            {existingQuestion ? "Edit Question" : "Add Question"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body — split panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — type picker */}
          <div className="w-56 border-r border-black/10 overflow-y-auto p-4 space-y-1 shrink-0">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Question Type</p>
            {FORM_QUESTION_TYPES.map((type) => {
              const meta = FORM_QUESTION_TYPE_META[type];
              const Icon = ICON_MAP[meta.icon] ?? Type;
              const active = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                    active
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground hover:bg-black/5"
                  }`}
                >
                  <Icon size={16} className={active ? "text-accent" : "text-muted"} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Right — config */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Question text */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                {isSectionHeader ? "Section title / rich text" : "Question text"}
              </label>
              {isSectionHeader ? (
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Enter section title (supports markdown, new lines, lists)..."
                  className="w-full min-h-[88px] px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 resize-y"
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Enter your question..."
                  className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                  autoFocus
                />
              )}
              {isSectionHeader && (
                <p className="text-xs text-muted mt-1">
                  Markdown supported: <code>**bold**</code>, <code>*italic*</code>, <code>- bullet</code>, <code>1. numbered</code>.
                </p>
              )}
            </div>

            {/* Required toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectedType !== "section_header" && setIsRequired(!isRequired)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  (selectedType === "section_header" ? false : isRequired) ? "bg-accent" : "bg-black/15"
                }`}
                disabled={selectedType === "section_header"}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    (selectedType === "section_header" ? false : isRequired) ? "left-5.5 translate-x-0" : "left-0.5"
                  }`}
                  style={{ left: (selectedType === "section_header" ? false : isRequired) ? "22px" : "2px" }}
                />
              </button>
              <span className="text-sm text-foreground">
                {selectedType === "section_header" ? "Display only (not answerable)" : "Required"}
              </span>
            </div>

            {/* Type-specific config */}
            {(selectedType === "short_text" || selectedType === "long_text" || selectedType === "signature_caption" || selectedType === "section_header") && (
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  {isSectionHeader ? "Body text (optional, markdown supported)" : "Placeholder text"}
                </label>
                {isSectionHeader ? (
                  <textarea
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="Add supporting text for this section..."
                    className="w-full min-h-[132px] px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 resize-y"
                  />
                ) : (
                  <input
                    type="text"
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="Optional placeholder..."
                    className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                  />
                )}
              </div>
            )}

            {selectedType === "slider" && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Min</label>
                  <input
                    type="number"
                    value={sliderMin}
                    onChange={(e) => setSliderMin(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Max</label>
                  <input
                    type="number"
                    value={sliderMax}
                    onChange={(e) => setSliderMax(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Step</label>
                  <input
                    type="number"
                    value={sliderStep}
                    onChange={(e) => setSliderStep(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                  />
                </div>
              </div>
            )}

            {selectedType === "multiple_choice" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAllowsMultiple(!allowsMultiple)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      allowsMultiple ? "bg-accent" : "bg-black/15"
                    }`}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ left: allowsMultiple ? "22px" : "2px" }}
                    />
                  </button>
                  <span className="text-sm text-foreground">Allow multiple selections</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Options</label>
                  <div className="space-y-2">
                    {choices.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted w-5 text-center">{i + 1}.</span>
                        <input
                          type="text"
                          value={c.text}
                          onChange={(e) => updateChoice(c.id, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                        />
                        {choices.length > 1 && (
                          <button onClick={() => removeChoice(c.id)} className="p-1.5 text-muted hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addChoice}
                      className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-light transition-colors mt-1"
                    >
                      <Plus size={13} /> Add option
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedType === "metrics" && (
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Measurement fields</label>
                <div className="space-y-2">
                  {metricFields.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateMetricField(f.id, "label", e.target.value)}
                        placeholder="Label (e.g. Weight)"
                        className="flex-1 px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                      />
                      <input
                        type="text"
                        value={f.unit}
                        onChange={(e) => updateMetricField(f.id, "unit", e.target.value)}
                        placeholder="Unit (e.g. kg)"
                        className="w-24 px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                      />
                      {metricFields.length > 1 && (
                        <button onClick={() => removeMetricField(f.id)} className="p-1.5 text-muted hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addMetricField}
                    className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-light transition-colors mt-1"
                  >
                    <Plus size={13} /> Add field
                  </button>
                </div>
              </div>
            )}

            {/* Minimal config types — informational note */}
            {(selectedType === "number_scale" || selectedType === "star_rating" || selectedType === "yes_no" || selectedType === "signature_draw") && (
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/15">
                <p className="text-sm text-muted">
                  {selectedType === "number_scale" && "Displays a 1–10 numbered scale. No additional configuration needed."}
                  {selectedType === "star_rating" && "Displays a 1–5 star rating selector. No additional configuration needed."}
                  {selectedType === "yes_no" && "Displays a Yes / No toggle selector. No additional configuration needed."}
                  {selectedType === "signature_draw" && "Displays a drawn-signature pad for clients. No additional configuration needed."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-black/10">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-foreground border border-black/10 hover:border-black/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-accent to-accent-light shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {existingQuestion ? "Save Changes" : "Add Question"}
          </button>
        </div>
      </div>
    </div>
  );
}
