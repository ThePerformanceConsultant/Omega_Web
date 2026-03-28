"use client";

import {
  Bot,
  LayoutDashboard,
  Dumbbell,
  UtensilsCrossed,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { ClientSubTab } from "@/lib/types";

const TABS: { key: ClientSubTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "workouts", label: "Workouts", icon: Dumbbell },
  { key: "nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { key: "progress", label: "Progress", icon: TrendingUp },
  { key: "roadmap", label: "Roadmap", icon: CalendarDays },
  { key: "automations", label: "Automations", icon: Bot },
];

export function SubTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: ClientSubTab;
  onTabChange: (tab: ClientSubTab) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-black/10 -mx-1">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              active
                ? "text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {active && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
