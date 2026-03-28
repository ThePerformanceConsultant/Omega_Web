"use client";

import { useState } from "react";
import { Plus, Target, Trash2, Circle, CheckCircle2, Calendar } from "lucide-react";
import { useClientTasks, clientStore } from "@/lib/client-store";

/** Snap a date string to the Monday of that week */
function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function isOverdue(dueDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return due < today;
}

function TaskItem({ task }: { task: { id: string; title: string; completed: boolean; dueDate: string | null; isWeeklyFocus?: boolean; } }) {
  const overdue = !task.completed && task.dueDate && isOverdue(task.dueDate);

  return (
    <div className="flex items-center gap-2.5 py-2 group">
      <button
        onClick={() => clientStore.toggleTask(task.id)}
        className="shrink-0 text-muted hover:text-accent transition-colors"
      >
        {task.completed ? (
          <CheckCircle2 size={18} className="text-success" />
        ) : (
          <Circle size={18} className={overdue ? "text-danger" : ""} />
        )}
      </button>
      <span className={`flex-1 text-sm ${task.completed ? "line-through text-muted" : overdue ? "text-danger" : ""}`}>
        {task.title}
      </span>
      {task.dueDate && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
          task.completed
            ? "text-muted bg-black/[0.04]"
            : overdue
            ? "text-danger bg-danger/10"
            : "text-muted bg-black/5"
        }`}>
          {task.isWeeklyFocus ? "Wk " : ""}
          {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
      <button
        onClick={() => clientStore.removeTask(task.id)}
        className="shrink-0 text-muted/0 group-hover:text-muted hover:!text-warning transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function InlineAddTask({ onAdd, isWeeklyFocus }: { onAdd: (title: string, dueDate: string | null) => void; isWeeklyFocus?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  function handleSubmit() {
    if (!title.trim()) return;
    const dueDate = date ? (isWeeklyFocus ? toMonday(date) : date) : null;
    onAdd(title.trim(), dueDate);
    setTitle("");
    setDate("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors py-1"
      >
        <Plus size={12} /> Add task
      </button>
    );
  }

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") { setAdding(false); setTitle(""); setDate(""); }
          }}
          placeholder="Task title..."
          className="flex-1 px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm focus:outline-none focus:border-accent/50"
        />
        <button onClick={handleSubmit} className="px-2.5 py-1.5 rounded-lg bg-accent text-white text-xs font-medium">
          Add
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Calendar size={12} className="text-muted shrink-0" />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1 rounded-lg bg-black/5 border border-black/10 text-xs text-foreground focus:outline-none focus:border-accent/50"
        />
        {isWeeklyFocus && date && (
          <span className="text-[10px] text-muted">→ Wk of {new Date(toMonday(date) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        )}
      </div>
    </div>
  );
}

export function TasksPanel({ clientId }: { clientId: string }) {
  const tasks = useClientTasks(clientId);
  const coachTasks = tasks.filter((t) => t.owner === "coach");
  const weeklyFocus = tasks.filter((t) => t.owner === "client" && t.isWeeklyFocus);
  const otherClientTasks = tasks.filter((t) => t.owner === "client" && !t.isWeeklyFocus);

  return (
    <div className="h-full overflow-y-auto pr-1 pb-4">
      <div className="space-y-6">
        {/* Coach Tasks */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Coach Tasks</h3>
          <div className="space-y-0">
            {coachTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
            {coachTasks.length === 0 && (
              <p className="text-xs text-muted py-2">No coach tasks</p>
            )}
          </div>
          <InlineAddTask
            onAdd={(title, dueDate) =>
              clientStore.addTask({
                clientId,
                title,
                completed: false,
                dueDate,
                owner: "coach",
                isWeeklyFocus: false,
              })
            }
          />
        </section>

        <hr className="border-black/5" />

        {/* Client Tasks */}
        <section>
          <h3 className="text-sm font-semibold mb-3">Client Tasks</h3>

          {/* Weekly Focus */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-accent" />
              <span className="text-xs font-medium text-accent">Weekly Focus</span>
              <span className="text-[10px] text-muted">
                ({weeklyFocus.filter((t) => !t.completed).length}/3)
              </span>
            </div>
            <div className="space-y-0 pl-1">
              {weeklyFocus.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
              {weeklyFocus.length === 0 && (
                <p className="text-xs text-muted py-2">No weekly focus items set</p>
              )}
            </div>
            {weeklyFocus.filter((t) => !t.completed).length < 3 && (
              <div className="pl-1">
                <InlineAddTask
                  isWeeklyFocus
                  onAdd={(title, dueDate) =>
                    clientStore.addTask({
                      clientId,
                      title,
                      completed: false,
                      dueDate,
                      owner: "client",
                      isWeeklyFocus: true,
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* Other client tasks */}
          <div className="space-y-0">
            {otherClientTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
          <InlineAddTask
            onAdd={(title, dueDate) =>
              clientStore.addTask({
                clientId,
                title,
                completed: false,
                dueDate,
                owner: "client",
                isWeeklyFocus: false,
              })
            }
          />
        </section>
      </div>
    </div>
  );
}
