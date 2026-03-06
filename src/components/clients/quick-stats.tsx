"use client";

import { Activity, Flame, Weight, Calendar } from "lucide-react";
import { Client } from "@/lib/types";

function complianceColor(pct: number) {
  if (pct >= 90) return "text-success";
  if (pct >= 75) return "text-warning";
  return "text-accent";
}

export function QuickStats({ client }: { client: Client }) {
  const c = client;
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
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Flame size={16} className="text-accent-light" />
          <span className="text-xs text-muted">Streak</span>
        </div>
        <div className="text-2xl font-bold">
          {c.streak_days} <span className="text-sm text-muted font-normal">days</span>
        </div>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Weight size={16} className="text-success" />
          <span className="text-xs text-muted">Weight</span>
        </div>
        <div className="text-2xl font-bold">
          {c.current_weight ? `${c.current_weight}kg` : "—"}
        </div>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className="text-warning" />
          <span className="text-xs text-muted">Phase</span>
        </div>
        <div className="text-lg font-bold">{c.current_phase || "—"}</div>
      </div>
    </div>
  );
}
