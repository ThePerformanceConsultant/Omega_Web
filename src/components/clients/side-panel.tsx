"use client";

import { X } from "lucide-react";

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function SidePanel({ title, onClose, children }: SidePanelProps) {
  return (
    <div className="h-full min-w-0 bg-transparent flex flex-col self-stretch">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-black/10 shrink-0 sticky top-0 bg-white z-10">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-7">{children}</div>
    </div>
  );
}
