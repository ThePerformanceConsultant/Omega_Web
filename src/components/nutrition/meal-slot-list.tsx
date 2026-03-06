"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ToggleLeft, ToggleRight, Pencil, Check } from "lucide-react";
import type { MealSlotConfig } from "@/lib/types";
import {
  autoBalancePercentages,
  redistributePercentages,
  validatePercentageSum,
} from "@/lib/nutrition-utils";

interface MealSlotListProps {
  slots: MealSlotConfig[];
  onChange: (slots: MealSlotConfig[]) => void;
}

export function MealSlotList({ slots, onChange }: MealSlotListProps) {
  const sorted = [...slots].sort((a, b) => a.sortOrder - b.sortOrder);
  const { valid, total } = validatePercentageSum(sorted);
  const enabledCount = sorted.filter((s) => s.enabled).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((s) => s.id === active.id);
    const newIndex = sorted.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((s, i) => ({
      ...s,
      sortOrder: i,
    }));
    onChange(reordered);
  }

  function toggleSlot(id: string) {
    const updated = sorted.map((s) => {
      if (s.id !== id) return s;
      const nowEnabled = !s.enabled;
      return {
        ...s,
        enabled: nowEnabled,
        caloriePercentage: nowEnabled ? 0 : 0,
      };
    });
    // Re-balance when toggling
    onChange(autoBalancePercentages(updated));
  }

  function updatePercentage(id: string, value: number) {
    onChange(redistributePercentages(sorted, id, value));
  }

  function updateName(id: string, name: string) {
    onChange(sorted.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function handleAutoBalance() {
    onChange(autoBalancePercentages(sorted));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted">
          Meal Slots ({enabledCount} active)
        </label>
        <button
          onClick={handleAutoBalance}
          className="text-[10px] font-medium text-accent hover:text-accent-light transition-colors"
        >
          Auto-balance
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sorted.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {sorted.map((slot) => (
              <SortableSlotRow
                key={slot.id}
                slot={slot}
                onToggle={() => toggleSlot(slot.id)}
                onPercentageChange={(v) => updatePercentage(slot.id, v)}
                onNameChange={(n) => updateName(slot.id, n)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Validation */}
      <div
        className={`text-[10px] font-medium ${
          valid ? "text-success" : "text-red-500"
        }`}
      >
        {valid
          ? `Total: 100%`
          : `Total: ${total}% — must equal 100%`}
      </div>
    </div>
  );
}

// ── Sortable row ──────────────────────────────────────────────────────────

function SortableSlotRow({
  slot,
  onToggle,
  onPercentageChange,
  onNameChange,
}: {
  slot: MealSlotConfig;
  onToggle: () => void;
  onPercentageChange: (v: number) => void;
  onNameChange: (n: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(slot.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  function saveName() {
    if (editName.trim()) {
      onNameChange(editName.trim());
    } else {
      setEditName(slot.name);
    }
    setIsEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
        slot.enabled
          ? "bg-black/[0.02] hover:bg-black/[0.04]"
          : "opacity-40"
      } ${isDragging ? "shadow-lg bg-white" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted hover:text-foreground p-0.5"
      >
        <GripVertical size={14} />
      </button>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`shrink-0 ${
          slot.enabled ? "text-accent" : "text-muted"
        }`}
      >
        {slot.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
      </button>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setEditName(slot.name);
                  setIsEditing(false);
                }
              }}
              onBlur={saveName}
              autoFocus
              className="text-sm font-medium bg-transparent border-b border-accent/40 focus:outline-none text-foreground w-full"
            />
            <button
              onClick={saveName}
              className="text-accent hover:text-accent-light p-0.5"
            >
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditName(slot.name);
              setIsEditing(true);
            }}
            className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-accent transition-colors group"
          >
            <span className="truncate">{slot.name}</span>
            <Pencil
              size={10}
              className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
            />
          </button>
        )}
      </div>

      {/* Percentage input */}
      {slot.enabled && (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min={0}
            max={100}
            value={slot.caloriePercentage}
            onChange={(e) => onPercentageChange(Number(e.target.value) || 0)}
            className="w-12 px-1.5 py-1 rounded bg-black/5 border border-black/10 text-xs text-right text-foreground focus:outline-none focus:border-accent/50"
          />
          <span className="text-[10px] text-muted">%</span>
        </div>
      )}
    </div>
  );
}
