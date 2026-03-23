"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Flame, Weight, Calendar } from "lucide-react";
import { Client } from "@/lib/types";
import { fetchClientOverviewStats } from "@/lib/supabase/db";

function complianceColor(pct: number) {
  if (pct >= 90) return "text-success";
  if (pct >= 75) return "text-warning";
  return "text-accent";
}

export function QuickStats({ client }: { client: Client }) {
  const [derived, setDerived] = useState<{
    compliancePct: number;
    streakDays: number;
    currentWeight: number | null;
    currentPhase: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrateStats() {
      try {
        const stats = await fetchClientOverviewStats(client.id);
        if (!cancelled) setDerived(stats);
      } catch (err) {
        console.error("[QuickStats] failed to hydrate overview stats:", err);
      }
    }
    hydrateStats();
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const c = useMemo(
    () => ({
      compliance_pct: derived?.compliancePct ?? client.compliance_pct ?? 0,
      streak_days: derived?.streakDays ?? client.streak_days ?? 0,
      current_weight: derived?.currentWeight ?? client.current_weight ?? null,
      current_phase: derived?.currentPhase ?? client.current_phase ?? null,
    }),
    [client.compliance_pct, client.current_phase, client.current_weight, client.streak_days, derived]
  );

  const weightLabel =
    c.current_weight != null && Number.isFinite(Number(c.current_weight))
      ? `${Number(c.current_weight).toFixed(1).replace(/\.0$/, "")} kg`
      : "—";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={16} className="text-accent" />
          <span className="text-xs text-muted">Compliance</span>
        </div>
        <div className={`text-2xl font-bold ${complianceColor(c.compliance_pct)}`}>
          {c.compliance_pct}%
        </div>
        <p className="text-[10px] text-muted mt-1">Last 7 days of logged training/nutrition</p>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Flame size={16} className="text-accent-light" />
          <span className="text-xs text-muted">Streak</span>
        </div>
        <div className="text-2xl font-bold">
          {c.streak_days} <span className="text-sm text-muted font-normal">days</span>
        </div>
        <p className="text-[10px] text-muted mt-1">Consecutive days with logged activity</p>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Weight size={16} className="text-success" />
          <span className="text-xs text-muted">Weight</span>
        </div>
        <div className="text-2xl font-bold">
          {weightLabel}
        </div>
        <p className="text-[10px] text-muted mt-1">Latest body-mass entry</p>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className="text-warning" />
          <span className="text-xs text-muted">Phase</span>
        </div>
        <div className="text-lg font-bold">{c.current_phase || "—"}</div>
        <p className="text-[10px] text-muted mt-1">Current phase from active programme</p>
      </div>
    </div>
  );
}
