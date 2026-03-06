"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ROADMAP_COLORS } from "./roadmap-utils";

interface AddPhaseModalProps {
  onAdd: (phase: { name: string; color: string; description: string }) => void;
  onClose: () => void;
}

export function AddPhaseModal({ onAdd, onClose }: AddPhaseModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(ROADMAP_COLORS[0]);
  const [description, setDescription] = useState("");

  const maxTitleLen = 18;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Add Phase</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-muted mb-1 block">
              Title
              <span className="float-right text-[10px]">
                {name.length}/{maxTitleLen}
              </span>
            </label>
            <input
              value={name}
              onChange={(e) => {
                if (e.target.value.length <= maxTitleLen) setName(e.target.value);
              }}
              placeholder="e.g. Hypertrophy"
              className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50"
              autoFocus
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs text-muted mb-1.5 block">Colour</label>
            <div className="flex items-center gap-2 flex-wrap">
              {ROADMAP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted mb-1 block">Phase Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the aims of this phase..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => {
              onAdd({ name: name.trim(), color, description: description.trim() });
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Phase
          </button>
        </div>
      </div>
    </div>
  );
}
