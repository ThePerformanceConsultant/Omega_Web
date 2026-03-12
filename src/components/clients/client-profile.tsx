"use client";

import { useState, useEffect } from "react";
import { Client, ClientPanelType, ClientSubTab } from "@/lib/types";
import { clientStore } from "@/lib/client-store";
import { createClient } from "@/lib/supabase/client";
import { ClientHeader } from "./client-header";
import { SubTabBar } from "./sub-tab-bar";
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
  onBack,
  initialTab,
}: {
  client: Client;
  onBack: () => void;
  initialTab?: ClientSubTab;
}) {
  const [activePanel, setActivePanel] = useState<ClientPanelType>(null);
  const [activeSubTab, setActiveSubTab] = useState<ClientSubTab>(initialTab ?? "overview");

  // Hydrate tasks & notes for this client
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) clientStore.setCoachId(user.id);
    });
    clientStore.hydrateClient(client.id);
  }, [client.id]);

  return (
    <div className="space-y-4">
      {/* Header — always visible */}
      <ClientHeader
        client={client}
        activePanel={activePanel}
        onPanelToggle={setActivePanel}
        onBack={onBack}
      />

      {/* Sub-tab navigation */}
      <SubTabBar activeTab={activeSubTab} onTabChange={setActiveSubTab} />

      {/* Flex row: main content + flush side panel */}
      <div
        className={`flex min-h-[calc(100vh-200px)] ${
          activePanel ? "-mr-8 -mb-8" : ""
        }`}
      >
        {/* Main content — shrinks when panel is open */}
        <div
          className={`transition-all duration-300 min-w-0 ${
            activePanel ? "flex-[65] pr-5" : "w-full"
          }`}
        >
          {activeSubTab === "overview" && (
            <OverviewTab client={client} onNavigateToTab={setActiveSubTab} />
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

        {/* Inline side panel — flush right + bottom, no overlay */}
        {activePanel && (
          <SidePanel
            title={PANEL_TITLES[activePanel]}
            onClose={() => setActivePanel(null)}
          >
            {activePanel === "chat" && <ChatPanel clientId={client.id} />}
            {activePanel === "tasks" && <TasksPanel clientId={client.id} />}
            {activePanel === "checkins" && <CheckinsPanel clientId={client.id} />}
            {activePanel === "notes" && <NotesPanel clientId={client.id} />}
            {activePanel === "info" && <InfoPanel clientId={client.id} />}
          </SidePanel>
        )}
      </div>
    </div>
  );
}
