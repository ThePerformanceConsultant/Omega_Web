"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchCoachAnalyticsSnapshot,
  type CoachAnalyticsSnapshot,
} from "@/lib/supabase/db";
import { BarChart3, ClipboardList, Flame, MessageCircle, Users } from "lucide-react";

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
        <div className="text-accent">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{subtitle}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [snapshot, setSnapshot] = useState<CoachAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchCoachAnalyticsSnapshot();
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completionRate = useMemo(() => {
    if (!snapshot || snapshot.totalClients === 0) return "0%";
    const base = (snapshot.activeClientsLast7Days / snapshot.totalClients) * 100;
    return `${Math.round(base)}%`;
  }, [snapshot]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Practice Analytics</h2>
        <p className="text-sm text-muted">
          Operational snapshot for client engagement and workload over the last 7 days.
        </p>
      </div>

      {loading && (
        <div className="glass-card p-6 text-sm text-muted">Loading analytics…</div>
      )}

      {!loading && error && (
        <div className="glass-card p-6 text-sm text-danger">{error}</div>
      )}

      {!loading && !error && snapshot && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Active Clients"
              value={`${snapshot.activeClientsLast7Days}/${snapshot.totalClients}`}
              subtitle={`Activity window: ${snapshot.windowStart} to ${snapshot.windowEnd}`}
              icon={<Users size={16} />}
            />
            <StatCard
              title="Unread Messages"
              value={`${snapshot.unreadMessages}`}
              subtitle="Coach inbox unread count"
              icon={<MessageCircle size={16} />}
            />
            <StatCard
              title="Pending Forms"
              value={`${snapshot.pendingForms}`}
              subtitle={`${snapshot.dueTodayForms} due today, ${snapshot.overdueForms} overdue`}
              icon={<ClipboardList size={16} />}
            />
            <StatCard
              title="Engagement Rate"
              value={completionRate}
              subtitle="Clients with workouts or food logs in last 7 days"
              icon={<BarChart3 size={16} />}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-foreground">Workload Snapshot</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Completed workouts (7d)</span>
                  <span className="text-sm font-semibold text-foreground">{snapshot.completedWorkoutsLast7Days}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Nutrition entries (7d)</span>
                  <span className="text-sm font-semibold text-foreground">{snapshot.foodEntriesLast7Days}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Upcoming forms (next 3 days)</span>
                  <span className="text-sm font-semibold text-foreground">{snapshot.upcomingForms}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-foreground">Risk Flags</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Overdue forms</span>
                  <span className={`text-sm font-semibold ${snapshot.overdueForms > 0 ? "text-danger" : "text-success"}`}>
                    {snapshot.overdueForms}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Due today</span>
                  <span className={`text-sm font-semibold ${snapshot.dueTodayForms > 0 ? "text-accent" : "text-foreground"}`}>
                    {snapshot.dueTodayForms}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Unread messages</span>
                  <span className={`text-sm font-semibold ${snapshot.unreadMessages > 0 ? "text-accent" : "text-foreground"}`}>
                    {snapshot.unreadMessages}
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-3">
                  <p className="text-xs text-muted flex items-center gap-2">
                    <Flame size={14} className="text-accent" />
                    Use this page as a quick operational view; client-by-client detail remains in each client profile.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
