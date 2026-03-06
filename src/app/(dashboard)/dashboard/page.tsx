import { LayoutDashboard, Users, Dumbbell, TrendingUp, MessageCircle, ClipboardList } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { label: "Active Clients", value: "24", icon: Users, change: "+3 this month" },
    { label: "Programs", value: "8", icon: Dumbbell, change: "2 drafts" },
    { label: "Compliance", value: "87%", icon: TrendingUp, change: "+5% vs last week" },
    { label: "Unread Messages", value: "6", icon: MessageCircle, change: "3 clients" },
    { label: "Pending Check-ins", value: "4", icon: ClipboardList, change: "2 overdue" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Icon size={18} className="text-accent" />
                </div>
                <span className="text-sm text-muted">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted mt-1">{stat.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <LayoutDashboard size={16} className="text-accent" />
            Recent Activity
          </h3>
          <p className="text-sm text-muted">Activity feed will appear here once connected to Supabase.</p>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Users size={16} className="text-accent" />
            Client Compliance
          </h3>
          <p className="text-sm text-muted">Compliance rankings will appear here once connected to Supabase.</p>
        </div>
      </div>
    </div>
  );
}
