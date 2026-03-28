"use client";

import { useEffect } from "react";
import { Client, ClientSubTab } from "@/lib/types";
import { clientStore } from "@/lib/client-store";
import { clientViewStore, useClientViewState } from "@/lib/client-view-store";
import { createClient } from "@/lib/supabase/client";
import { SidePanel } from "./side-panel";
import { ChatPanel } from "./chat-panel";
import { TasksPanel } from "./tasks-panel";
import { CheckinsPanel } from "./checkins-panel";
import { NotesPanel } from "./notes-panel";
import { InfoPanel } from "./info-panel";
import { OverviewTab } from "./tabs/overview-tab";
import { WorkoutsTab } from "./tabs/workouts-tab";
import { NutritionTab } from "./tabs/nutrition-tab";
import { ProgressTab } from "./tabs/progress-tab";
import { RoadmapTab } from "./tabs/roadmap";

const PANEL_TITLES: Record<string, string> = {
  chat: "Chat",
  tasks: "Tasks",
  checkins: "Check-ins",
  notes: "Notes",
  info: "Info",
};

export function ClientProfile({
  client,
  initialTab,
}: {
  client: Client;
  initialTab?: ClientSubTab;
}) {
  const { activePanel, activeSubTab } = useClientViewState();

  // Hydrate tasks & notes for this client
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) clientStore.setCoachId(user.id);
    });
    clientStore.hydrateClient(client.id);
  }, [client.id]);

  useEffect(() => {
    if (initialTab) {
      clientViewStore.setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-4">
      <div className="relative min-h-[calc(100vh-200px)]">
        <div
          className={`transition-all duration-500 ease-out min-w-0 ${
            activePanel ? "pr-[min(38vw,560px)]" : "w-full"
          }`}
        >
          {activeSubTab === "overview" && (
            <OverviewTab client={client} onNavigateToTab={clientViewStore.setActiveSubTab} />
          )}
          {activeSubTab === "workouts" && (
            <WorkoutsTab clientId={client.id} />
          )}
          {activeSubTab === "nutrition" && (
            <NutritionTab clientId={client.id} />
          )}
          {activeSubTab === "progress" && (
            <ProgressTab clientId={client.id} />
          )}
          {activeSubTab === "roadmap" && (
            <RoadmapTab clientId={client.id} />
          )}
        </div>

        {activePanel && (
          <div className="absolute right-0 top-1.5 bottom-1.5 w-[min(38vw,560px)] animate-panel-in-right rounded-l-2xl overflow-hidden border border-black/10 bg-white/98 shadow-[-10px_0_28px_rgba(0,0,0,0.06)]">
            <SidePanel
              title={PANEL_TITLES[activePanel]}
              onClose={() => clientViewStore.setActivePanel(null)}
            >
              {activePanel === "chat" && <ChatPanel clientId={client.id} />}
              {activePanel === "tasks" && <TasksPanel clientId={client.id} />}
              {activePanel === "checkins" && <CheckinsPanel clientId={client.id} />}
              {activePanel === "notes" && <NotesPanel clientId={client.id} />}
              {activePanel === "info" && <InfoPanel clientId={client.id} />}
            </SidePanel>
          </div>
        )}
      </div>
    </div>
  );
}
