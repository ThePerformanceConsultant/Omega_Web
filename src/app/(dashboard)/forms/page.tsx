"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, MoreHorizontal, Clock, Edit3, Copy, Trash2 } from "lucide-react";
import { FormTemplate, FormSubmission, FormType, FORM_TYPE_META } from "@/lib/types";
import { fetchFormSubmissions } from "@/lib/supabase/db";
import { useFormTemplates, formStore } from "@/lib/form-store";
import CreateFormModal from "@/components/forms/CreateFormModal";
import SubmissionDetailModal from "@/components/forms/SubmissionDetailModal";

export default function FormsPage() {
  const router = useRouter();
  const templates = useFormTemplates();
  const [activeTab, setActiveTab] = useState<"templates" | "submissions">("templates");
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);

  // Hydrate templates and submissions from Supabase on mount
  useEffect(() => {
    formStore.hydrate();
    fetchFormSubmissions()
      .then((data) => setSubmissions(data as FormSubmission[]))
      .catch((err) => console.error("[FormsPage] fetch submissions failed:", err));
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const filteredSubmissions = useMemo(() => {
    if (!search.trim()) return submissions;
    const q = search.toLowerCase();
    return submissions.filter(
      (s) => s.clientName.toLowerCase().includes(q) || s.templateName.toLowerCase().includes(q)
    );
  }, [submissions, search]);

  async function handleCreate(name: string, formType: FormType) {
    const newTemplate: FormTemplate = {
      id: Date.now(),
      coachId: "coach-1",
      name,
      formType,
      questions: [],
      schedule: null,
      assignedClientIds: [],
      createdAt: new Date().toISOString().split("T")[0],
      displayDays: null,
    };
    setShowCreateModal(false);
    try {
      const dbId = await formStore.add(newTemplate);
      router.push(`/forms/${dbId}`);
    } catch (err) {
      console.error("[FormsPage] create failed:", err);
    }
  }

  function handleDuplicate(template: FormTemplate) {
    formStore.duplicate(template);
    setMenuOpenId(null);
  }

  function handleDelete(id: number) {
    const t = templates.find((t) => t.id === id);
    if (t && (t.formType === "onboarding" || t.formType === "nutrition_intake")) return;
    formStore.remove(id);
    setMenuOpenId(null);
  }

  function clientCountText(t: FormTemplate) {
    const n = t.assignedClientIds.length;
    if (n === 0) return "Not assigned";
    return `${n} client${n > 1 ? "s" : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Tab bar + action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 border-b border-black/10">
          {(["templates", "submissions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab === "templates" ? "Form Templates" : "Form Submissions"}
            </button>
          ))}
        </div>

        {activeTab === "templates" && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-accent to-accent-light shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow"
          >
            <Plus size={16} /> New Form
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
        />
      </div>

      {/* Tab content */}
      {activeTab === "templates" ? (
        <TemplatesTable
          templates={filteredTemplates}
          menuOpenId={menuOpenId}
          setMenuOpenId={setMenuOpenId}
          onEdit={(id) => router.push(`/forms/${id}`)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          clientCountText={clientCountText}
        />
      ) : (
        <SubmissionsTable
          submissions={filteredSubmissions}
          onView={setViewingSubmission}
        />
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateFormModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
      {viewingSubmission && (
        <SubmissionDetailModal
          submission={viewingSubmission}
          template={templates.find((t) => t.id === viewingSubmission.templateId)}
          onClose={() => setViewingSubmission(null)}
          onReviewed={(id) => {
            setSubmissions((prev) =>
              prev.map((s) => (s.id === id ? { ...s, reviewed: true } : s))
            );
          }}
        />
      )}
    </div>
  );
}

// ===========================================
// Templates Table
// ===========================================

function TemplatesTable({
  templates, menuOpenId, setMenuOpenId, onEdit, onDuplicate, onDelete, clientCountText,
}: {
  templates: FormTemplate[];
  menuOpenId: number | null;
  setMenuOpenId: (id: number | null) => void;
  onEdit: (id: number) => void;
  onDuplicate: (t: FormTemplate) => void;
  onDelete: (id: number) => void;
  clientCountText: (t: FormTemplate) => string;
}) {
  if (templates.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-sm text-muted">No form templates found.</p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="grid grid-cols-[1fr_100px_100px_140px_180px_48px] gap-4 px-5 py-3 border-b border-black/10 bg-black/[0.02] rounded-t-xl">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Form</span>
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Type</span>
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Questions</span>
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Clients</span>
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Schedule</span>
        <span />
      </div>

      {templates.map((t) => {
        const meta = FORM_TYPE_META[t.formType];
        return (
          <div key={t.id} className="grid grid-cols-[1fr_100px_100px_140px_180px_48px] gap-4 px-5 py-4 border-b border-black/5 hover:bg-black/[0.02] transition-colors items-center">
            <button onClick={() => onEdit(t.id)} className="text-sm font-medium text-foreground text-left hover:text-accent transition-colors truncate">
              {t.name}
            </button>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium w-fit ${meta.bgColor} ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-sm text-muted">{t.questions.length} questions</span>
            <span className={`text-sm ${t.assignedClientIds.length ? "text-foreground" : "text-muted"}`}>
              {clientCountText(t)}
            </span>
            {t.schedule ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted"><Clock size={11} />{t.schedule.time}</span>
                {t.schedule.days.map((d) => (
                  <span key={d} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-accent/10 text-accent">{d}</span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted">Not Set</span>
            )}
            <RowMenu
              isOpen={menuOpenId === t.id}
              onToggle={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)}
              onClose={() => setMenuOpenId(null)}
              onEdit={() => { onEdit(t.id); setMenuOpenId(null); }}
              onDuplicate={() => onDuplicate(t)}
              onDelete={() => onDelete(t.id)}
              isProtected={t.formType === "onboarding" || t.formType === "nutrition_intake"}
            />
          </div>
        );
      })}
    </div>
  );
}

// ===========================================
// Row Action Menu (uses fixed positioning)
// ===========================================

function RowMenu({
  isOpen, onToggle, onClose, onEdit, onDuplicate, onDelete, isProtected,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isProtected?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 144 }); // 144 = w-36
    }
  }, [isOpen]);

  return (
    <div>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="p-1.5 rounded-lg hover:bg-black/5 text-muted hover:text-foreground transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            className="fixed z-50 w-36 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden"
            style={{ top: pos.top, left: pos.left }}
          >
            <button onClick={onEdit}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-black/5 transition-colors">
              <Edit3 size={14} className="text-muted" /> Edit
            </button>
            <button onClick={onDuplicate}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-black/5 transition-colors">
              <Copy size={14} className="text-muted" /> Duplicate
            </button>
            {!isProtected && (
              <button onClick={onDelete}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ===========================================
// Submissions Table
// ===========================================

function SubmissionsTable({
  submissions, onView,
}: {
  submissions: FormSubmission[];
  onView: (s: FormSubmission) => void;
}) {
  if (submissions.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-sm text-muted">No form submissions yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_160px_120px] gap-4 px-5 py-3 border-b border-black/10 bg-black/[0.02]">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Client</span>
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Form</span>
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Submitted</span>
        <span className="text-xs font-medium text-muted uppercase tracking-wider">Status</span>
      </div>

      {submissions
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .map((s) => (
          <button key={s.id} onClick={() => onView(s)}
            className="w-full grid grid-cols-[1fr_1fr_160px_120px] gap-4 px-5 py-4 border-b border-black/5 hover:bg-black/[0.02] transition-colors items-center text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center">
                {s.clientName.split(" ").map((w) => w[0]).join("")}
              </div>
              <span className="text-sm font-medium text-foreground truncate">{s.clientName}</span>
            </div>
            <span className="text-sm text-muted truncate">{s.templateName}</span>
            <span className="text-sm text-muted">
              {new Date(s.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })},{" "}
              {new Date(s.submittedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
              s.reviewed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}>
              {s.reviewed ? "Reviewed" : "Pending Review"}
            </span>
          </button>
        ))}
    </div>
  );
}
