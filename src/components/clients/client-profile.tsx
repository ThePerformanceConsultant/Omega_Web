"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
import { AutomationsTab } from "./tabs/automations-tab";

const PANEL_TITLES: Record<string, string> = {
  chat: "Chat",
  tasks: "Tasks",
  checkins: "Check-ins",
  notes: "Notes",
  info: "Info",
};

export function ClientProfile({
  client,
  onClientDeleted,
  initialTab,
}: {
  client: Client;
  onClientDeleted?: (clientId: string) => void;
  initialTab?: ClientSubTab;
}) {
  const { activePanel, activeSubTab } = useClientViewState();
  const [deletePending, setDeletePending] = useState(false);

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

  async function handleDeleteClient() {
    if (deletePending) return;

    const firstConfirm = window.confirm(
      `Delete ${client.full_name}'s account? This permanently removes their login and cannot be undone.`
    );
    if (!firstConfirm) return;

    const confirmationText = window.prompt("Type DELETE to confirm account deletion.");
    if (confirmationText !== "DELETE") return;

    setDeletePending(true);
    try {
      const response = await fetch("/api/admin/delete-client", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete client account");
      }

      if (onClientDeleted) {
        onClientDeleted(client.id);
      } else {
        const remainingClients = clientViewStore
          .getState()
          .clients
          .filter((existingClient) => existingClient.id !== client.id);
        clientViewStore.setClients(remainingClients);
        clientViewStore.clearSelectedClient();
      }
    } catch (error: any) {
      window.alert(error?.message || "Failed to delete client account.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleDeleteClient}
          disabled={deletePending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
          {deletePending ? "Deleting..." : "Delete Client Account"}
        </button>
      </div>

      <div className="relative min-h-[calc(100vh-200px)]">
        <div
          className={`transition-all duration-500 ease-out min-w-0 ${
            activePanel ? "pr-[calc(min(38vw,560px)+12px)]" : "w-full"
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
          {activeSubTab === "automations" && (
            <AutomationsTab clientId={client.id} />
          )}
        </div>

        {activePanel && (
          <div className="fixed right-8 top-[8.75rem] bottom-8 z-30 w-[min(38vw,560px)] animate-panel-in-right pointer-events-none">
            <div className="h-full rounded-l-[22px] overflow-hidden border border-black/10 bg-white/98 shadow-[-10px_0_28px_rgba(0,0,0,0.06)] pointer-events-auto">
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
          </div>
        )}
      </div>
    </div>
  );
}
