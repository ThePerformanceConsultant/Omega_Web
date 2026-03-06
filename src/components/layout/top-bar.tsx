"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

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
};

export function TopBar() {
  const pathname = usePathname();
  const title =
    Object.entries(pageTitles).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] || "Dashboard";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 border-b border-border-accent bg-background/80 backdrop-blur-sm">
      <h2 className="text-lg font-semibold">{title}</h2>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors">
          <Search size={18} />
        </button>
        <button className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
        </button>
      </div>
    </header>
  );
}
