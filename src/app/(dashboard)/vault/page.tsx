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
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
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
  fetchCurriculumPrograms,
  upsertCurriculumProgram,
  fetchCurriculumWeeks,
  upsertCurriculumWeek,
  fetchCurriculumTouchpoints,
  upsertCurriculumTouchpoints,
  fetchCoachCurriculumOverview,
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
  CurriculumProgram,
  CurriculumWeek,
  CurriculumTouchpoint,
  CoachCurriculumOverviewItem,
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

function isCurriculumSchemaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the function") ||
    lower.includes("relation") ||
    lower.includes("does not exist") ||
    lower.includes("schema cache")
  ) && lower.includes("curriculum");
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

// ─── Folder Card ───

function FolderCard({
  folder,
  enrolledCount,
  isCourse,
  onClick,
  onEdit,
  onDelete,
  onManageAccess,
}: {
  folder: VaultFolder;
  enrolledCount?: number;
  isCourse: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageAccess?: () => void;
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
      {isRootCourse && onManageAccess && (
        <div className="px-3 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onManageAccess(); }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-black/10 text-xs font-medium text-muted hover:border-accent/40 hover:text-accent transition-colors"
          >
            <Users size={12} /> Manage Access
          </button>
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
type VaultTab = VaultSection | "insights" | "curriculum";

export default function VaultPage() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VaultTab>("resources");
  const [folderPath, setFolderPath] = useState<BreadcrumbEntry[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [insightSettings, setInsightSettings] = useState<CoachInsightSettings | null>(null);
  const [curriculumPrograms, setCurriculumPrograms] = useState<CurriculumProgram[]>([]);
  const [curriculumWeeks, setCurriculumWeeks] = useState<CurriculumWeek[]>([]);
  const [curriculumTouchpoints, setCurriculumTouchpoints] = useState<CurriculumTouchpoint[]>([]);
  const [curriculumOverview, setCurriculumOverview] = useState<CoachCurriculumOverviewItem[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [programDraftName, setProgramDraftName] = useState("16-Week Curriculum");
  const [programDraftDuration, setProgramDraftDuration] = useState(16);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [isSavingWeek, setIsSavingWeek] = useState(false);
  const [weekDraftTheme, setWeekDraftTheme] = useState("");
  const [weekDraftOutcome, setWeekDraftOutcome] = useState("");
  const [weekDraftLectureFolderId, setWeekDraftLectureFolderId] = useState<number | null>(null);
  const [weekDraftSummary, setWeekDraftSummary] = useState("");
  const [enrollClientId, setEnrollClientId] = useState("");
  const [enrollTimezone, setEnrollTimezone] = useState("Europe/London");
  const [enrollStartDate, setEnrollStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isResettingTouchpoints, setIsResettingTouchpoints] = useState(false);
  const [isUpdatingEnrollmentId, setIsUpdatingEnrollmentId] = useState<number | null>(null);
  const [curriculumNotice, setCurriculumNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [curriculumSchemaWarning, setCurriculumSchemaWarning] = useState<string | null>(null);
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

  const isInsightsTab = activeTab === "insights";
  const isCurriculumTab = activeTab === "curriculum";
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;
  const depth = folderPath.length;
  const maxDepth = !isInsightsTab && !isCurriculumTab ? getMaxDepth(activeTab as VaultSection) : 0;
  const canCreateSubfolder = !isInsightsTab && !isCurriculumTab && depth < maxDepth;
  const canAddItem = !isInsightsTab && !isCurriculumTab && depth > 0;
  const isInsideFolder = !isInsightsTab && !isCurriculumTab && depth > 0;

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

      if (activeTab === "curriculum") {
        const [programs, overview] = await Promise.all([
          fetchCurriculumPrograms(),
          fetchCoachCurriculumOverview(coachId ?? undefined),
        ]);
        setCurriculumSchemaWarning(null);
        setCurriculumPrograms(programs);
        setCurriculumOverview(overview);
        setInsights([]);
        setFolders([]);
        setItems([]);

        const effectiveProgramId = selectedProgramId ?? programs[0]?.id ?? null;
        setSelectedProgramId(effectiveProgramId);

        if (!effectiveProgramId) {
          setCurriculumWeeks([]);
          setCurriculumTouchpoints([]);
          return;
        }

        const weeks = await fetchCurriculumWeeks(effectiveProgramId);
        setCurriculumWeeks(weeks);

        const effectiveWeekNumber =
          weeks.find((week) => week.weekNumber === selectedWeekNumber)?.weekNumber ??
          weeks[0]?.weekNumber ??
          1;
        setSelectedWeekNumber(effectiveWeekNumber);

        const selectedWeek = weeks.find((week) => week.weekNumber === effectiveWeekNumber) ?? null;
        if (selectedWeek) {
          setWeekDraftTheme(selectedWeek.themeTitle);
          setWeekDraftOutcome(selectedWeek.focusOutcome ?? "");
          setWeekDraftSummary(selectedWeek.summaryPrompt ?? "");
          setWeekDraftLectureFolderId(selectedWeek.lectureFolderId ?? null);
          const touchpoints = await fetchCurriculumTouchpoints(selectedWeek.id);
          setCurriculumTouchpoints(touchpoints);
        } else {
          setCurriculumTouchpoints([]);
        }
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
      if (activeTab === "curriculum") {
        const message = getErrorMessage(err, "Could not load curriculum data.");
        if (isCurriculumSchemaError(message)) {
          setCurriculumSchemaWarning(
            "Curriculum database functions are not available on this environment yet. Apply the latest Supabase migrations, then reload this page."
          );
        } else {
          setCurriculumSchemaWarning(message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentFolderId, coachId, selectedProgramId, selectedWeekNumber]);

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

  useEffect(() => {
    const selected = curriculumPrograms.find((program) => program.id === selectedProgramId);
    if (!selected) return;
    setProgramDraftName(selected.name);
    setProgramDraftDuration(selected.durationWeeks);
  }, [curriculumPrograms, selectedProgramId]);

  useEffect(() => {
    const selected = curriculumWeeks.find((week) => week.weekNumber === selectedWeekNumber);
    if (!selected) return;
    setWeekDraftTheme(selected.themeTitle);
    setWeekDraftOutcome(selected.focusOutcome ?? "");
    setWeekDraftSummary(selected.summaryPrompt ?? "");
    setWeekDraftLectureFolderId(selected.lectureFolderId ?? null);
  }, [curriculumWeeks, selectedWeekNumber]);

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
    if (activeTab === "insights" || activeTab === "curriculum") return;
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

  const selectedProgram = curriculumPrograms.find((program) => program.id === selectedProgramId) ?? null;
  const selectedWeek = curriculumWeeks.find((week) => week.weekNumber === selectedWeekNumber) ?? null;
  const hasProgramSelected = selectedProgramId !== null;
  const hasWeekLoaded = selectedWeek !== null;
  const hasClients = clients.length > 0;

  async function handleSaveCurriculumProgram() {
    setCurriculumNotice(null);
    setIsSavingProgram(true);
    try {
      const saved = await upsertCurriculumProgram({
        id: selectedProgram?.id ?? null,
        name: programDraftName.trim() || "16-Week Curriculum",
        durationWeeks: Math.max(1, Math.min(programDraftDuration || 16, 104)),
        isActive: true,
        seedDefaults: true,
      });
      if (saved) {
        setSelectedProgramId(saved.id);
        setProgramDraftName(saved.name);
        setProgramDraftDuration(saved.durationWeeks);
        setCurriculumNotice({
          type: "success",
          text: selectedProgram ? "Program updated." : "Program created. Continue with Week Builder below.",
        });
      } else {
        setCurriculumNotice({ type: "error", text: "Program save returned no data." });
      }
      await loadData();
    } catch (error) {
      const message = getErrorMessage(error, "Could not save curriculum program.");
      setCurriculumNotice({ type: "error", text: message });
    } finally {
      setIsSavingProgram(false);
    }
  }

  async function handleSaveCurriculumWeek() {
    setCurriculumNotice(null);
    if (!selectedProgramId) {
      setCurriculumNotice({ type: "info", text: "Create or select a program first." });
      return;
    }
    setIsSavingWeek(true);
    try {
      const savedWeek = await upsertCurriculumWeek({
        id: selectedWeek?.id ?? null,
        programId: selectedProgramId,
        weekNumber: selectedWeekNumber,
        themeTitle: weekDraftTheme.trim() || `Week ${selectedWeekNumber} Focus`,
        focusOutcome: weekDraftOutcome.trim() || null,
        lectureFolderId: weekDraftLectureFolderId,
        summaryPrompt: weekDraftSummary.trim() || null,
        seedTouchpoints: true,
      });
      if (savedWeek) {
        const touchpoints = await fetchCurriculumTouchpoints(savedWeek.id);
        setCurriculumTouchpoints(touchpoints);
        setCurriculumNotice({ type: "success", text: `Week ${savedWeek.weekNumber} saved.` });
      } else {
        setCurriculumNotice({ type: "error", text: "Week save returned no data." });
      }
      await loadData();
    } catch (error) {
      const message = getErrorMessage(error, "Could not save curriculum week.");
      setCurriculumNotice({ type: "error", text: message });
    } finally {
      setIsSavingWeek(false);
    }
  }

  async function handleResetCurriculumTouchpoints() {
    setCurriculumNotice(null);
    if (!selectedWeek) {
      setCurriculumNotice({ type: "info", text: "Save the week first, then reset touchpoints." });
      return;
    }
    setIsResettingTouchpoints(true);
    try {
      await upsertCurriculumTouchpoints(selectedWeek.id, buildDefaultCurriculumTouchpoints());
      const touchpoints = await fetchCurriculumTouchpoints(selectedWeek.id);
      setCurriculumTouchpoints(touchpoints);
      setCurriculumNotice({ type: "success", text: "Default touchpoints applied." });
    } catch (error) {
      const message = getErrorMessage(error, "Could not reset touchpoints.");
      setCurriculumNotice({ type: "error", text: message });
    } finally {
      setIsResettingTouchpoints(false);
    }
  }

  async function handleEnrollClient() {
    setCurriculumNotice(null);
    if (!selectedProgramId) {
      setCurriculumNotice({ type: "info", text: "Select a program before enrolling a client." });
      return;
    }
    if (!enrollClientId) {
      setCurriculumNotice({ type: "info", text: "Select a client to enroll." });
      return;
    }
    setIsEnrolling(true);
    try {
      await enrollClientInCurriculum({
        clientId: enrollClientId,
        programId: selectedProgramId,
        startDate: enrollStartDate,
        timezone: enrollTimezone || null,
      });
      await loadData();
      setCurriculumNotice({ type: "success", text: "Client enrolled in curriculum." });
    } catch (error) {
      const message = getErrorMessage(error, "Could not enroll client.");
      setCurriculumNotice({ type: "error", text: message });
    } finally {
      setIsEnrolling(false);
    }
  }

  async function handlePauseResume(item: CoachCurriculumOverviewItem) {
    setCurriculumNotice(null);
    setIsUpdatingEnrollmentId(item.enrollmentId);
    try {
      if (item.enrollmentStatus === "active") {
        await pauseCurriculumEnrollment(item.enrollmentId);
        setCurriculumNotice({ type: "success", text: `${item.clientName} has been paused.` });
      } else if (item.enrollmentStatus === "paused") {
        await resumeCurriculumEnrollment(item.enrollmentId);
        setCurriculumNotice({ type: "success", text: `${item.clientName} has been resumed.` });
      }
      await loadData();
    } catch (error) {
      const message = getErrorMessage(error, "Could not update enrollment status.");
      setCurriculumNotice({ type: "error", text: message });
    } finally {
      setIsUpdatingEnrollmentId(null);
    }
  }

  // ─── Render ───

  const tabOptions: { value: VaultTab; label: string; icon: typeof Library }[] = [
    { value: "resources", label: "Resources", icon: Library },
    { value: "courses", label: "Courses", icon: GraduationCap },
    { value: "insights", label: "Insights", icon: Lightbulb },
    { value: "curriculum", label: "Curriculum", icon: RefreshCw },
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
                  setCurriculumNotice(null);
                  if (tab.value !== "curriculum") {
                    setCurriculumPrograms([]);
                    setCurriculumWeeks([]);
                    setCurriculumTouchpoints([]);
                    setCurriculumOverview([]);
                    setCurriculumSchemaWarning(null);
                  }
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
      ) : isCurriculumTab ? (
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Curriculum Setup Flow</h3>
              <p className="text-xs text-muted">Follow these steps in order: program, week, then enrollment.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 flex items-center gap-2">
                {hasProgramSelected ? <CheckCircle2 size={14} className="text-emerald-600" /> : <CircleDashed size={14} className="text-muted" />}
                <p className="text-xs text-foreground">1. Save or select a program</p>
              </div>
              <div className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 flex items-center gap-2">
                {hasWeekLoaded ? <CheckCircle2 size={14} className="text-emerald-600" /> : <CircleDashed size={14} className="text-muted" />}
                <p className="text-xs text-foreground">2. Save your week details</p>
              </div>
              <div className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 flex items-center gap-2">
                {curriculumOverview.length > 0 ? <CheckCircle2 size={14} className="text-emerald-600" /> : <CircleDashed size={14} className="text-muted" />}
                <p className="text-xs text-foreground">3. Enroll client(s)</p>
              </div>
            </div>
            {curriculumNotice && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  curriculumNotice.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : curriculumNotice.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {curriculumNotice.text}
              </div>
            )}
            {curriculumSchemaWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{curriculumSchemaWarning}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Curriculum Program</h3>
                  <p className="text-xs text-muted">Create and manage your canonical 16-week structure.</p>
                </div>
                <button
                  onClick={handleSaveCurriculumProgram}
                  disabled={isSavingProgram || !!curriculumSchemaWarning}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/30 text-accent text-xs font-medium hover:bg-accent/5 disabled:opacity-50"
                >
                  {isSavingProgram ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {selectedProgram ? "Update Program" : "Save Program"}
                </button>
              </div>

              <label className="block text-xs text-muted">
                Existing program
                <select
                  value={selectedProgramId ?? ""}
                  onChange={(e) => {
                    setCurriculumNotice(null);
                    const next = Number(e.target.value);
                    if (Number.isFinite(next) && next > 0) {
                      setSelectedProgramId(next);
                      return;
                    }
                    setSelectedProgramId(null);
                    setSelectedWeekNumber(1);
                    setProgramDraftName("16-Week Curriculum");
                    setProgramDraftDuration(16);
                    setWeekDraftTheme("");
                    setWeekDraftOutcome("");
                    setWeekDraftSummary("");
                    setWeekDraftLectureFolderId(null);
                    setCurriculumTouchpoints([]);
                  }}
                  className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                >
                  <option value="">Create new program</option>
                  {curriculumPrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name} ({program.durationWeeks} weeks)
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-muted">
                  Program name
                  <input
                    value={programDraftName}
                    onChange={(e) => setProgramDraftName(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                  />
                </label>
                <label className="block text-xs text-muted">
                  Duration (weeks)
                  <input
                    type="number"
                    min={1}
                    max={104}
                    value={programDraftDuration}
                    onChange={(e) => setProgramDraftDuration(Math.max(1, Number(e.target.value || 16)))}
                    className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                  />
                </label>
              </div>
              {!hasProgramSelected && (
                <p className="text-[11px] text-muted">Tip: click <strong>Save Program</strong> first to unlock Week Builder actions.</p>
              )}
            </div>

            <div className="glass-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Enroll Client</h3>
                <p className="text-xs text-muted">Assign a client to the selected curriculum program.</p>
              </div>

              <label className="block text-xs text-muted">
                Client
                <select
                  value={enrollClientId}
                  onChange={(e) => setEnrollClientId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-muted">
                  Start date
                  <input
                    type="date"
                    value={enrollStartDate}
                    onChange={(e) => setEnrollStartDate(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                  />
                </label>
                <label className="block text-xs text-muted">
                  Timezone
                  <input
                    value={enrollTimezone}
                    onChange={(e) => setEnrollTimezone(e.target.value)}
                    placeholder="Europe/London"
                    className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                  />
                </label>
              </div>

              <button
                onClick={handleEnrollClient}
                disabled={!selectedProgramId || !enrollClientId || isEnrolling || !hasClients || !!curriculumSchemaWarning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium disabled:opacity-50"
              >
                {isEnrolling ? <RefreshCw size={14} className="animate-spin" /> : <Users size={14} />}
                Enroll in Program
              </button>
              {!hasClients && (
                <p className="text-[11px] text-muted">No clients available to enroll yet.</p>
              )}
              {!selectedProgramId && (
                <p className="text-[11px] text-muted">Select or save a program first.</p>
              )}
            </div>
          </div>

          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Week Builder</h3>
                <p className="text-xs text-muted">Edit weekly outcomes and touchpoint defaults.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetCurriculumTouchpoints}
                  disabled={!selectedWeek || isResettingTouchpoints || !!curriculumSchemaWarning}
                  className="px-3 py-2 rounded-lg border border-black/10 text-xs font-medium text-muted hover:text-foreground hover:bg-black/5 disabled:opacity-50"
                >
                  {isResettingTouchpoints ? "Resetting..." : "Reset Touchpoints"}
                </button>
                <button
                  onClick={handleSaveCurriculumWeek}
                  disabled={!selectedProgramId || isSavingWeek || !!curriculumSchemaWarning}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/30 text-accent text-xs font-medium hover:bg-accent/5 disabled:opacity-50"
                >
                  {isSavingWeek ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Week
                </button>
              </div>
            </div>
            {!selectedProgramId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-3 py-2 text-xs">
                Program selection required: save or select a program before editing weeks.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="block text-xs text-muted sm:col-span-1">
                Week
                <select
                  value={selectedWeekNumber}
                  onChange={(e) => setSelectedWeekNumber(Math.max(1, Number(e.target.value || 1)))}
                  className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                >
                  {(curriculumWeeks.length > 0
                    ? curriculumWeeks.map((week) => week.weekNumber)
                    : Array.from({ length: selectedProgram?.durationWeeks ?? 16 }, (_, i) => i + 1)
                  ).map((weekNumber) => (
                    <option key={weekNumber} value={weekNumber}>
                      Week {weekNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted sm:col-span-3">
                Theme title
                <input
                  value={weekDraftTheme}
                  onChange={(e) => setWeekDraftTheme(e.target.value)}
                  placeholder={`Week ${selectedWeekNumber} Focus`}
                  className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs text-muted">
                Focus outcome
                <textarea
                  rows={2}
                  value={weekDraftOutcome}
                  onChange={(e) => setWeekDraftOutcome(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none resize-none"
                />
              </label>
              <label className="block text-xs text-muted">
                Summary prompt
                <textarea
                  rows={2}
                  value={weekDraftSummary}
                  onChange={(e) => setWeekDraftSummary(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none resize-none"
                />
              </label>
            </div>

            <label className="block text-xs text-muted max-w-xs">
              Lecture folder ID (Vault)
              <input
                type="number"
                min={1}
                value={weekDraftLectureFolderId ?? ""}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setWeekDraftLectureFolderId(Number.isFinite(next) && next > 0 ? next : null);
                }}
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg bg-black/5 border border-black/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/25 outline-none"
              />
            </label>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">Touchpoints</h4>
              {curriculumTouchpoints.length === 0 ? (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted">No touchpoints loaded for this week.</p>
                  <button
                    onClick={handleResetCurriculumTouchpoints}
                    disabled={!selectedWeek || isResettingTouchpoints || !!curriculumSchemaWarning}
                    className="px-2.5 py-1 text-[11px] rounded-md border border-black/10 text-muted hover:text-foreground hover:bg-black/5 disabled:opacity-50"
                  >
                    Apply Defaults
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {curriculumTouchpoints.map((touchpoint) => (
                    <div
                      key={touchpoint.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-black/10 bg-black/[0.02]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{touchpoint.kind.replaceAll("_", " ")}</p>
                        <p className="text-xs text-muted">
                          Day {touchpoint.dayOffset} at {touchpoint.localTime.slice(0, 5)}
                          {touchpoint.isRequired ? " · required" : ""}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full ${
                          touchpoint.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {touchpoint.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Client Curriculum Status</h3>
            {curriculumOverview.length === 0 ? (
              <p className="text-sm text-muted">No active curriculum enrollments yet.</p>
            ) : (
              <div className="space-y-2">
                {curriculumOverview.map((entry) => (
                  <div
                    key={entry.enrollmentId}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-3 rounded-lg border border-black/10 bg-black/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {entry.clientName} · Week {entry.currentWeek}
                      </p>
                      <p className="text-xs text-muted">
                        {entry.programName} · Score {entry.competencyScore ?? 0} · {entry.outcomeStatus.replaceAll("_", " ")}
                      </p>
                      {entry.nextDueAtUtc && (
                        <p className="text-xs text-muted">
                          Next due: {new Date(entry.nextDueAtUtc).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full ${
                          entry.atRisk ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {entry.atRisk ? "At Risk" : "On Track"}
                      </span>
                      {(entry.enrollmentStatus === "active" || entry.enrollmentStatus === "paused") && (
                        <button
                          onClick={() => handlePauseResume(entry)}
                          disabled={isUpdatingEnrollmentId === entry.enrollmentId || !!curriculumSchemaWarning}
                          className="px-3 py-1.5 rounded-lg border border-black/10 text-xs font-medium text-muted hover:text-foreground hover:bg-black/5"
                        >
                          {isUpdatingEnrollmentId === entry.enrollmentId
                            ? "Updating..."
                            : entry.enrollmentStatus === "active"
                              ? "Pause"
                              : "Resume"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
