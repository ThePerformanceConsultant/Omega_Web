"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fetchClientExtendedInfo, fetchClients } from "@/lib/supabase/db";
import type { ClientExtendedInfo, Client } from "@/lib/types";

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2">
      <p className="text-[11px] text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function StatCard({ label, value, unit, tooltip }: { label: string; value: string; unit?: string; tooltip?: string }) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[11px] text-muted uppercase tracking-wider">{label}</span>
        {tooltip && (
          <span className="text-[10px] text-muted cursor-help" title={tooltip}>
            &#9432;
          </span>
        )}
      </div>
      <div className="text-xl font-bold">
        {value}
        {unit && <span className="text-xs text-muted font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-black/5 pb-4 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <div className="text-left">
            <h3 className="text-sm font-semibold">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

export function InfoPanel({ clientId }: { clientId: string }) {
  const [info, setInfo] = useState<ClientExtendedInfo | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [extInfo, clients] = await Promise.all([
        fetchClientExtendedInfo(clientId),
        fetchClients(),
      ]);
      if (cancelled) return;
      setInfo(extInfo);
      setClient(clients.find((c) => c.id === clientId) ?? null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return <p className="text-sm text-muted py-4">Loading client info...</p>;
  }

  if (!info || !client) {
    return <p className="text-sm text-muted py-4">No extended info available for this client.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Personal Information */}
      <CollapsibleSection title="Personal Information" icon="&#128100;" subtitle="Basic client details">
        <div className="grid grid-cols-2 gap-3">
          <InfoField label="Height" value={info.height_cm ? `${info.height_cm} cm` : "—"} />
          <InfoField label="Weight" value={info.weight_kg ? `${info.weight_kg} kg` : (client.current_weight ? `${client.current_weight} kg` : "—")} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <InfoField label="Age" value={info.age?.toString() || "—"} />
          <InfoField label="Gender" value={info.gender ? info.gender.charAt(0).toUpperCase() + info.gender.slice(1) : "—"} />
          <InfoField label="Primary Goal" value={info.goal_type || "—"} />
        </div>
      </CollapsibleSection>

      {/* Activity & Metrics */}
      <CollapsibleSection title="Activity & Metrics" icon="&#127939;" subtitle="Activity level and nutritional metrics">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <InfoField label="Activity Level" value={info.activity_level || "—"} />
          <InfoField label="Training Days / Week" value={info.training_days_per_week?.toString() || "—"} />
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatCard label="BMR" value={info.bmr?.toLocaleString() || "—"} unit="kcal/day" tooltip="Basal Metabolic Rate" />
          <StatCard label="TDEE" value={info.tdee?.toLocaleString() || "—"} unit="kcal/day" tooltip="Total Daily Energy Expenditure" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="PAL" value={info.pal?.toFixed(2) || "—"} tooltip="Physical Activity Level" />
          <StatCard label="Recommended" value={info.recommended_kcal?.toLocaleString() || "—"} unit="kcal/day" />
        </div>
      </CollapsibleSection>

      {/* Onboarding Questionnaire */}
      <CollapsibleSection title="Onboarding Questionnaire" icon="&#128203;" subtitle="Client intake responses" defaultOpen={false}>
        {info.onboarding_qa && info.onboarding_qa.length > 0 ? (
          <div className="space-y-1">
            {info.onboarding_qa.map((qa, i) => (
              <div key={i} className="py-2 border-b border-black/5 last:border-0">
                <p className="text-[11px] text-muted uppercase tracking-wider">{qa.question}</p>
                <p className="text-sm font-medium mt-0.5">{qa.answer}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted py-3">No onboarding questionnaire submitted yet</p>
        )}
      </CollapsibleSection>

      {/* Nutrition Onboarding */}
      <CollapsibleSection title="Nutrition Onboarding" icon="&#127860;" subtitle="Dietary assessment responses" defaultOpen={false}>
        {info.nutrition_qa && info.nutrition_qa.length > 0 ? (
          <div className="space-y-1">
            {info.nutrition_qa.map((qa, i) => (
              <div key={i} className="py-2 border-b border-black/5 last:border-0">
                <p className="text-[11px] text-muted uppercase tracking-wider">{qa.question}</p>
                <p className="text-sm font-medium mt-0.5">{qa.answer}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted py-3">No nutrition questionnaire submitted yet</p>
        )}
      </CollapsibleSection>
    </div>
  );
}
