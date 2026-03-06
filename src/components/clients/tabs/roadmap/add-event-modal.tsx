"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ROADMAP_COLORS } from "./roadmap-utils";

interface AddEventModalProps {
  onAdd: (event: { name: string; color: string; startWeek: number; lengthWeeks: number; notes: string }) => void;
  onClose: () => void;
}

export function AddEventModal({ onAdd, onClose }: AddEventModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(ROADMAP_COLORS[4]);
  const [startWeek, setStartWeek] = useState(1);
  const [lengthWeeks, setLengthWeeks] = useState(1);
  const [notes, setNotes] = useState("");

  const maxTitleLen = 25;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Add Event</h3>
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
              placeholder="e.g. State Championships"
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

          {/* Start Week + Length */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Start Week</label>
              <input
                type="number"
                min={1}
                max={52}
                value={startWeek}
                onChange={(e) => setStartWeek(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Length (weeks)</label>
              <input
                type="number"
                min={1}
                max={52}
                value={lengthWeeks}
                onChange={(e) => setLengthWeeks(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Notes/Goals */}
          <div>
            <label className="text-xs text-muted mb-1 block">Event Notes / Goals</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Goals and notes for this event..."
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
              onAdd({
                name: name.trim(),
                color,
                startWeek,
                lengthWeeks,
                notes: notes.trim(),
              });
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
}
