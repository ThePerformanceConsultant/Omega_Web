"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useCoachNotes, clientStore } from "@/lib/client-store";

export function NotesPanel({ clientId }: { clientId: string }) {
  const notes = useCoachNotes(clientId);
  const [draft, setDraft] = useState("");
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

  return (
    <div className="flex flex-col h-full">
      <div className="pb-2">
        <p className="text-xs text-muted">Private notes — only visible to you</p>
      </div>

      {/* Notes timeline */}
      <div className="flex-1 overflow-y-auto pt-4 space-y-3">
        {latestNote && (
          <div key={latestNote.id} className="bg-black/[0.03] rounded-lg p-3">
            <p className="text-sm whitespace-pre-wrap">{latestNote.content}</p>
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
          </div>
        )}

        {/* Input near top for fast note-taking */}
        <div className={latestNote ? "pt-1" : ""}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a note..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
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

        {latestNote === null && (
          <div className="text-center py-6 text-muted">
            <p className="text-sm">No notes yet</p>
            <p className="text-xs mt-1">Add your first note above</p>
          </div>
        )}

        {olderNotes.map((note) => (
          <div key={note.id} className="bg-black/[0.03] rounded-lg p-3">
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
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
          </div>
        ))}
      </div>
    </div>
  );
}
