"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Library,
  Apple,
  ChefHat,
  UtensilsCrossed,
  ClipboardList,
  MessageCircle,
  Calendar,
  BarChart3,
  FolderOpen,
  Bot,
  Palette,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useTotalUnread, messageStore } from "@/lib/message-store";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/db";

const baseNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "clients", label: "Clients", icon: Users, href: "/clients", badge: 0 },
  { id: "exercises", label: "Exercise Library", icon: Library, href: "/exercises" },
  { id: "ingredients", label: "Ingredients", icon: Apple, href: "/ingredients" },
  { id: "recipes", label: "Recipes", icon: ChefHat, href: "/recipes" },
  { id: "programs", label: "Programs", icon: Dumbbell, href: "/programs" },
  { id: "nutrition", label: "Nutrition", icon: UtensilsCrossed, href: "/nutrition" },
  { id: "forms", label: "Forms", icon: ClipboardList, href: "/forms" },
  { id: "messages", label: "Messages", icon: MessageCircle, href: "/messages", badge: 0 },
  { id: "calendar", label: "Calendar", icon: Calendar, href: "/calendar" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/analytics" },
  { id: "vault", label: "Vault", icon: FolderOpen, href: "/vault" },
  { id: "automations", label: "Automations", icon: Bot, href: "/automations" },
  { id: "branding", label: "Branding", icon: Palette, href: "/branding" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const totalUnread = useTotalUnread();
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false);
  const [coachName, setCoachName] = useState("Coach");
  const [coachInitials, setCoachInitials] = useState("OC");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      // Hydrate message store for unread badge (idempotent — skips if already hydrated)
      messageStore.hydrate(user.id);
      supabase
        .from("profiles")
        .select("full_name, avatar_initials")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setCoachName(data.full_name || "Coach");
            setCoachInitials(data.avatar_initials || "OC");
          }
        });
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navItems = baseNavItems.map((item) =>
    item.id === "messages" ? { ...item, badge: totalUnread } : item
  );

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-60"
      } h-screen flex flex-col border-r border-white/10 bg-gradient-to-b from-[#111111] to-[#1e1e1e] shrink-0 transition-all duration-300 ease-in-out relative`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-4 top-16 z-30 w-8 h-8 rounded-full bg-accent border-2 border-white/80 flex items-center justify-center text-white shadow-[0_8px_20px_rgba(184,134,11,0.45)] hover:scale-105 hover:bg-accent-light transition-all"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Logo */}
      <div className={`p-6 ${collapsed ? "px-0 flex justify-center" : ""}`}>
        {collapsed ? (
          <span className="text-sm font-bold text-accent">OC</span>
        ) : (
          <h1 className="text-xl font-bold text-accent">Omega Coach</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? "px-2" : "px-3"} space-y-1`}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              } rounded-lg text-sm font-medium transition-colors relative ${
                isActive
                  ? "bg-accent/20 text-accent"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.badge != null && item.badge > 0 && (
                <span className="bg-accent/25 text-accent text-xs font-semibold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge != null && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div
          className={`flex items-center ${
            collapsed ? "justify-center" : "gap-3 px-3"
          } py-2`}
        >
          <div className="w-8 h-8 rounded-full bg-accent/25 flex items-center justify-center text-accent text-xs font-bold shrink-0">
            {coachInitials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{coachName}</p>
              <p className="text-xs text-white/50">Coach</p>
            </div>
          )}
          {isSupabaseConfigured() && !collapsed && (
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
