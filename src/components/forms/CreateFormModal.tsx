"use client";

import { useState } from "react";
import { X, CheckCircle, Circle, ClipboardCheck, FileText, CalendarCheck, UserPlus, Utensils } from "lucide-react";
import { FormType, FORM_TYPE_OPTIONS, FORM_TYPE_META } from "@/lib/types";

const TYPE_ICONS: Record<FormType, React.ElementType> = {
  check_in: ClipboardCheck,
  custom: FileText,
  review: CalendarCheck,
  onboarding: UserPlus,
  nutrition_intake: Utensils,
};

interface CreateFormModalProps {
  onClose: () => void;
  onCreate: (name: string, formType: FormType) => void;
}

export default function CreateFormModal({ onClose, onCreate }: CreateFormModalProps) {
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState<FormType>("check_in");

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Create New Form</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form name */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-muted mb-1.5">Form name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter form name..."
            className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
            autoFocus
          />
        </div>

        {/* Form type selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted mb-2">Select form type</label>
          <div className="space-y-2">
            {FORM_TYPE_OPTIONS.map((type) => {
              const meta = FORM_TYPE_META[type];
              const Icon = TYPE_ICONS[type];
              const isSelected = selectedType === type;

              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "border-accent/50 bg-accent/5 shadow-sm"
                      : "border-black/10 bg-white hover:border-black/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? "bg-accent/15" : "bg-black/5"
                    }`}>
                      <Icon size={20} className={isSelected ? "text-accent" : "text-muted"} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{meta.label} Form</div>
                      <div className="text-xs text-muted mt-0.5">{meta.description}</div>
                    </div>
                    {isSelected ? (
                      <CheckCircle size={20} className="text-accent" />
                    ) : (
                      <Circle size={20} className="text-black/15" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-foreground border border-black/10 hover:border-black/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(name, selectedType)}
            disabled={!name.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-accent to-accent-light shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Form
          </button>
        </div>
      </div>
    </div>
  );
}
