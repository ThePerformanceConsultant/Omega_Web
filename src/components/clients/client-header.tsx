"use client";

import { ArrowLeft, MessageCircle, CheckSquare, StickyNote, Info, ClipboardList, Trash2 } from "lucide-react";
import { Client, ClientPanelType } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";

const PANELS: { key: ClientPanelType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "checkins", label: "Check-ins", icon: ClipboardList },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "info", label: "Info", icon: Info },
];

export function ClientHeader({
  client,
  activePanel,
  onPanelToggle,
  onBack,
  onDeleteClient,
  deletePending = false,
}: {
  client: Client;
  activePanel: ClientPanelType;
  onPanelToggle: (panel: ClientPanelType) => void;
  onBack: () => void;
  onDeleteClient?: () => void;
  deletePending?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={onBack}
        className="px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <Avatar initials={client.avatar_initials || "?"} size={48} />
      <div className="min-w-0">
        <h1 className="text-xl font-bold">{client.full_name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="truncate">{client.email}</span>
          {client.tag && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-black/5 shrink-0">
              {client.tag}
            </span>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Pill Buttons */}
      <div className="flex items-center gap-2">
        {onDeleteClient && (
          <button
            onClick={onDeleteClient}
            disabled={deletePending}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Delete client account"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">{deletePending ? "Deleting..." : "Delete Account"}</span>
          </button>
        )}
        {PANELS.map((p) => {
          const active = activePanel === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onPanelToggle(active ? null : p.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-white"
                  : "bg-black/5 text-muted hover:text-foreground hover:bg-black/10"
              }`}
            >
              <p.icon size={14} />
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
