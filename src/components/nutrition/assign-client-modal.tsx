"use client";

import { useState, useEffect } from "react";
import { X, Search, UserPlus, Loader2 } from "lucide-react";
import { fetchClients } from "@/lib/supabase/db";
import type { Client, MealPlanTemplate } from "@/lib/types";
import { deepCopyForClient, mealPlanStore } from "@/lib/meal-plan-store";

interface AssignClientModalProps {
  plan: MealPlanTemplate;
  onClose: () => void;
}

export function AssignClientModal({ plan, onClose }: AssignClientModalProps) {
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch((err) => console.error("[AssignClientModal] fetchClients failed:", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase())
  );

  function handleAssign(clientId: string) {
    const copy = deepCopyForClient(plan, clientId);
    mealPlanStore.save(copy);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Assign to Client
            </h3>
            <p className="text-[10px] text-muted mt-0.5">
              {plan.name || "Untitled Plan"} — a copy will be created for the selected client
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-black/5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/[0.03] border border-black/10 text-sm focus:outline-none focus:border-accent/50"
              autoFocus
            />
          </div>
        </div>

        {/* Client list */}
        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-muted" />
              <span className="text-xs text-muted ml-2">Loading clients...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">No clients found</p>
          ) : (
            filtered.map((client) => (
              <button
                key={client.id}
                onClick={() => handleAssign(client.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-accent/5 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                  {client.avatar_initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {client.full_name}
                  </p>
                  <p className="text-[10px] text-muted">
                    {client.tag} · {client.current_phase}
                  </p>
                </div>
                <UserPlus size={14} className="text-muted shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
