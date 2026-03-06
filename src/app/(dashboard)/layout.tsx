import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-[#fcfbf9] to-[#f8f6f3] text-foreground font-sans">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <TopBar />
          <main className="p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
