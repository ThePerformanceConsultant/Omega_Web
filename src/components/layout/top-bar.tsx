"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Bot,
  Check,
  CheckCheck,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  Info,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings,
  StickyNote,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import type { ClientPanelType, ClientSubTab, NotificationItem } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/db";
import {
  notificationStore,
  useNotificationUnreadCount,
  useNotifications,
} from "@/lib/notification-store";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { clientViewStore, useClientViewState } from "@/lib/client-view-store";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clients",
  "/exercises": "Exercise Library",
  "/programs": "Programs",
  "/nutrition": "Nutrition",
  "/forms": "Forms",
  "/messages": "Messages",
  "/calendar": "Calendar",
  "/analytics": "Analytics",
  "/vault": "Vault",
  "/branding": "Branding",
  "/settings": "Settings",
};

const CLIENT_PANELS: Array<{
  key: Exclude<ClientPanelType, null>;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "checkins", label: "Check-ins", icon: ClipboardList },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "info", label: "Info", icon: Info },
];

const CLIENT_TABS: Array<{
  key: ClientSubTab;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "workouts", label: "Workouts", icon: Dumbbell },
  { key: "nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { key: "progress", label: "Progress", icon: TrendingUp },
  { key: "roadmap", label: "Roadmap", icon: CalendarDays },
  { key: "automations", label: "Automations", icon: Bot },
];

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function notificationHeadline(item: NotificationItem): string {
  const payload = item.payload ?? {};
  const clientName = (payload.client_name as string) ?? "Client";
  const templateName = (payload.template_name as string) ?? "Form";
  const taskName = (payload.title as string) ?? "Task";
  const programName = (payload.program_name as string) ?? "Program";
  const mealPlanName = (payload.name as string) ?? (payload.meal_plan_name as string) ?? "Meal Plan";
  switch (item.kind) {
    case "message_received":
      return `New message from ${clientName}`;
    case "workout_assigned":
      return `Workout assigned: ${programName}`;
    case "workout_updated":
      return `Workout updated: ${programName}`;
    case "form_due":
      return `Form due: ${templateName}`;
    case "task_due":
      return `Task due: ${taskName}`;
    case "meal_plan_published":
      return `Meal plan published: ${mealPlanName}`;
    case "insight_published":
      return "New coach insight available";
    case "form_submitted":
      return `${clientName} submitted ${templateName}`;
    case "task_completed":
      return `${clientName} completed ${taskName}`;
    case "workout_completed":
      return `${clientName} completed a workout`;
    case "checkin_submitted":
      return `${clientName} submitted check-in`;
    default:
      return "New notification";
  }
}

