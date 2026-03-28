"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCoachNotes, clientStore } from "@/lib/client-store";

export function NotesPanel({ clientId }: { clientId: string }) {
  const notes = useCoachNotes(clientId);
  const [draft, setDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const newestFirstNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notes],
  );
  const latestNote = newestFirstNotes[0] ?? null;
  const olderNotes = latestNote ? newestFirstNotes.slice(1) : [];

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    clientStore.addNote(clientId, text);
    setDraft("");
  }

  function handleStartEdit(noteId: string, content: string) {
    setEditingNoteId(noteId);
    setEditingDraft(content);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setEditingDraft("");
  }

  async function handleSaveEdit() {
    if (!editingNoteId) return;
    const text = editingDraft.trim();
    if (!text) return;
    await clientStore.updateNote(editingNoteId, text);
    handleCancelEdit();
  }

  async function handleDeleteNote(noteId: string) {
    await clientStore.removeNote(noteId);
    if (editingNoteId === noteId) {
      handleCancelEdit();
    }
  }

  return (
    <div className="relative h-full">
      <div className="pb-2">
        <p className="text-xs text-muted">Private notes — only visible to you</p>
      </div>

      {/* Notes timeline */}
      <div className="h-full overflow-y-auto pt-4 pb-28 space-y-3">
        {latestNote && (
          <div key={latestNote.id} className="bg-black/[0.03] rounded-lg p-3">
            {editingNoteId === latestNote.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingDraft}
                  onChange={(event) => setEditingDraft(event.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-black/10 text-xs hover:bg-black/[0.03]"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSaveEdit()}
                    disabled={!editingDraft.trim()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-white text-xs hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={12} />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap">{latestNote.content}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(latestNote.id, latestNote.content)}
                      className="w-7 h-7 rounded-md border border-black/10 text-muted hover:text-foreground hover:bg-black/[0.03] flex items-center justify-center"
                      aria-label="Edit note"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => void handleDeleteNote(latestNote.id)}
                      className="w-7 h-7 rounded-md border border-black/10 text-danger hover:bg-danger/10 flex items-center justify-center"
                      aria-label="Delete note"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted mt-2">
                  {new Date(latestNote.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(latestNote.createdAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </>
            )}
          </div>
        )}

        {latestNote === null && (
          <div className="text-center py-6 text-muted">
            <p className="text-sm">No notes yet</p>
            <p className="text-xs mt-1">Use the add note box below</p>
          </div>
        )}

        {olderNotes.map((note) => (
          <div key={note.id} className="bg-black/[0.03] rounded-lg p-3">
            {editingNoteId === note.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingDraft}
                  onChange={(event) => setEditingDraft(event.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-black/10 text-xs hover:bg-black/[0.03]"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSaveEdit()}
                    disabled={!editingDraft.trim()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-white text-xs hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={12} />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(note.id, note.content)}
                      className="w-7 h-7 rounded-md border border-black/10 text-muted hover:text-foreground hover:bg-black/[0.03] flex items-center justify-center"
                      aria-label="Edit note"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => void handleDeleteNote(note.id)}
                      className="w-7 h-7 rounded-md border border-black/10 text-danger hover:bg-danger/10 flex items-center justify-center"
                      aria-label="Delete note"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted mt-2">
                  {new Date(note.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(note.createdAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="absolute left-0 right-0 bottom-0 z-20 pb-1">
        <div className="rounded-2xl border border-black/10 bg-white/95 backdrop-blur-sm px-3 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a note..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAdd();
              }}
              className="flex-1 px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
            />
            <button
              onClick={handleAdd}
              disabled={!draft.trim()}
              className="w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
