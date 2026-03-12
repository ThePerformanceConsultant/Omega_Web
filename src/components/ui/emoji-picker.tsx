"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const COMMON_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🔥",
  "👏",
  "💪",
  "✅",
  "🙌",
  "🎯",
  "📈",
  "🏋️",
  "🚀",
  "🙏",
  "😅",
  "🤝",
  "🥳",
];

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
};

export function EmojiPicker({ onSelect, disabled = false }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="relative shrink-0" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="w-9 h-9 rounded-full bg-black/5 border border-black/10 text-muted hover:text-foreground hover:bg-black/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        title="Insert emoji"
      >
        <Smile size={16} />
      </button>

      {open && (
        <div className="absolute bottom-11 left-0 z-50 w-48 rounded-xl border border-black/10 bg-white shadow-lg p-2">
          <div className="grid grid-cols-8 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="h-8 w-8 rounded-lg hover:bg-black/5 transition-colors text-base"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