function notificationTarget(item: NotificationItem): string {
  const payload = item.payload ?? {};
  const clientId =
    typeof payload.client_id === "string"
      ? payload.client_id
      : typeof payload.client_id === "number"
      ? String(payload.client_id)
      : null;
  const conversationId =
    typeof payload.conversation_id === "string"
      ? payload.conversation_id
      : typeof payload.conversation_id === "number"
      ? String(payload.conversation_id)
      : null;

  switch (item.kind) {
    case "message_received": {
      const params = new URLSearchParams();
      if (conversationId) params.set("conversationId", conversationId);
      if (clientId) params.set("clientId", clientId);
      const query = params.toString();
      return query ? `/messages?${query}` : "/messages";
    }
    case "form_submitted":
    case "checkin_submitted": {
      if (!clientId) return "/forms";
      const params = new URLSearchParams({
        clientId,
        panel: "checkins",
      });
      const templateId =
        typeof payload.template_id === "number"
          ? String(payload.template_id)
          : typeof payload.template_id === "string"
          ? payload.template_id
          : null;
      const responseId =
        typeof payload.response_id === "number"
          ? String(payload.response_id)
          : typeof payload.response_id === "string"
          ? payload.response_id
          : null;
      if (templateId) params.set("templateId", templateId);
      if (responseId) params.set("responseId", responseId);
      return `/clients?${params.toString()}`;
    }
    case "task_completed":
      return clientId ? `/clients?clientId=${encodeURIComponent(clientId)}&panel=tasks` : "/clients";
    case "workout_completed":
      return clientId ? `/clients?clientId=${encodeURIComponent(clientId)}&tab=progress` : "/clients";
    case "insight_published":
      return "/vault";
    default:
      return "/clients";
  }
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [isClientSwitcherOpen, setIsClientSwitcherOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const feedRef = useRef<HTMLDivElement | null>(null);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  const notifications = useNotifications();
  const unreadCount = useNotificationUnreadCount();
  const { clients, selectedClientId, activePanel, activeSubTab } = useClientViewState();

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const isClientDetail = pathname.startsWith("/clients") && selectedClient != null;

  const title =
    Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] || "Dashboard";

  const visibleNotifications = useMemo(() => notifications.slice(0, 12), [notifications]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => {
      return (
        client.full_name.toLowerCase().includes(q) ||
        (client.email ?? "").toLowerCase().includes(q) ||
        (client.tag ?? "").toLowerCase().includes(q)
      );
    });
  }, [clientSearch, clients]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) notificationStore.hydrate(user.id);
    });
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (feedRef.current && !feedRef.current.contains(target)) {
        setIsFeedOpen(false);
      }
      if (switcherRef.current && !switcherRef.current.contains(target)) {
        setIsClientSwitcherOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleMarkAllRead() {
    try {
      await notificationStore.markAsRead();
    } catch (error) {
      console.error("[TopBar] mark all read failed:", error);
    }
  }

  async function handleOpenNotification(item: NotificationItem) {
    try {
      if (!item.isRead) {
        await notificationStore.markAsRead([item.id]);
      }
    } catch (error) {
      console.error("[TopBar] mark read failed:", error);
    }
    setIsFeedOpen(false);
    router.push(notificationTarget(item));
  }

  function handleSelectClient(clientId: string) {
    clientViewStore.selectClient(clientId, { closePanel: true });
    setIsClientSwitcherOpen(false);
    setClientSearch("");
  }

  return (
    <header className="sticky top-0 z-20 px-8 py-4 border-b border-border-accent bg-background/92 backdrop-blur-md">
      {isClientDetail && selectedClient ? (
        <div className="w-full flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => clientViewStore.clearSelectedClient()}
              className="p-2 rounded-lg border border-black/10 text-muted hover:text-foreground hover:bg-black/[0.04] transition-colors"
              title="Back to clients"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="relative min-w-0" ref={switcherRef}>
              <button
                onClick={() => setIsClientSwitcherOpen((open) => !open)}
                className="flex items-center gap-3 rounded-xl bg-transparent px-1.5 py-1 min-w-[320px] hover:bg-black/[0.02] transition-colors"
              >
                <Avatar initials={selectedClient.avatar_initials || "?"} size={40} />
                <div className="min-w-0 text-left">
                  <p className="text-xl leading-tight font-semibold truncate">{selectedClient.full_name}</p>
                </div>
                <ChevronDown size={18} className="text-muted shrink-0 ml-auto" />
              </button>

              {isClientSwitcherOpen && (
                <div className="absolute left-0 top-[calc(100%+8px)] w-[640px] max-w-[85vw] rounded-2xl border border-black/12 bg-white shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-black/10">
                    <Search size={18} className="text-muted" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(event) => setClientSearch(event.target.value)}
                      placeholder="Search clients..."
                      className="w-full text-2xl bg-transparent border-0 outline-none placeholder:text-muted/70"
                    />
                  </div>
                  <div className="max-h-[360px] overflow-y-auto hide-scrollbar p-2">
                    {filteredClients.map((client) => {
                      const isCurrent = client.id === selectedClient.id;
                      return (
                        <button
                          key={client.id}
                          onClick={() => handleSelectClient(client.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                            isCurrent ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
                          }`}
                        >
                          <Avatar initials={client.avatar_initials || "?"} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="text-lg leading-tight font-semibold truncate">{client.full_name}</p>
                            <p className="text-xs leading-tight text-success mt-1">Active</p>
                          </div>
                          {isCurrent && <Check size={18} className="text-success shrink-0" />}
                        </button>
                      );
                    })}
                    {filteredClients.length === 0 && (
                      <p className="px-3 py-6 text-sm text-muted text-center">No matching clients.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="px-3 py-1 rounded-xl text-sm leading-none font-medium bg-success/15 text-success">
              Active
            </span>
          </div>

          <div className="flex items-center gap-2">
            {CLIENT_PANELS.map((panel) => {
              const isActive = activePanel === panel.key;
              return (
                <button
                  key={panel.key}
                  onClick={() => clientViewStore.setActivePanel(isActive ? null : panel.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                    isActive
                      ? "bg-accent text-white border-accent"
                      : "bg-white border-black/15 text-foreground/80 hover:bg-black/[0.04]"
                  }`}
                >
                  <panel.icon size={15} />
                  {panel.label}
                </button>
              );
            })}
          </div>
          </div>

          <div className="flex items-center gap-1 border-t border-black/10 pt-2">
            {CLIENT_TABS.map((tab) => {
              const isActive = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => clientViewStore.setActiveSubTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    isActive ? "text-accent bg-accent/8" : "text-muted hover:text-foreground hover:bg-black/[0.03]"
                  }`}
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors">
              <Search size={18} />
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
              title="Settings"
            >
              <Settings size={18} />
            </button>

            <div className="relative" ref={feedRef}>
              <button
                onClick={() => setIsFeedOpen((open) => !open)}
                className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-semibold flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  </>
                )}
              </button>

              {isFeedOpen && (
                <div className="absolute right-0 top-11 w-[360px] rounded-xl border border-black/10 bg-white shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 bg-black/[0.02]">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Notifications</p>
                      <p className="text-xs text-muted">{unreadCount} unread</p>
                    </div>
                    <button
                      onClick={handleMarkAllRead}
                      disabled={unreadCount === 0}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-accent disabled:text-muted disabled:cursor-not-allowed"
                    >
                      <CheckCheck size={14} />
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto">
                    {visibleNotifications.length === 0 ? (
                      <p className="px-4 py-10 text-sm text-muted text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      visibleNotifications.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleOpenNotification(item)}
                          className={`w-full text-left px-4 py-3 border-b border-black/5 hover:bg-black/[0.03] transition-colors ${
                            item.isRead ? "opacity-80" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                item.isRead ? "bg-transparent border border-muted/40" : "bg-accent"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                {notificationHeadline(item)}
                              </p>
                              <p className="text-xs text-muted mt-1">{timeAgo(item.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
