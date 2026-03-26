"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen,
  FileText,
  Play,
  ImageIcon,
  ExternalLink,
  Plus,
  ChevronRight,
  Trash2,
  Pencil,
  X,
  Upload,
  Users,
  GraduationCap,
  Library,
  Search,
  Lightbulb,
  Save,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import {
  getCoachId,
  fetchVaultFolders,
  createVaultFolder,
  updateVaultFolder,
  deleteVaultFolder,
  fetchVaultItems,
  createVaultItem,
  updateVaultItem,
  deleteVaultItem,
  uploadVaultFile,
  deleteVaultFile,
  getVaultFileUrl,
  fetchCourseAccess,
  grantCourseAccess,
  revokeCourseAccess,
  fetchClients,
  fetchCoachInsights,
  createCoachInsight,
  updateCoachInsight,
  deleteCoachInsight,
  fetchCoachInsightSettings,
  upsertCoachInsightSettings,
  upsertCourseCurriculumProgram,
  fetchCourseCurriculum,
  upsertCurriculumWeek,
  upsertCurriculumTouchpoints,
  enrollClientInCurriculum,
  pauseCurriculumEnrollment,
  resumeCurriculumEnrollment,
} from "@/lib/supabase/db";
import type {
  VaultSection,
  VaultItemType,
  VaultFolder,
  VaultItem,
  Client,
  CoachInsight,
  CoachInsightSettings,
  InsightCadenceUnit,
  CurriculumTouchpoint,
  CourseAutomationProgramMode,
  CourseAutomationSummary,
  CourseWeekPlanRow,
  CourseAutomationEnrollmentRow,
} from "@/lib/types";

// ─── Helpers ───

function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fromDbFolder(row: Record<string, unknown>): VaultFolder {
  return {
    id: String(row.id),
    coachId: row.coach_id as string,
    parentId: row.parent_id != null ? String(row.parent_id) : null,
    section: row.section as VaultSection,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    dripEnabled: (row.drip_enabled as boolean) ?? false,
    dripIntervalDays: (row.drip_interval_days as number | null) ?? null,
    createdAt: row.created_at as string,
    isLocked: Boolean(row.is_locked ?? false),
    unlockAt: (row.unlock_at as string | null) ?? null,
    unlockWeek: row.unlock_week != null ? Number(row.unlock_week) : null,
  };
}

