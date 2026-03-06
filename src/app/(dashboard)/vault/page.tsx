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
} from "@/lib/supabase/db";
import type { VaultSection, VaultItemType, VaultFolder, VaultItem, Client } from "@/lib/types";

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

// ─── Main Page ───

type BreadcrumbEntry = { id: number; name: string };

export default function VaultPage() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VaultSection>("resources");
  const [folderPath, setFolderPath] = useState<BreadcrumbEntry[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [courseAccessCounts, setCourseAccessCounts] = useState<Record<string, number>>({});

  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VaultFolder | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [courseAccessTarget, setCourseAccessTarget] = useState<{ id: number; name: string } | null>(null);

  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;
  const depth = folderPath.length;
  const maxDepth = getMaxDepth(activeTab);
  const canCreateSubfolder = depth < maxDepth;
  const canAddItem = depth > 0;
  const isInsideFolder = depth > 0;

  // ─── Load data ───

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
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
  }, [activeTab, currentFolderId]);

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

  const tabOptions: { value: VaultSection; label: string; icon: typeof Library }[] = [
    { value: "resources", label: "Resources", icon: Library },
    { value: "courses", label: "Courses", icon: GraduationCap },
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
          {canCreateSubfolder && (
            <button
              onClick={() => { setEditingFolder(null); setShowFolderModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium"
            >
              <Plus size={16} />
              {DEPTH_LABELS[activeTab][depth] ?? "Folder"}
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
          section={activeTab}
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
    </div>
  );
}
