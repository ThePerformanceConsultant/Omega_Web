"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Plus, GripVertical, Trash2, Edit3, Users, Clock,
  ChevronRight,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  FormTemplate, FormQuestion, DayOfWeek, FORM_TYPE_META,
  FORM_QUESTION_TYPE_META,
} from "@/lib/types";
import { fetchClients } from "@/lib/supabase/db";
import { formStore } from "@/lib/form-store";
import AddQuestionModal from "@/components/forms/AddQuestionModal";
import AssignClientsModal from "@/components/forms/AssignClientsModal";
import MobilePreview from "@/components/forms/MobilePreview";

interface ClientRow {
  id: string;
  full_name: string;
  avatar_initials: string;
  tag: string;
}

const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function FormBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = Number(params.id);

  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [showAssignClients, setShowAssignClients] = useState(false);

  useEffect(() => {
    // Hydrate form store first, then load template
    formStore.hydrate().then(() => {
      const found = formStore.getById(templateId);
      if (found) {
        setTemplate(structuredClone(found));
        // Load assigned clients from Supabase
        formStore.fetchAssignedClients(templateId).then((clientIds) => {
          if (clientIds.length > 0) {
            setTemplate((prev) => prev ? { ...prev, assignedClientIds: clientIds } : prev);
          }
        });
      }
    });
    // Fetch real clients
    fetchClients()
      .then((data) => setClients(data as ClientRow[]))
      .catch((err) => console.error("[FormBuilder] fetch clients failed:", err));
  }, [templateId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Auto-save: every local state change also persists to the shared store
  const updateTemplate = useCallback((updater: (prev: FormTemplate) => FormTemplate) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      formStore.update(next);
      return next;
    });
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !template) return;

    const oldIndex = template.questions.findIndex((q) => q.id === active.id);
    const newIndex = template.questions.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    updateTemplate((prev) => {
      const reordered = arrayMove(prev.questions, oldIndex, newIndex).map((q, i) => ({
        ...q,
        sortOrder: i,
      }));
      return { ...prev, questions: reordered };
    });
  }

  function handleAddQuestion(question: FormQuestion) {
    updateTemplate((prev) => {
      const newQ = { ...question, sortOrder: prev.questions.length };
      return { ...prev, questions: [...prev.questions, newQ] };
    });
    setShowAddQuestion(false);
  }

  function handleEditQuestion(question: FormQuestion) {
    updateTemplate((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === question.id ? question : q)),
    }));
    setEditingQuestion(null);
  }

  function handleDeleteQuestion(id: number) {
    updateTemplate((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((q) => q.id !== id)
        .map((q, i) => ({ ...q, sortOrder: i })),
    }));
  }

  function toggleDay(day: DayOfWeek) {
    updateTemplate((prev) => {
      const currentDays = prev.schedule?.days ?? [];
      const time = prev.schedule?.time ?? "09:00";
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day];
      return {
        ...prev,
        schedule: newDays.length > 0 ? { days: newDays, time } : null,
      };
    });
  }

  function setScheduleTime(time: string) {
    updateTemplate((prev) => {
      const currentDays = prev.schedule?.days ?? [];
      if (currentDays.length === 0) return prev;
      return { ...prev, schedule: { days: currentDays, time } };
    });
  }

  function handleAssignClients(clientIds: string[], dueDate: string) {
    if (!template) return;
    const previousIds = new Set(template.assignedClientIds);
    const newIds = new Set(clientIds);
    // Create assignments for newly added clients
    for (const id of clientIds) {
      if (!previousIds.has(id)) {
        formStore.assignClient(template.id, id, dueDate, template.displayDays ?? undefined);
      }
    }
    // Remove assignments for removed clients
    for (const id of template.assignedClientIds) {
      if (!newIds.has(id)) {
        formStore.unassignClient(template.id, id);
      }
    }
    updateTemplate((prev) => ({ ...prev, assignedClientIds: clientIds }));
    setShowAssignClients(false);
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted">Form template not found.</p>
      </div>
    );
  }

  const sortedQuestions = [...template.questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const typeMeta = FORM_TYPE_META[template.formType];
  const assignedClients = clients.filter((c) => template.assignedClientIds.includes(c.id));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => router.push("/forms")}
          className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Forms
        </button>
        <ChevronRight size={14} className="text-muted" />
        <input
          type="text"
          value={template.name}
          onChange={(e) => updateTemplate((prev) => ({ ...prev, name: e.target.value }))}
          className="text-sm font-semibold text-foreground bg-transparent border-none focus:outline-none focus:ring-0 min-w-0 w-auto"
          style={{ width: `${Math.max(template.name.length, 10)}ch` }}
        />
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeMeta.bgColor} ${typeMeta.color}`}>
          {typeMeta.label}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Left — builder */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Clients assigned */}
          <section className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-muted" />
                <h3 className="text-sm font-semibold text-foreground">Clients Assigned</h3>
                <span className="text-xs text-muted">({assignedClients.length})</span>
              </div>
              <button
                onClick={() => setShowAssignClients(true)}
                className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-light transition-colors"
              >
                <Plus size={14} /> Assign
              </button>
            </div>

            {assignedClients.length === 0 ? (
              <p className="text-xs text-muted">No clients assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedClients.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 border border-black/10"
                  >
                    <div className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[8px] font-bold flex items-center justify-center">
                      {c.avatar_initials}
                    </div>
                    <span className="text-xs font-medium text-foreground">{c.full_name}</span>
                    <button
                      onClick={() => {
                        formStore.unassignClient(template.id, c.id);
                        updateTemplate((prev) => ({
                          ...prev,
                          assignedClientIds: prev.assignedClientIds.filter((id) => id !== c.id),
                        }));
                      }}
                      className="text-muted hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Questions */}
          <section className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Questions</h3>
              <button
                onClick={() => setShowAddQuestion(true)}
                className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-light transition-colors"
              >
                <Plus size={14} /> Add Question
              </button>
            </div>

            {sortedQuestions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted">No questions yet. Click &ldquo;Add Question&rdquo; to get started.</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[24px_1fr_120px_70px_40px_40px] gap-3 px-3 py-2 border-b border-black/10 bg-black/[0.02] rounded-t-lg">
                  <span />
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Question</span>
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Type</span>
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider text-center">Required</span>
                  <span />
                  <span />
                </div>

                {/* Sortable rows */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sortedQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                    {sortedQuestions.map((q, i) => (
                      <SortableQuestionRow
                        key={q.id}
                        question={q}
                        index={i}
                        onEdit={() => setEditingQuestion(q)}
                        onDelete={() => handleDeleteQuestion(q.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </>
            )}
          </section>

          {/* Schedule */}
          <section className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-muted" />
              <h3 className="text-sm font-semibold text-foreground">Recurring Schedule</h3>
            </div>

            <div className="space-y-4">
              {/* Day toggles */}
              <div>
                <label className="block text-xs font-medium text-muted mb-2">Send on days</label>
                <div className="flex gap-2">
                  {ALL_DAYS.map((day) => {
                    const isActive = template.schedule?.days.includes(day) ?? false;
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`w-10 h-10 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-accent text-white shadow-sm"
                            : "bg-black/5 text-muted hover:bg-black/10"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time picker */}
              <div>
                <label className="block text-xs font-medium text-muted mb-2">Time</label>
                <input
                  type="time"
                  value={template.schedule?.time ?? "09:00"}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  disabled={!template.schedule}
                  className="px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 disabled:opacity-40"
                />
              </div>

              {template.schedule && (
                <p className="text-xs text-muted">
                  This form will appear on client dashboards every{" "}
                  {template.schedule.days.join(", ")} at {template.schedule.time}.
                </p>
              )}

              {/* Display days — only for non-persistent form types */}
              {!["onboarding", "nutrition_intake", "review"].includes(template.formType) && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-2">
                    Dashboard display days
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={template.displayDays ?? 1}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          displayDays: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="w-20 px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                    />
                    <span className="text-xs text-muted">
                      Days the form stays on the client dashboard
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-black/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">
                      Auto-Assign On Signup
                    </label>
                    <p className="text-xs text-muted">
                      Automatically assign this form to new clients with a due date of signup + 3 days.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      updateTemplate((prev) => ({
                        ...prev,
                        autoAssignOnSignup: !prev.autoAssignOnSignup,
                      }))
                    }
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                      template.autoAssignOnSignup ? "bg-accent" : "bg-black/15"
                    }`}
                    aria-label="Toggle auto-assign on signup"
                    type="button"
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ left: template.autoAssignOnSignup ? "22px" : "2px" }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right — mobile preview */}
        <MobilePreview template={template} />
      </div>

      {/* Modals */}
      {showAddQuestion && (
        <AddQuestionModal
          onSave={handleAddQuestion}
          onClose={() => setShowAddQuestion(false)}
        />
      )}
      {editingQuestion && (
        <AddQuestionModal
          existingQuestion={editingQuestion}
          onSave={handleEditQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}
      {showAssignClients && (
        <AssignClientsModal
          assignedClientIds={template.assignedClientIds}
          onSave={handleAssignClients}
          onClose={() => setShowAssignClients(false)}
        />
      )}
    </div>
  );
}

// ===========================================
// Sortable Question Row
// ===========================================

function SortableQuestionRow({
  question, index, onEdit, onDelete,
}: {
  question: FormQuestion;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = FORM_QUESTION_TYPE_META[question.questionType] ?? { label: question.questionType, description: "", icon: "HelpCircle" };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[24px_1fr_120px_70px_40px_40px] gap-3 px-3 py-3 border-b border-black/5 hover:bg-black/[0.02] transition-colors items-center"
    >
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="cursor-grab text-muted hover:text-foreground transition-colors">
        <GripVertical size={14} />
      </button>

      {/* Question text */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-accent">{index + 1}.</span>
        <span className="text-sm text-foreground truncate">{question.questionText}</span>
      </div>

      {/* Type badge */}
      <span className="text-xs text-muted bg-black/5 px-2 py-1 rounded-md w-fit truncate">
        {meta.label}
      </span>

      {/* Required */}
      <div className="flex justify-center">
        {question.isRequired ? (
          <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center">✓</span>
        ) : (
          <span className="w-5 h-5 rounded-full bg-black/5 text-muted text-[10px] flex items-center justify-center">—</span>
        )}
      </div>

      {/* Edit */}
      <button onClick={onEdit} className="p-1 rounded-lg hover:bg-black/5 text-muted hover:text-foreground transition-colors">
        <Edit3 size={14} />
      </button>

      {/* Delete */}
      <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
