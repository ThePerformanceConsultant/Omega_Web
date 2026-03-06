"use client";

import { Dumbbell, UtensilsCrossed, TrendingUp, CalendarDays, ChevronRight } from "lucide-react";
import { Client, ClientSubTab } from "@/lib/types";
import { QuickStats } from "../quick-stats";
import { RoadmapSection } from "../roadmap-section";

const QUICK_ACTIONS: {
  label: string;
  tab: ClientSubTab;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}[] = [
  { label: "Workouts", tab: "workouts", icon: Dumbbell, color: "text-accent" },
  { label: "Nutrition", tab: "nutrition", icon: UtensilsCrossed, color: "text-success" },
  { label: "Progress", tab: "progress", icon: TrendingUp, color: "text-warning" },
  { label: "Roadmap", tab: "roadmap", icon: CalendarDays, color: "text-accent-light" },
];

export function OverviewTab({
  client,
  onNavigateToTab,
}: {
  client: Client;
  onNavigateToTab: (tab: ClientSubTab) => void;
}) {
  return (
    <div className="space-y-6">
      <QuickStats client={client} />

      {/* Quick Actions — navigate to sub-tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigateToTab(action.tab)}
            className="glass-card p-4 flex items-center gap-3 hover:bg-black/5 transition-colors text-left"
          >
            <action.icon size={20} className={action.color} />
            <span className="text-sm font-medium">{action.label}</span>
            <ChevronRight size={14} className="ml-auto text-muted" />
          </button>
        ))}
      </div>

      <RoadmapSection clientId={client.id} />
    </div>
  );
}