function fromDbItem(row: Record<string, unknown>): VaultItem {
  return {
    id: String(row.id),
    folderId: String(row.folder_id),
    coachId: row.coach_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    itemType: row.item_type as VaultItemType,
    fileUrl: (row.file_url as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    fileSize: (row.file_size as number | null) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string,
    isLocked: Boolean(row.is_locked ?? false),
    unlockAt: (row.unlock_at as string | null) ?? null,
    unlockWeek: row.unlock_week != null ? Number(row.unlock_week) : null,
  };
}

function fromDbInsight(row: Record<string, unknown>): CoachInsight {
  const tagsRaw = row.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  return {
    id: String(row.id),
    coachId: String(row.coach_id ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    tags,
    isActive: Boolean(row.is_active ?? true),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromDbInsightSettings(row: Record<string, unknown>): CoachInsightSettings {
  const cadenceUnitRaw = String(row.cadence_unit ?? "weeks");
  const cadenceUnit: InsightCadenceUnit = cadenceUnitRaw === "days" ? "days" : "weeks";
  return {
    coachId: String(row.coach_id ?? ""),
    cadenceUnit,
    cadenceValue: Math.max(1, Number(row.cadence_value ?? 1)),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function ItemTypeIcon({ type, size = 20 }: { type: VaultItemType; size?: number }) {
  switch (type) {
    case "pdf":
      return <FileText size={size} />;
    case "video":
      return <Play size={size} />;
    case "image":
      return <ImageIcon size={size} />;
    case "link":
      return <ExternalLink size={size} />;
  }
}

// ─── Depth labels ───

const DEPTH_LABELS: Record<VaultSection, string[]> = {
  resources: ["Folder", "Sub-folder"],
  courses: ["Course", "Module", "Lesson"],
};

function getMaxDepth(section: VaultSection): number {
  // Resources: root(0) → folder(1) → sub-folder(2) → items only
  // Courses:   root(0) → course(1) → module(2) → lesson(3) → items only
  return section === "resources" ? 2 : 3;
}

function buildDefaultCurriculumTouchpoints(): Array<{
  kind: CurriculumTouchpoint["kind"];
  dayOffset: number;
  localTime: string;
  payloadJson?: Record<string, unknown>;
  isRequired?: boolean;
  isEnabled?: boolean;
  sortOrder?: number;
}> {
  return [
    {
      kind: "unlock_content",
      dayOffset: 0,
      localTime: "06:00",
      payloadJson: {},
      isRequired: false,
      isEnabled: true,
      sortOrder: 10,
    },
    {
      kind: "kickoff_message",
      dayOffset: 0,
      localTime: "08:00",
      payloadJson: {
        template:
          "Week {{week_number}} starts today. Focus: {{focus_outcome}}. Your lecture: {{lecture_title}}.",
      },
      isRequired: true,
      isEnabled: true,
      sortOrder: 20,
    },
    {
      kind: "assign_quiz",
      dayOffset: 2,
      localTime: "12:00",
      payloadJson: { due_day_offset: 4, due_local_time: "20:00" },
      isRequired: true,
      isEnabled: true,
      sortOrder: 30,
    },
    {
      kind: "nudge_message",
      dayOffset: 3,
      localTime: "12:30",
      payloadJson: {
        template:
          "Mid-week reminder for {{theme_title}}. Quiz due {{quiz_due_local}}.",
      },
      isRequired: false,
      isEnabled: true,
      sortOrder: 40,
    },
    {
      kind: "assign_action_tasks",
      dayOffset: 4,
      localTime: "09:00",
      payloadJson: { due_day_offset: 6, due_local_time: "20:00" },
      isRequired: true,
      isEnabled: true,
      sortOrder: 50,
    },
    {
      kind: "assign_reflection",
      dayOffset: 5,
      localTime: "09:00",
      payloadJson: { due_day_offset: 6, due_local_time: "20:00" },
      isRequired: true,
      isEnabled: true,
      sortOrder: 60,
    },
    {
      kind: "recap_message",
      dayOffset: 6,
      localTime: "18:00",
      payloadJson: {
        template: "Week {{week_number}} recap for {{theme_title}}.",
      },
      isRequired: false,
      isEnabled: true,
      sortOrder: 70,
    },
  ];
}

type NoticeState = { type: "success" | "error" | "info"; text: string } | null;

type CourseFolderOption = {
  id: number;
  path: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}

function inferProgramMode(summary: CourseAutomationSummary): CourseAutomationProgramMode {
  const program = summary.program;
  if (!program) return "evergreen";
  if (!program.isActive || program.programMode === "off") return "off";
  if (program.programMode === "cohort_date") return "cohort_date";
  return "evergreen";
}

function ensureWeekRows(
  input: CourseWeekPlanRow[],
  durationWeeks: number
): CourseWeekPlanRow[] {
  const safeDuration = Math.max(1, Math.min(104, durationWeeks || 16));
  const byWeek = new Map<number, CourseWeekPlanRow>();
  for (const row of input) byWeek.set(row.weekNumber, row);
  const out: CourseWeekPlanRow[] = [];
  for (let week = 1; week <= safeDuration; week += 1) {
    out.push(
      byWeek.get(week) ?? {
        id: 0,
        programId: 0,
        weekNumber: week,
        themeTitle: `Week ${week} Focus`,
        focusOutcome: null,
        lectureFolderId: null,
        summaryPrompt: null,
        touchpoints: [],
      }
    );
  }
  return out;
}

// ─── Create / Edit Folder Modal ───

function FolderModal({
  section,
  depth,
  folder,
  onClose,
  onSave,
}: {
  section: VaultSection;
  depth: number;
  folder: VaultFolder | null;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [saving, setSaving] = useState(false);
  const label = DEPTH_LABELS[section][depth] ?? "Folder";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{folder ? `Edit ${label}` : `New ${label}`}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${label} name`}
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description"
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted hover:bg-black/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-accent to-accent-light text-white font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : folder ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Add / Edit Item Modal ───

function ItemModal({
  item,
  coachId,
  folderId,
  onClose,
  onSaved,
}: {
  item: VaultItem | null;
  coachId: string;
  folderId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [itemType, setItemType] = useState<VaultItemType>(item?.itemType ?? "pdf");
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [url, setUrl] = useState(item?.externalUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!item;
  const needsFile = itemType === "pdf" || itemType === "image";
  const needsUrl = itemType === "video" || itemType === "link";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    try {
      let fileUrl = item?.fileUrl ?? null;
      let fileSize = item?.fileSize ?? null;
      let thumbnailUrl = item?.thumbnailUrl ?? null;

      // Upload file if selected
      if (file && needsFile) {
        const result = await uploadVaultFile(coachId, folderId, file);
        fileUrl = result.path;
        fileSize = result.size;
        // Delete old file if editing
        if (item?.fileUrl) {
          try { await deleteVaultFile(item.fileUrl); } catch { /* ignore */ }
        }
      }

      // YouTube auto-thumbnail
      if (itemType === "video" && url) {
        const ytId = extractYouTubeId(url);
        if (ytId) thumbnailUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
      }

      if (isEdit) {
        await updateVaultItem(Number(item.id), {
          title: title.trim(),
          description: description.trim() || null,
          fileUrl,
          externalUrl: needsUrl ? url.trim() : null,
          thumbnailUrl,
        });
      } else {
        await createVaultItem({
          coachId,
          folderId,
          title: title.trim(),
          description: description.trim() || null,
          itemType,
          fileUrl,
          externalUrl: needsUrl ? url.trim() : null,
          thumbnailUrl,
          fileSize,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("[Vault] Save item failed:", err);
    } finally {
      setSaving(false);
    }
  }

  const typeOptions: { value: VaultItemType; label: string; icon: typeof FileText }[] = [
    { value: "pdf", label: "PDF", icon: FileText },
    { value: "video", label: "Video", icon: Play },
    { value: "image", label: "Image", icon: ImageIcon },
    { value: "link", label: "Link", icon: ExternalLink },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{isEdit ? "Edit Item" : "Add Item"}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        {/* Type selector (not editable on edit) */}
        {!isEdit && (
          <div className="flex gap-2">
            {typeOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setItemType(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    itemType === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-black/10 text-muted hover:border-black/20"
                  }`}
                >
                  <Icon size={16} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Item title"
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description"
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none resize-none"
          />
        </div>

        {/* File upload for PDF / Image */}
        {needsFile && (
          <div>
            <label className="text-xs font-medium text-muted block mb-1">
              {itemType === "pdf" ? "PDF File" : "Image File"}
            </label>
            <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-black/15 hover:border-accent/40 cursor-pointer transition-colors">
              <Upload size={24} className="text-muted" />
              <span className="text-xs text-muted">
                {file ? file.name : isEdit && item?.fileUrl ? "Replace file" : "Click to upload"}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept={itemType === "pdf" ? ".pdf" : "image/*"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                  }
                }}
                className="hidden"
              />
            </label>
            {file && (
              <p className="text-[10px] text-muted mt-1">{formatFileSize(file.size)}</p>
            )}
          </div>
        )}

        {/* URL input for Video / Link */}
        {needsUrl && (
          <div>
            <label className="text-xs font-medium text-muted block mb-1">
              {itemType === "video" ? "YouTube URL" : "URL"}
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={itemType === "video" ? "https://youtube.com/watch?v=..." : "https://example.com"}
              className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
            />
            {itemType === "video" && url && extractYouTubeId(url) && (
              <div className="mt-2 rounded-lg overflow-hidden border border-black/10">
                <img
                  src={`https://img.youtube.com/vi/${extractYouTubeId(url)}/mqdefault.jpg`}
                  alt="Thumbnail"
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted hover:bg-black/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving || (needsFile && !file && !isEdit) || (needsUrl && !url.trim())}
            className="px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-accent to-accent-light text-white font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Course Access Modal ───

function CourseAccessModal({
  folderId,
  folderName,
  clients,
  onClose,
}: {
  folderId: number;
  folderName: string;
  clients: Client[];
  onClose: () => void;
}) {
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCourseAccess(folderId)
      .then((ids) => setEnrolledIds(new Set(ids)))
      .catch((err) => console.error("[Vault] fetchCourseAccess:", err))
      .finally(() => setLoading(false));
  }, [folderId]);

  async function toggle(clientId: string) {
    const isEnrolled = enrolledIds.has(clientId);
    // Optimistic
    setEnrolledIds((prev) => {
      const next = new Set(prev);
      if (isEnrolled) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
    try {
      if (isEnrolled) await revokeCourseAccess(folderId, clientId);
      else await grantCourseAccess(folderId, clientId);
    } catch (err) {
      console.error("[Vault] toggle access:", err);
      // Revert
      setEnrolledIds((prev) => {
        const next = new Set(prev);
        if (isEnrolled) next.add(clientId);
        else next.delete(clientId);
        return next;
      });
    }
  }

  const filtered = clients.filter((c) =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Manage Access</h3>
            <p className="text-xs text-muted">{folderName} — {enrolledIds.size} enrolled</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading ? (
            <p className="text-sm text-muted text-center py-6">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">No clients found</p>
          ) : (
            filtered.map((c) => {
              const enrolled = enrolledIds.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      enrolled ? "bg-accent border-accent" : "border-black/20"
                    }`}
                  >
                    {enrolled && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                    {c.avatar_initials || c.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{c.full_name}</p>
                    {c.email && <p className="text-[10px] text-muted truncate">{c.email}</p>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-gradient-to-br from-accent to-accent-light text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function CourseAutomationDrawer({
  course,
  clients,
  onClose,
  onChanged,
}: {
  course: VaultFolder;
  clients: Client[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [summary, setSummary] = useState<CourseAutomationSummary>({
    program: null,
    weeks: [],
    enrollments: [],
  });
  const [programName, setProgramName] = useState("");
  const [programMode, setProgramMode] = useState<CourseAutomationProgramMode>("evergreen");
  const [durationWeeks, setDurationWeeks] = useState(16);
  const [cohortStartDate, setCohortStartDate] = useState(today);
  const [weekRows, setWeekRows] = useState<CourseWeekPlanRow[]>([]);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [folderOptions, setFolderOptions] = useState<CourseFolderOption[]>([]);
  const [folderSearch, setFolderSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enrollClientId, setEnrollClientId] = useState("");
  const [enrollTimezone, setEnrollTimezone] = useState(browserTimezone);
  const [enrollStartDate, setEnrollStartDate] = useState(today);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [isSavingWeeks, setIsSavingWeeks] = useState(false);
  const [isResettingTouchpoints, setIsResettingTouchpoints] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUpdatingEnrollmentId, setIsUpdatingEnrollmentId] = useState<number | null>(null);

  const filteredFolderOptions = folderSearch
    ? folderOptions.filter((entry) => entry.path.toLowerCase().includes(folderSearch.toLowerCase()))
    : folderOptions;

  const selectedWeek = weekRows.find((row) => row.weekNumber === selectedWeekNumber) ?? null;

  const loadCourseFolderOptions = useCallback(async (): Promise<CourseFolderOption[]> => {
    const rootId = Number(course.id);
    const rootPath = course.name;
    const out: CourseFolderOption[] = [{ id: rootId, path: rootPath }];
    const visited = new Set<number>([rootId]);

    async function walk(parentId: number, parentPath: string) {
      const children = await fetchVaultFolders("courses", parentId);
      const mapped = children.map((row) => fromDbFolder(row as Record<string, unknown>));
      for (const child of mapped) {
        const childId = Number(child.id);
        if (!Number.isFinite(childId) || childId <= 0 || visited.has(childId)) continue;
        visited.add(childId);
        const path = `${parentPath} / ${child.name}`;
        out.push({ id: childId, path });
        await walk(childId, path);
      }
    }

    await walk(rootId, rootPath);
    return out;
  }, [course.id, course.name]);

  const reload = useCallback(async () => {
    const [nextSummary, nextOptions] = await Promise.all([
      fetchCourseCurriculum(Number(course.id)),
      loadCourseFolderOptions(),
    ]);
    const inferredMode = inferProgramMode(nextSummary);
    const nextDuration = nextSummary.program?.durationWeeks ?? 16;
    const nextWeeks = ensureWeekRows(nextSummary.weeks, nextDuration);

    setSummary(nextSummary);
    setProgramName(nextSummary.program?.name ?? `${course.name} Automation`);
    setProgramMode(inferredMode);
    setDurationWeeks(nextDuration);
    setCohortStartDate(nextSummary.program?.cohortStartDate ?? today);
    setWeekRows(nextWeeks);
    setSelectedWeekNumber(nextWeeks[0]?.weekNumber ?? 1);
    setFolderOptions(nextOptions);
    setEnrollStartDate(nextSummary.program?.cohortStartDate ?? today);
  }, [course.id, course.name, loadCourseFolderOptions, today]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    reload()
      .catch((error) => {
        if (cancelled) return;
        setNotice({ type: "error", text: getErrorMessage(error, "Could not load course automation.") });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function updateWeekRow(weekNumber: number, patch: Partial<CourseWeekPlanRow>) {
    setWeekRows((prev) => prev.map((row) => (
      row.weekNumber === weekNumber ? { ...row, ...patch } : row
    )));
  }

  async function handleSaveProgram() {
    setNotice(null);
    if (programMode === "cohort_date" && !cohortStartDate) {
      setNotice({ type: "error", text: "Choose a cohort start date for cohort mode." });
      return;
    }
    setIsSavingProgram(true);
    try {
      const saved = await upsertCourseCurriculumProgram({
        courseFolderId: Number(course.id),
        name: programName.trim() || `${course.name} Automation`,
        durationWeeks: Math.max(1, Math.min(104, durationWeeks || 16)),
        isActive: programMode !== "off",
        seedDefaults: true,
        programMode,
        cohortStartDate: programMode === "cohort_date" ? cohortStartDate : null,
      });
      await reload();
      setNotice({
        type: "success",
        text: saved ? "Program settings saved." : "Program save returned no data.",
      });
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error, "Could not save program settings.") });
    } finally {
      setIsSavingProgram(false);
    }
  }

  async function handleSaveWeekMap() {
    setNotice(null);
    if (!summary.program?.id) {
      setNotice({ type: "info", text: "Save Program first." });
      return;
    }
    setIsSavingWeeks(true);
    try {
      for (const week of weekRows) {
        await upsertCurriculumWeek({
          // Use (program_id, week_number) upsert path so "Not linked" can clear lectureFolderId.
          id: null,
          programId: summary.program.id,
          weekNumber: week.weekNumber,
          themeTitle: week.themeTitle.trim() || `Week ${week.weekNumber} Focus`,
          focusOutcome: week.focusOutcome?.trim() || null,
          lectureFolderId: week.lectureFolderId,
          summaryPrompt: week.summaryPrompt?.trim() || null,
          seedTouchpoints: true,
        });
      }
      await reload();
      setNotice({ type: "success", text: "Week map saved." });
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error, "Could not save week map.") });
    } finally {
      setIsSavingWeeks(false);
    }
  }

  async function handleResetWeekTouchpoints() {
    setNotice(null);
    if (!selectedWeek || !selectedWeek.id) {
      setNotice({ type: "info", text: "Save week map first to generate week rows." });
      return;
    }
    setIsResettingTouchpoints(true);
    try {
      await upsertCurriculumTouchpoints(selectedWeek.id, buildDefaultCurriculumTouchpoints());
      await reload();
      setNotice({ type: "success", text: `Default touchpoints applied for week ${selectedWeek.weekNumber}.` });
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error, "Could not reset week touchpoints.") });
    } finally {
      setIsResettingTouchpoints(false);
    }
  }

  async function handleEnrollClient() {
    setNotice(null);
    if (!summary.program?.id) {
      setNotice({ type: "info", text: "Save Program first." });
      return;
    }
    if (!enrollClientId) {
      setNotice({ type: "info", text: "Select a client first." });
      return;
    }
    const effectiveStartDate = programMode === "cohort_date"
      ? (cohortStartDate || today)
      : enrollStartDate;
    if (!effectiveStartDate) {
      setNotice({ type: "error", text: "Choose a start date before enrolling." });
      return;
    }
    setIsEnrolling(true);
    try {
      await grantCourseAccess(Number(course.id), enrollClientId);
      await enrollClientInCurriculum({
        clientId: enrollClientId,
        programId: summary.program.id,
        startDate: effectiveStartDate,
        timezone: enrollTimezone || null,
      });
      await reload();
      await onChanged();
      setNotice({ type: "success", text: "Client enrolled in course automation." });
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error, "Could not enroll client.") });
    } finally {
      setIsEnrolling(false);
    }
  }

  async function handlePauseResume(entry: CourseAutomationEnrollmentRow) {
    setNotice(null);
    setIsUpdatingEnrollmentId(entry.enrollmentId);
    try {
      if (entry.enrollmentStatus === "active") {
        await pauseCurriculumEnrollment(entry.enrollmentId);
      } else if (entry.enrollmentStatus === "paused") {
        await resumeCurriculumEnrollment(entry.enrollmentId);
      }
      await reload();
      setNotice({
        type: "success",
        text: `${entry.clientName} ${entry.enrollmentStatus === "active" ? "paused" : "resumed"}.`,
      });
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error, "Could not update enrollment.") });
    } finally {
      setIsUpdatingEnrollmentId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[1px]" onClick={onClose}>
      <aside
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-4xl bg-white shadow-2xl flex flex-col"
      >
        <div className="px-6 py-4 border-b border-black/10 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Course Automation Builder</p>
            <h3 className="text-lg font-bold text-foreground mt-0.5">{course.name}</h3>
            <p className="text-xs text-muted mt-1">Build your 16-week experience directly inside this course.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {notice && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                notice.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : notice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
              }`}
            >
              {notice.text}
            </div>
          )}

          {loading ? (
            <div className="glass-card p-6 text-sm text-muted">Loading course automation…</div>
          ) : (
            <>
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Step 1 · Program Setup</h4>
                    <p className="text-xs text-muted">Choose mode, duration, and cadence baseline for this course.</p>
                  </div>
                  <button
                    onClick={handleSaveProgram}
                    disabled={isSavingProgram}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/30 text-accent text-xs font-medium hover:bg-accent/5 disabled:opacity-50"
                  >
                    {isSavingProgram ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Program
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="block text-xs text-muted md:col-span-2">
                    Program name
                    <input
                      value={programName}
                      onChange={(event) => setProgramName(event.target.value)}
                      className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Mode
                    <select
                      value={programMode}
                      onChange={(event) => setProgramMode(event.target.value as CourseAutomationProgramMode)}
                      className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                    >
                      <option value="off">Off</option>
                      <option value="evergreen">Evergreen</option>
                      <option value="cohort_date">Cohort date</option>
                    </select>
                  </label>
                  <label className="block text-xs text-muted">
                    Duration (weeks)
                    <input
                      type="number"
                      min={1}
                      max={104}
                      value={durationWeeks}
                      onChange={(event) => setDurationWeeks(Math.max(1, Math.min(104, Number(event.target.value || 16))))}
                      className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                    />
                  </label>
                </div>

                {programMode === "cohort_date" && (
                  <label className="block text-xs text-muted max-w-xs">
                    Cohort start date
                    <input
                      type="date"
                      value={cohortStartDate}
                      onChange={(event) => setCohortStartDate(event.target.value)}
                      className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                    />
                  </label>
                )}
              </div>

              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Step 2 · Week Journey Map</h4>
                    <p className="text-xs text-muted">Map themes and link each week to a module/lesson path in this course tree.</p>
                  </div>
                  <button
                    onClick={handleSaveWeekMap}
                    disabled={isSavingWeeks}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/30 text-accent text-xs font-medium hover:bg-accent/5 disabled:opacity-50"
                  >
                    {isSavingWeeks ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Week Map
                  </button>
                </div>

                <label className="block text-xs text-muted max-w-sm">
                  Search course path
                  <input
                    value={folderSearch}
                    onChange={(event) => setFolderSearch(event.target.value)}
                    placeholder="e.g. Course / Module 2 / Lesson 1"
                    className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                  />
                </label>

                <div className="max-h-[320px] overflow-y-auto rounded-lg border border-black/10">
                  <table className="w-full text-xs">
                    <thead className="bg-black/[0.03] sticky top-0">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-semibold">Week</th>
                        <th className="px-3 py-2 font-semibold">Theme</th>
                        <th className="px-3 py-2 font-semibold">Focus Outcome</th>
                        <th className="px-3 py-2 font-semibold">Linked Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekRows.map((row) => (
                        <tr key={row.weekNumber} className="border-t border-black/5">
                          <td className="px-3 py-2 align-top font-semibold text-foreground">W{row.weekNumber}</td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={row.themeTitle}
                              onChange={(event) => updateWeekRow(row.weekNumber, { themeTitle: event.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-md bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={row.focusOutcome ?? ""}
                              onChange={(event) => updateWeekRow(row.weekNumber, { focusOutcome: event.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-md bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <select
                              value={row.lectureFolderId ?? ""}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                updateWeekRow(row.weekNumber, {
                                  lectureFolderId: Number.isFinite(next) && next > 0 ? next : null,
                                });
                              }}
                              className="w-full px-2.5 py-1.5 rounded-md bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                            >
                              <option value="">Not linked</option>
                              {filteredFolderOptions.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                  {folder.path}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-accent" />
                  <h4 className="text-sm font-semibold text-foreground">Step 3 · Enroll Clients</h4>
                </div>
                <p className="text-xs text-muted">Enrollment syncs course access and automation start together.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block text-xs text-muted md:col-span-1">
                    Client
                    <select
                      value={enrollClientId}
                      onChange={(event) => setEnrollClientId(event.target.value)}
                      className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                    >
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.full_name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs text-muted">
                    Start date
                    <input
                      type="date"
                      value={programMode === "cohort_date" ? (cohortStartDate || today) : enrollStartDate}
                      disabled={programMode === "cohort_date"}
                      onChange={(event) => setEnrollStartDate(event.target.value)}
                      className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 disabled:opacity-60 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                    />
                  </label>

                  <label className="block text-xs text-muted">
                    Timezone
                    <input
                      value={enrollTimezone}
                      onChange={(event) => setEnrollTimezone(event.target.value)}
                      className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                    />
                  </label>
                </div>

                <button
                  onClick={handleEnrollClient}
                  disabled={isEnrolling || !enrollClientId || !summary.program}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium disabled:opacity-50"
                >
                  {isEnrolling ? <RefreshCw size={14} className="animate-spin" /> : <Users size={14} />}
                  Enroll Client
                </button>

                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-muted uppercase tracking-wide">Active Enrollments</h5>
                  {summary.enrollments.length === 0 ? (
                    <p className="text-xs text-muted">No active enrollments yet.</p>
                  ) : (
                    summary.enrollments.map((entry) => (
                      <div key={entry.enrollmentId} className="px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{entry.clientName} · Week {entry.currentWeek}</p>
                          <p className="text-xs text-muted">{entry.outcomeStatus.replaceAll("_", " ")} · Score {entry.competencyScore ?? 0}</p>
                        </div>
                        {(entry.enrollmentStatus === "active" || entry.enrollmentStatus === "paused") && (
                          <button
                            onClick={() => handlePauseResume(entry)}
                            disabled={isUpdatingEnrollmentId === entry.enrollmentId}
                            className="px-3 py-1.5 rounded-lg border border-black/10 text-xs font-medium text-muted hover:text-foreground hover:bg-black/5 disabled:opacity-50"
                          >
                            {isUpdatingEnrollmentId === entry.enrollmentId
                              ? "Updating..."
                              : entry.enrollmentStatus === "active"
                                ? "Pause"
                                : "Resume"}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-card p-5 space-y-3">
                <button
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-sm font-semibold text-foreground">Advanced Controls</span>
                  <ChevronDown size={16} className={`text-muted transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </button>
                {showAdvanced && (
                  <div className="space-y-4">
                    <div className="flex items-end gap-3">
                      <label className="block text-xs text-muted">
                        Week
                        <select
                          value={selectedWeekNumber}
                          onChange={(event) => setSelectedWeekNumber(Math.max(1, Number(event.target.value || 1)))}
                          className="mt-1.5 px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                        >
                          {weekRows.map((row) => (
                            <option key={row.weekNumber} value={row.weekNumber}>Week {row.weekNumber}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={handleResetWeekTouchpoints}
                        disabled={isResettingTouchpoints}
                        className="px-3 py-2 rounded-lg border border-black/10 text-xs font-medium text-muted hover:text-foreground hover:bg-black/5 disabled:opacity-50"
                      >
                        {isResettingTouchpoints ? "Resetting..." : "Reset Touchpoints"}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Touchpoints</p>
                      {selectedWeek?.touchpoints?.length ? (
                        selectedWeek.touchpoints.map((touchpoint) => (
                          <div key={touchpoint.id} className="px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02] flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{touchpoint.kind.replaceAll("_", " ")}</p>
                              <p className="text-xs text-muted">Day {touchpoint.dayOffset} at {touchpoint.localTime.slice(0, 5)}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full ${touchpoint.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}>
                              {touchpoint.isEnabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted">No touchpoints loaded for this week.</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
                        <ListChecks size={12} />
                        Template Variables
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {`{{client_first_name}}, {{week_number}}, {{theme_title}}, {{focus_outcome}}, {{lecture_title}}, {{quiz_due_local}}, {{task_summary}}, {{last_week_score}}`}
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>Risk alert thresholds currently follow the v1 engine defaults (70). Touchpoint and content mapping changes apply immediately.</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Folder Card ───

function FolderCard({
  folder,
  enrolledCount,
  isCourse,
  onClick,
  onEdit,
  onDelete,
  onManageAccess,
  onAutomation,
}: {
  folder: VaultFolder;
  enrolledCount?: number;
  isCourse: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageAccess?: () => void;
  onAutomation?: () => void;
}) {
  const isRootCourse = isCourse && folder.parentId === null;
  const label =
    folder.section === "courses"
      ? folder.parentId === null
        ? "Course"
        : "Module"
      : "Folder";

  return (
    <div className="group glass-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      {/* Thumbnail area */}
      <div className="h-32 bg-gradient-to-br from-black/[0.04] to-black/[0.08] flex items-center justify-center relative">
        {folder.thumbnailUrl ? (
          <img src={folder.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <FolderOpen size={32} className="text-muted/40" />
        )}
        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-lg bg-white/90 shadow flex items-center justify-center text-muted hover:text-foreground"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-lg bg-white/90 shadow flex items-center justify-center text-danger hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </div>
        {/* Enrolled badge */}
        {isRootCourse && enrolledCount !== undefined && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 shadow text-[10px] font-medium text-muted">
            <Users size={10} /> {enrolledCount}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold truncate">{folder.name}</p>
        <p className="text-[10px] text-muted mt-0.5">{label}</p>
        {folder.description && (
          <p className="text-xs text-muted mt-1 line-clamp-2">{folder.description}</p>
        )}
      </div>
      {/* Manage access button for root courses */}
      {isRootCourse && (onManageAccess || onAutomation) && (
        <div className="px-3 pb-3 space-y-1.5">
          {onAutomation && (
            <button
              onClick={(e) => { e.stopPropagation(); onAutomation(); }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-accent/30 text-xs font-medium text-accent hover:bg-accent/5 transition-colors"
            >
              <Sparkles size={12} /> Automation
            </button>
          )}
          {onManageAccess && (
            <button
              onClick={(e) => { e.stopPropagation(); onManageAccess(); }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-black/10 text-xs font-medium text-muted hover:border-accent/40 hover:text-accent transition-colors"
            >
              <Users size={12} /> Manage Access
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item Card ───

function ItemCardComponent({
  item,
  onEdit,
  onDelete,
  onClick,
}: {
  item: VaultItem;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const hasThumbnail = !!item.thumbnailUrl;

  return (
    <div className="group glass-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      {/* Thumbnail / type area */}
      <div className="h-32 bg-gradient-to-br from-black/[0.04] to-black/[0.08] flex items-center justify-center relative">
        {hasThumbnail ? (
          <>
            <img src={item.thumbnailUrl!} alt="" className="w-full h-full object-cover" />
            {item.itemType === "video" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                  <Play size={20} className="text-white ml-0.5" fill="white" />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted/40">
            <ItemTypeIcon type={item.itemType} size={32} />
            <span className="text-[10px] uppercase tracking-wide">{item.itemType}</span>
          </div>
        )}
        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-lg bg-white/90 shadow flex items-center justify-center text-muted hover:text-foreground"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-lg bg-white/90 shadow flex items-center justify-center text-danger hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </div>
        {/* Type badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-white/90 shadow text-[10px] font-medium text-muted uppercase">
          {item.itemType}
        </div>
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted mt-1 line-clamp-2">{item.description}</p>
        )}
        {item.fileSize && (
          <p className="text-[10px] text-muted mt-1">{formatFileSize(item.fileSize)}</p>
        )}
      </div>
    </div>
  );
}

function InsightModal({
  insight,
  onClose,
  onSave,
}: {
  insight: CoachInsight | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    body: string;
    tags: string[];
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(insight?.title ?? "");
  const [body, setBody] = useState(insight?.body ?? "");
  const [tagsText, setTagsText] = useState((insight?.tags ?? []).join(", "));
  const [isActive, setIsActive] = useState(insight?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const tags = tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await onSave({
        title: title.trim(),
        body: body.trim(),
        tags,
        isActive,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{insight ? "Edit Insight" : "New Insight"}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short headline"
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Insight</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Actionable coaching tip..."
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none resize-y"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Tags (comma separated)</label>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="sleep, recovery, consistency"
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-black/20 accent-accent"
          />
          Active (eligible for client rotation)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted hover:bg-black/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !body.trim() || saving}
            className="px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-accent to-accent-light text-white font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : insight ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InsightCard({
  insight,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  insight: CoachInsight;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
}) {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground truncate">{insight.title}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${insight.isActive ? "bg-emerald-100 text-emerald-700" : "bg-black/10 text-muted"}`}>
              {insight.isActive ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-xs text-muted mt-1 whitespace-pre-wrap line-clamp-4">{insight.body}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg bg-black/5 hover:bg-black/10 flex items-center justify-center text-muted"
            aria-label="Edit insight"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg bg-black/5 hover:bg-black/10 flex items-center justify-center text-danger"
            aria-label="Delete insight"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {insight.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insight.tags.map((tag) => (
            <span key={`${insight.id}-${tag}`} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              {tag}
            </span>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={insight.isActive}
          onChange={(e) => onToggleActive(e.target.checked)}
          className="w-4 h-4 rounded border-black/20 accent-accent"
        />
        Include in rotation
      </label>
    </div>
  );
}

// ─── Main Page ───

type BreadcrumbEntry = { id: number; name: string };
type VaultTab = VaultSection | "insights";

export default function VaultPage() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VaultTab>("resources");
  const [folderPath, setFolderPath] = useState<BreadcrumbEntry[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [insightSettings, setInsightSettings] = useState<CoachInsightSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [courseAccessCounts, setCourseAccessCounts] = useState<Record<string, number>>({});
  const [savingCadence, setSavingCadence] = useState(false);

  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VaultFolder | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [editingInsight, setEditingInsight] = useState<CoachInsight | null>(null);
  const [courseAccessTarget, setCourseAccessTarget] = useState<{ id: number; name: string } | null>(null);
  const [courseAutomationTarget, setCourseAutomationTarget] = useState<VaultFolder | null>(null);

  const isInsightsTab = activeTab === "insights";
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;
  const depth = folderPath.length;
  const maxDepth = !isInsightsTab ? getMaxDepth(activeTab as VaultSection) : 0;
  const canCreateSubfolder = !isInsightsTab && depth < maxDepth;
  const canAddItem = !isInsightsTab && depth > 0;
  const isInsideFolder = !isInsightsTab && depth > 0;

  // ─── Load data ───

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "insights") {
        const [fetchedInsights, fetchedSettings] = await Promise.all([
          fetchCoachInsights(),
          fetchCoachInsightSettings(coachId ?? undefined),
        ]);
        setInsights(fetchedInsights.map((row) => fromDbInsight(row as Record<string, unknown>)));
        if (fetchedSettings) {
          setInsightSettings(fromDbInsightSettings(fetchedSettings as Record<string, unknown>));
        } else if (coachId) {
          setInsightSettings({
            coachId,
            cadenceUnit: "weeks",
            cadenceValue: 1,
            updatedAt: new Date().toISOString(),
          });
        } else {
          setInsightSettings(null);
        }
        setFolders([]);
        setItems([]);
        return;
      }

      const fetchedFolders = await fetchVaultFolders(activeTab, currentFolderId);
      setFolders(fetchedFolders.map(fromDbFolder));

      if (currentFolderId !== null) {
        const fetchedItems = await fetchVaultItems(currentFolderId);
        const mapped = fetchedItems.map(fromDbItem);

        // Resolve signed URLs for uploaded files so images render as thumbnails
        const resolved = await Promise.all(
          mapped.map(async (item) => {
            if (!item.fileUrl) return item;
            try {
              const signedUrl = await getVaultFileUrl(item.fileUrl);
              return {
                ...item,
                storagePath: item.fileUrl, // preserve original for delete
                thumbnailUrl: item.itemType === "image" ? signedUrl : item.thumbnailUrl,
                fileUrl: signedUrl,
              };
            } catch {
              return item;
            }
          })
        );
        setItems(resolved);
      } else {
        setItems([]);
      }

      // Load course access counts for root courses view
      if (activeTab === "courses" && currentFolderId === null) {
        const rootFolders = fetchedFolders.map(fromDbFolder);
        const counts: Record<string, number> = {};
        await Promise.all(
          rootFolders.map(async (f) => {
            try {
              const ids = await fetchCourseAccess(Number(f.id));
              counts[f.id] = ids.length;
            } catch { /* ignore */ }
          })
        );
        setCourseAccessCounts(counts);
      }
    } catch (err) {
      console.error("[Vault] loadData:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentFolderId, coachId]);

  useEffect(() => {
    getCoachId().then((id) => {
      if (id) setCoachId(id);
    });
    fetchClients()
      .then((data) => setClients(data as Client[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab switching is handled in switchTab() — no separate effect needed

  // ─── Navigation ───

  function navigateIntoFolder(folder: VaultFolder) {
    setFolderPath((prev) => [...prev, { id: Number(folder.id), name: folder.name }]);
  }

  function navigateToBreadcrumb(index: number) {
    // index -1 = root
    if (index < 0) {
      setFolderPath([]);
    } else {
      setFolderPath((prev) => prev.slice(0, index + 1));
    }
  }

  // ─── CRUD handlers ───

  async function handleSaveFolder(name: string, description: string) {
    if (!coachId) return;
    if (activeTab === "insights") return;
    if (editingFolder) {
      await updateVaultFolder(Number(editingFolder.id), { name, description: description || null });
    } else {
      await createVaultFolder({
        coachId,
        section: activeTab,
        parentId: currentFolderId,
        name,
        description: description || null,
      });
    }
    await loadData();
  }

  async function handleSaveInsight(input: {
    title: string;
    body: string;
    tags: string[];
    isActive: boolean;
  }) {
    if (!coachId) return;
    if (editingInsight) {
      await updateCoachInsight(Number(editingInsight.id), {
        title: input.title,
        body: input.body,
        tags: input.tags,
        isActive: input.isActive,
      });
    } else {
      await createCoachInsight({
        coachId,
        title: input.title,
        body: input.body,
        tags: input.tags,
        isActive: input.isActive,
      });
    }
    await loadData();
  }

  async function handleDeleteInsight(insight: CoachInsight) {
    if (!confirm(`Delete insight "${insight.title}"?`)) return;
    await deleteCoachInsight(Number(insight.id));
    await loadData();
  }

  async function handleToggleInsightActive(insight: CoachInsight, next: boolean) {
    try {
      await updateCoachInsight(Number(insight.id), { isActive: next });
      setInsights((prev) => prev.map((entry) => (
        entry.id === insight.id ? { ...entry, isActive: next } : entry
      )));
    } catch (err) {
      console.error("[Vault] toggle insight active failed:", err);
    }
  }

  async function handleSaveCadence() {
    if (!coachId) return;
    const unit = insightSettings?.cadenceUnit ?? "weeks";
    const value = Math.max(1, Math.floor(insightSettings?.cadenceValue ?? 1));

    setSavingCadence(true);
    try {
      const row = await upsertCoachInsightSettings({
        coachId,
        cadenceUnit: unit,
        cadenceValue: value,
      });
      if (row) {
        setInsightSettings(fromDbInsightSettings(row as Record<string, unknown>));
      } else {
        setInsightSettings((prev) => prev ? { ...prev, cadenceUnit: unit, cadenceValue: value } : prev);
      }
    } finally {
      setSavingCadence(false);
    }
  }

  async function handleDeleteFolder(folder: VaultFolder) {
    if (!confirm(`Delete "${folder.name}" and all its contents?`)) return;
    await deleteVaultFolder(Number(folder.id));
    await loadData();
  }

  async function handleDeleteItem(item: VaultItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    // Delete file from storage using original path (not signed URL)
    const path = item.storagePath || item.fileUrl;
    if (path && !path.startsWith("http")) {
      try { await deleteVaultFile(path); } catch { /* ignore */ }
    }
    await deleteVaultItem(Number(item.id));
    await loadData();
  }

  function handleItemClick(item: VaultItem) {
    // fileUrl is already a signed URL (resolved in loadData)
    const url = item.fileUrl || item.externalUrl;
    if (url) window.open(url, "_blank");
  }

  // ─── Render ───

  const tabOptions: { value: VaultTab; label: string; icon: typeof Library }[] = [
    { value: "resources", label: "Resources", icon: Library },
    { value: "courses", label: "Courses", icon: GraduationCap },
    { value: "insights", label: "Insights", icon: Lightbulb },
  ];

  return (
    <div className="space-y-6">
      {/* Header with tabs and action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.04]">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  if (tab.value === activeTab) return;
                  setActiveTab(tab.value);
                  setFolderPath([]);
                  setFolders([]);
                  setItems([]);
                  setInsights([]);
                  setCourseAccessTarget(null);
                  setCourseAutomationTarget(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-white shadow text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {isInsightsTab && (
            <button
              onClick={() => { setEditingInsight(null); setShowInsightModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
            >
              <Plus size={16} />
              Insight
            </button>
          )}
          {canCreateSubfolder && (
            <button
              onClick={() => { setEditingFolder(null); setShowFolderModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
            >
              <Plus size={16} />
              {DEPTH_LABELS[activeTab as VaultSection][depth] ?? "Folder"}
            </button>
          )}
          {canAddItem && (
            <button
              onClick={() => { setEditingItem(null); setShowItemModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-accent/30 text-accent text-sm font-medium hover:bg-accent/5"
            >
              <Plus size={16} />
              Item
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      {isInsideFolder && (
        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="text-muted hover:text-accent transition-colors font-medium"
          >
            {activeTab === "resources" ? "Resources" : "Courses"}
          </button>
          {folderPath.map((entry, i) => (
            <span key={entry.id} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-muted/50" />
              {i < folderPath.length - 1 ? (
                <button
                  onClick={() => navigateToBreadcrumb(i)}
                  className="text-muted hover:text-accent transition-colors font-medium"
                >
                  {entry.name}
                </button>
              ) : (
                <span className="font-semibold text-foreground">{entry.name}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Content grid */}
      {loading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-sm text-muted">Loading...</p>
        </div>
      ) : isInsightsTab ? (
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Insight Cadence</h3>
                <p className="text-xs text-muted">How often each insight rotates on client dashboards.</p>
              </div>
              <button
                onClick={handleSaveCadence}
                disabled={!insightSettings || savingCadence}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/30 text-accent text-xs font-medium hover:bg-accent/5 disabled:opacity-50"
              >
                {savingCadence ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Every</span>
              <input
                type="number"
                min={1}
                value={insightSettings?.cadenceValue ?? 1}
                onChange={(e) => {
                  const next = Math.max(1, Number(e.target.value || 1));
                  setInsightSettings((prev) => ({
                    coachId: prev?.coachId ?? coachId ?? "",
                    cadenceUnit: prev?.cadenceUnit ?? "weeks",
                    cadenceValue: next,
                    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
                  }));
                }}
                className="w-20 px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
              />
              <select
                value={insightSettings?.cadenceUnit ?? "weeks"}
                onChange={(e) => {
                  const nextUnit = (e.target.value === "days" ? "days" : "weeks") as InsightCadenceUnit;
                  setInsightSettings((prev) => ({
                    coachId: prev?.coachId ?? coachId ?? "",
                    cadenceUnit: nextUnit,
                    cadenceValue: prev?.cadenceValue ?? 1,
                    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
                  }));
                }}
                className="px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
              >
                <option value="days">day(s)</option>
                <option value="weeks">week(s)</option>
              </select>
            </div>
          </div>

          {insights.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <Lightbulb size={40} className="text-muted/30" />
                <p className="text-sm text-muted">No insights yet — create your first coaching tip.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onEdit={() => { setEditingInsight(insight); setShowInsightModal(true); }}
                  onDelete={() => handleDeleteInsight(insight)}
                  onToggleActive={(next) => handleToggleInsightActive(insight, next)}
                />
              ))}
            </div>
          )}
        </div>
      ) : folders.length === 0 && items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <FolderOpen size={40} className="text-muted/30" />
            <p className="text-sm text-muted">
              {isInsideFolder
                ? "This folder is empty"
                : activeTab === "resources"
                  ? "No resources yet \u2014 create a folder to get started"
                  : "No courses yet \u2014 create a course to get started"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              isCourse={activeTab === "courses"}
              enrolledCount={courseAccessCounts[folder.id]}
              onClick={() => navigateIntoFolder(folder)}
              onEdit={() => { setEditingFolder(folder); setShowFolderModal(true); }}
              onDelete={() => handleDeleteFolder(folder)}
              onManageAccess={
                activeTab === "courses" && folder.parentId === null
                  ? () => setCourseAccessTarget({ id: Number(folder.id), name: folder.name })
                  : undefined
              }
              onAutomation={
                activeTab === "courses" && folder.parentId === null
                  ? () => setCourseAutomationTarget(folder)
                  : undefined
              }
            />
          ))}
          {items.map((item) => (
            <ItemCardComponent
              key={item.id}
              item={item}
              onEdit={() => { setEditingItem(item); setShowItemModal(true); }}
              onDelete={() => handleDeleteItem(item)}
              onClick={() => handleItemClick(item)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showFolderModal && (
        <FolderModal
          section={activeTab as VaultSection}
          depth={depth}
          folder={editingFolder}
          onClose={() => { setShowFolderModal(false); setEditingFolder(null); }}
          onSave={handleSaveFolder}
        />
      )}

      {showItemModal && coachId && currentFolderId !== null && (
        <ItemModal
          item={editingItem}
          coachId={coachId}
          folderId={currentFolderId}
          onClose={() => { setShowItemModal(false); setEditingItem(null); }}
          onSaved={loadData}
        />
      )}

      {courseAccessTarget && (
        <CourseAccessModal
          folderId={courseAccessTarget.id}
          folderName={courseAccessTarget.name}
          clients={clients}
          onClose={() => setCourseAccessTarget(null)}
        />
      )}

      {courseAutomationTarget && (
        <CourseAutomationDrawer
          course={courseAutomationTarget}
          clients={clients}
          onClose={() => setCourseAutomationTarget(null)}
          onChanged={loadData}
        />
      )}

      {showInsightModal && (
        <InsightModal
          insight={editingInsight}
          onClose={() => { setShowInsightModal(false); setEditingInsight(null); }}
          onSave={handleSaveInsight}
        />
      )}
    </div>
  );
}
