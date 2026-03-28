import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ScrollRevealProvider } from "@/components/layout/scroll-reveal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <ScrollRevealProvider />
          <TopBar />
          <main className="p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
