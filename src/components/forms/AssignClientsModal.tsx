"use client";

import { useState, useEffect } from "react";
import { X, Check, Search, Calendar } from "lucide-react";
import { fetchClients } from "@/lib/supabase/db";

interface ClientRow {
  id: string;
  full_name: string;
  avatar_initials: string;
  tag: string;
}

interface AssignClientsModalProps {
  assignedClientIds: string[];
  onSave: (clientIds: string[], dueDate: string) => void;
  onClose: () => void;
}

export default function AssignClientsModal({ assignedClientIds, onSave, onClose }: AssignClientsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedClientIds));
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchClients()
      .then((data) => setClients(data as ClientRow[]))
      .catch((err) => console.error("[AssignClientsModal] fetch clients failed:", err));
  }, []);

  const filteredClients = clients.filter((c) =>
    !search.trim() || c.full_name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Assign Clients</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
          />
        </div>

        {/* Client list */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filteredClients.map((c) => {
            const isSelected = selected.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isSelected ? "bg-accent/10" : "hover:bg-black/5"
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected ? "bg-accent border-accent" : "border-black/20"
                }`}>
                  {isSelected && <Check size={12} className="text-white" />}
                </div>
                <div className="w-8 h-8 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center">
                  {c.avatar_initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                  <p className="text-xs text-muted">{c.tag}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Due date */}
        <div className="mt-4 pt-4 border-t border-black/10">
          <label className="flex items-center gap-2 text-xs font-medium text-muted mb-2">
            <Calendar size={14} /> Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-black/10">
          <span className="text-xs text-muted">{selected.size} client{selected.size !== 1 ? "s" : ""} selected</span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-foreground border border-black/10 hover:border-black/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(Array.from(selected), dueDate)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-accent to-accent-light shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
