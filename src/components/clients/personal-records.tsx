"use client";

import { BarChart3, Dumbbell, UtensilsCrossed, ClipboardList } from "lucide-react";

const PR_DATA = [
  { lift: "Bench Press", value: "90kg", change: "+2.5" },
  { lift: "Squat", value: "130kg", change: "+5" },
  { lift: "Deadlift", value: "155kg", change: "+5" },
  { lift: "OHP", value: "55kg", change: "+2.5" },
];

const RECENT_ACTIVITY = [
  { action: "Completed Upper Power", time: "2h ago", icon: Dumbbell },
  { action: "Logged meals (2,100 kcal)", time: "5h ago", icon: UtensilsCrossed },
  { action: "Weekly check-in submitted", time: "1d ago", icon: ClipboardList },
  { action: "New PR: Bench 90kg", time: "2d ago", icon: BarChart3 },
];

export function PersonalRecords() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass-card p-5">
        <h3 className="text-base font-bold mb-4">Personal Records</h3>
        {PR_DATA.map((pr, i) => (
          <div
            key={pr.lift}
            className={`flex items-center py-2.5 ${i > 0 ? "border-t border-black/5" : ""}`}
          >
            <BarChart3 size={14} className="text-warning mr-3" />
            <span className="flex-1 text-sm">{pr.lift}</span>
            <span className="text-base font-bold text-warning">{pr.value}</span>
            <span className="text-xs text-success ml-2">{pr.change}</span>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <h3 className="text-base font-bold mb-4">Recent Activity</h3>
        {RECENT_ACTIVITY.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-black/5" : ""}`}
          >
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <item.icon size={14} className="text-accent" />
            </div>
            <span className="flex-1 text-sm">{item.action}</span>
            <span className="text-xs text-muted">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
