"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Flame,
  TrendingUp,
  Calendar,
  BarChart3,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isAfter,
  isSameDay,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import type {
  FoodLogEntry,
  FoodLogViewMode,
  ComplianceLevel,
  MealPlanTemplate,
  ClientSupplementPrescription,
  SupplementAdherenceLog,
  NutritionDailyNote,
  NutritionDayStatus,
} from "@/lib/types";
import {
  fetchFoodLogEntries,
  fetchClientSupplementPrescriptions,
  fetchSupplementAdherenceLogs,
  fetchNutritionDailyNotes,
  fetchNutritionDayStatuses,
} from "@/lib/supabase/db";
import { MicronutrientCollapsible } from "@/components/nutrition/micronutrient-collapsible";

// ── Compliance Helpers ──────────────────────────────────────

function getComplianceLevel(actual: number, target: number): ComplianceLevel {
  if (target === 0) return "green";
  const ratio = actual / target;
  if (ratio >= 0.9 && ratio <= 1.1) return "green";
  if (ratio < 0.9) return "orange";
  return "red"; // over 110%
}

const COMPLIANCE_STYLES: Record<ComplianceLevel, string> = {
  green: "text-green-600 bg-green-500/15",
  orange: "text-orange-500 bg-orange-500/15",
  red: "text-red-500 bg-red-500/15",
};

const COMPLIANCE_BAR: Record<ComplianceLevel, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function computePlanTargets(plan: MealPlanTemplate | null): MacroTargets | null {
  if (!plan || plan.dayTypes.length === 0) return null;
  const dt = plan.dayTypes[0];
  const slots = dt.mealSlots.filter((s) => s.enabled);
  let totalCal = 0,
    totalP = 0,
    totalC = 0,
    totalF = 0;
  for (const slot of slots) {
    const pm = plan.planMeals.find(
      (m) => m.dayTypeId === dt.id && m.mealSlotId === slot.id
    );
    if (pm?.options[0]) {
      totalCal += pm.options[0].totalCalories;
      totalP += pm.options[0].totalProtein;
      totalC += pm.options[0].totalCarbs;
      totalF += pm.options[0].totalFat;
    }
  }
  return { calories: totalCal, protein: totalP, carbs: totalC, fat: totalF };
}

// ── Main Component ──────────────────────────────────────────

export function FoodLogViewer({
  clientId,
  plan,
}: {
  clientId: string;
  plan: MealPlanTemplate | null;
}) {
  const [viewMode, setViewMode] = useState<FoodLogViewMode>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [clientSupplements, setClientSupplements] = useState<ClientSupplementPrescription[]>([]);
  const [adherenceLogs, setAdherenceLogs] = useState<SupplementAdherenceLog[]>([]);
  const [dailyNotes, setDailyNotes] = useState<NutritionDailyNote[]>([]);
  const [dayStatuses, setDayStatuses] = useState<NutritionDayStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const targets = useMemo(() => computePlanTargets(plan), [plan]);

  // Compute date range based on view mode
  const { startDate, endDate } = useMemo(() => {
    if (viewMode === "day") {
      const d = format(currentDate, "yyyy-MM-dd");
      return { startDate: d, endDate: d };
    }
    if (viewMode === "week") {
      return {
        startDate: format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    return {
      startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
      endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
    };
  }, [viewMode, currentDate]);

  useEffect(() => {
    let cancelled = false;
    fetchClientSupplementPrescriptions(clientId)
      .then((rows) => {
        if (!cancelled) setClientSupplements(rows.filter((row) => row.isActive));
      })
      .catch((error) => {
        console.error("[FoodLogViewer] supplement prescription fetch error:", error);
        if (!cancelled) setClientSupplements([]);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  // Fetch entries + supplement adherence + nutrition notes for the current range
  useEffect(() => {
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- intentional loading state before async fetch
    Promise.all([
      fetchFoodLogEntries(clientId, startDate, endDate),
      fetchSupplementAdherenceLogs(clientId, startDate, endDate),
      fetchNutritionDailyNotes(clientId, startDate, endDate),
      fetchNutritionDayStatuses(clientId, startDate, endDate),
    ])
      .then(([foodRows, adherenceRows, noteRows, statusRows]) => {
        if (cancelled) return;
        setEntries(foodRows);
        setAdherenceLogs(adherenceRows);
        setDailyNotes(noteRows);
        setDayStatuses(statusRows);
      })
      .catch((err) => {
        console.error("[FoodLogViewer] fetch error:", err);
        if (!cancelled) {
          setEntries([]);
          setAdherenceLogs([]);
          setDailyNotes([]);
          setDayStatuses([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId, startDate, endDate]);

  // Navigate date
  function navigate(direction: 1 | -1) {
    const fn =
      viewMode === "day"
        ? direction === 1 ? addDays : subDays
        : viewMode === "week"
        ? direction === 1 ? addWeeks : subWeeks
        : direction === 1 ? addMonths : subMonths;
    const step = viewMode === "day" ? 1 : 1;
    const next = fn(currentDate, step);
    if (direction === 1 && isAfter(next, new Date())) return;
    setCurrentDate(next);
  }

  // Date label
  const dateLabel = useMemo(() => {
    if (viewMode === "day") {
      if (isSameDay(currentDate, new Date())) return "Today";
      return format(currentDate, "EEE, MMM d, yyyy");
    }
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [viewMode, currentDate]);

  // Aggregate daily totals
  const dayTotals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories * e.servingMultiplier,
        protein: acc.protein + e.proteinG * e.servingMultiplier,
        carbs: acc.carbs + e.carbsG * e.servingMultiplier,
        fat: acc.fat + e.fatG * e.servingMultiplier,
        fiber: acc.fiber + e.fiberG * e.servingMultiplier,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }, [entries]);

  // Aggregate micronutrients
  const microTotals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const e of entries) {
      const mult = e.servingMultiplier;
      for (const [key, value] of Object.entries(e.micronutrients)) {
        result[key] = (result[key] ?? 0) + value * mult;
      }
    }
    return result;
  }, [entries]);

  // Group entries by meal slot (day view)
  const entriesBySlot = useMemo(() => {
    const groups: Record<string, FoodLogEntry[]> = {};
    for (const e of entries) {
      if (!groups[e.mealSlotName]) groups[e.mealSlotName] = [];
      groups[e.mealSlotName].push(e);
    }
    return groups;
  }, [entries]);

  const selectedDateKey = useMemo(
    () => format(currentDate, "yyyy-MM-dd"),
    [currentDate]
  );

  const adherenceByPrescriptionId = useMemo(() => {
    const map = new Map<string, SupplementAdherenceLog>();
    if (viewMode !== "day") return map;
    for (const log of adherenceLogs) {
      if (log.date === selectedDateKey) {
        map.set(log.clientSupplementPrescriptionId, log);
      }
    }
    return map;
  }, [adherenceLogs, selectedDateKey, viewMode]);

  const selectedDayNote = useMemo(() => {
    if (viewMode !== "day") return null;
    return dailyNotes.find((row) => row.date === selectedDateKey)?.note ?? null;
  }, [dailyNotes, selectedDateKey, viewMode]);

  const selectedDayStatus = useMemo(() => {
    if (viewMode !== "day") return null;
    return dayStatuses.find((row) => row.date === selectedDateKey)?.status ?? "incomplete";
  }, [dayStatuses, selectedDateKey, viewMode]);

  const nonEmptyNotes = useMemo(
    () => dailyNotes.filter((row) => row.note.trim().length > 0),
    [dailyNotes]
  );

  const adherenceSummary = useMemo(() => {
    if (viewMode === "day") return null;
    const total = adherenceLogs.length;
    const taken = adherenceLogs.filter((row) => row.taken).length;
    const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { total, taken, pct };
  }, [adherenceLogs, viewMode]);

  // Weekly/monthly averages
  const averages = useMemo(() => {
    if (viewMode === "day" || entries.length === 0) return null;
    const uniqueDays = new Set(entries.map((e) => e.date)).size;
    const divisor = uniqueDays || 1;
    return {
      calories: dayTotals.calories / divisor,
      protein: dayTotals.protein / divisor,
      carbs: dayTotals.carbs / divisor,
      fat: dayTotals.fat / divisor,
      daysLogged: uniqueDays,
    };
  }, [entries, viewMode, dayTotals]);

  // Day-by-day compliance strip (week/month)
  const dailyCompliance = useMemo(() => {
    if (viewMode === "day") return [];
    const byDate: Record<string, FoodLogEntry[]> = {};
    for (const e of entries) {
      byDate[e.date] = byDate[e.date] || [];
      byDate[e.date].push(e);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayEntries]) => {
        const dayCal = dayEntries.reduce(
          (s, e) => s + e.calories * e.servingMultiplier,
          0
        );
        return {
          date,
          level: getComplianceLevel(dayCal, targets?.calories ?? 0),
        };
      });
  }, [entries, viewMode, targets]);

  // Per-day macro breakdowns for stacked bar chart
  const dailyMacroBreakdown = useMemo(() => {
    const byDate: Record<string, { protein: number; carbs: number; fat: number }> = {};
    for (const e of entries) {
      const m = e.servingMultiplier;
      if (!byDate[e.date]) byDate[e.date] = { protein: 0, carbs: 0, fat: 0 };
      byDate[e.date].protein += e.proteinG * m;
      byDate[e.date].carbs += e.carbsG * m;
      byDate[e.date].fat += e.fatG * m;
    }
    // Build full range of days
    if (!startDate || !endDate) return [];
    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const data = byDate[key] ?? { protein: 0, carbs: 0, fat: 0 };
      return {
        date: key,
        label: format(d, "d. MMM"),
        shortLabel: format(d, "d"),
        proteinKcal: data.protein * 4,
        carbsKcal: data.carbs * 4,
        fatKcal: data.fat * 9,
        proteinG: data.protein,
        carbsG: data.carbs,
        fatG: data.fat,
        totalKcal: data.protein * 4 + data.carbs * 4 + data.fat * 9,
      };
    });
  }, [entries, startDate, endDate]);

  // Top foods (week/month)
  const topFoods = useMemo(() => {
    const freq: Record<string, { count: number; totalCal: number }> = {};
    for (const e of entries) {
      if (!freq[e.foodName]) freq[e.foodName] = { count: 0, totalCal: 0 };
      freq[e.foodName].count += 1;
      freq[e.foodName].totalCal += e.calories * e.servingMultiplier;
    }
    return Object.entries(freq)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* View mode toggle + date nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(["day", "week", "month"] as FoodLogViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                viewMode === mode
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-black/5"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-foreground min-w-[140px] text-center">
            {dateLabel}
          </span>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors disabled:opacity-30"
            disabled={isSameDay(currentDate, new Date()) && viewMode === "day"}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="glass-card p-10 text-center">
          <p className="text-xs text-muted animate-pulse">Loading food logs...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="glass-card p-10 text-center">
          <UtensilsCrossed size={40} className="mx-auto mb-4 text-muted/30" />
          <p className="text-sm font-semibold text-foreground">No food logs</p>
          <p className="text-xs text-muted mt-1">
            {viewMode === "day"
              ? "No foods logged for this day"
              : `No foods logged in this ${viewMode}`}
          </p>
        </div>
      )}

      {!loading && entries.length === 0 && viewMode === "day" && (
        <>
          <NutritionDayStatusCard status={selectedDayStatus} />
          <SupplementAdherenceCard
            prescriptions={clientSupplements}
            adherenceByPrescriptionId={adherenceByPrescriptionId}
          />
          <NutritionDailyNoteCard note={selectedDayNote} />
        </>
      )}

      {/* Content */}
      {!loading && entries.length > 0 && (
        <>
          {/* Compliance Summary */}
          <ComplianceSummary
            totals={viewMode === "day" ? dayTotals : averages!}
            targets={targets}
            isAverage={viewMode !== "day"}
            daysLogged={averages?.daysLogged}
          />

          {/* Stacked macro bar chart (week/month or day with multiple days context) */}
          {dailyMacroBreakdown.length > 0 && (
            <MacroStackedBarChart
              data={dailyMacroBreakdown}
              targets={targets}
            />
          )}

          {/* Day view */}
          {viewMode === "day" && (
            <>
              <NutritionDayStatusCard status={selectedDayStatus} />

              {Object.entries(entriesBySlot).map(([slotName, slotEntries]) => (
                <MealSlotLogCard
                  key={slotName}
                  slotName={slotName}
                  entries={slotEntries}
                />
              ))}

              <SupplementAdherenceCard
                prescriptions={clientSupplements}
                adherenceByPrescriptionId={adherenceByPrescriptionId}
              />

              <NutritionDailyNoteCard note={selectedDayNote} />

              {/* Micronutrients */}
              {Object.keys(microTotals).length > 0 && (
                <div className="glass-card p-4">
                  <MicronutrientCollapsible micronutrients={microTotals} compact />
                </div>
              )}
            </>
          )}

          {/* Week/Month view */}
          {viewMode !== "day" && (
            <>
              {/* Compliance strip */}
              {dailyCompliance.length > 0 && (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={12} className="text-muted" />
                    <span className="text-xs font-semibold text-foreground">
                      Daily Compliance
                    </span>
                    <span className="text-[10px] text-muted ml-auto">
                      {dailyCompliance.filter((d) => d.level === "green").length}/
                      {dailyCompliance.length} days on target
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {dailyCompliance.map(({ date, level }) => (
                      <div
                        key={date}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-medium ${COMPLIANCE_STYLES[level]}`}
                        title={`${date}: ${level}`}
                      >
                        {new Date(date + "T00:00").getDate()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top foods */}
              {topFoods.length > 0 && (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={12} className="text-muted" />
                    <span className="text-xs font-semibold text-foreground">
                      Most Logged Foods
                    </span>
                  </div>
                  <div className="space-y-1">
                    {topFoods.map(({ name, count, totalCal }) => (
                      <div
                        key={name}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-[10px] text-foreground truncate flex-1">
                          {name}
                        </span>
                        <span className="text-[10px] text-muted tabular-nums ml-2">
                          {Math.round(totalCal)} kcal
                        </span>
                        <span className="text-[10px] font-medium text-accent tabular-nums ml-2 w-6 text-right">
                          {count}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adherenceSummary && (
                <SupplementAdherenceSummaryCard
                  total={adherenceSummary.total}
                  taken={adherenceSummary.taken}
                  pct={adherenceSummary.pct}
                />
              )}

              <NutritionNotesSummaryCard notes={nonEmptyNotes} />

              {/* Micronutrients (averaged) */}
              {Object.keys(microTotals).length > 0 && averages && (
                <div className="glass-card p-4">
                  <MicronutrientCollapsible
                    micronutrients={Object.fromEntries(
                      Object.entries(microTotals).map(([k, v]) => [
                        k,
                        v / (averages.daysLogged || 1),
                      ])
                    )}
                    compact
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Compliance Summary Card ──────────────────────────────────

function ComplianceSummary({
  totals,
  targets,
  isAverage,
  daysLogged,
}: {
  totals: { calories: number; protein: number; carbs: number; fat: number };
  targets: MacroTargets | null;
  isAverage: boolean;
  daysLogged?: number;
}) {
  const cal = Math.round(totals.calories);
  const targetCal = targets?.calories ?? 0;
  const circumference = 2 * Math.PI * 38;

  // Compute macro calorie contributions for proportional donut
  const proteinKcal = totals.protein * 4;
  const carbsKcal = totals.carbs * 4;
  const fatKcal = totals.fat * 9;
  const macroTotal = proteinKcal + carbsKcal + fatKcal;

  // Donut segments: each macro gets a proportional arc
  const proteinFrac = macroTotal > 0 ? proteinKcal / macroTotal : 0;
  const carbsFrac = macroTotal > 0 ? carbsKcal / macroTotal : 0;
  const fatFrac = macroTotal > 0 ? fatKcal / macroTotal : 0;

  // Scale all segments by how much of the target is filled (capped at 100%)
  const fillRatio = targetCal > 0 ? Math.min(cal / targetCal, 1) : (macroTotal > 0 ? 1 : 0);

  const proteinArc = proteinFrac * fillRatio * circumference;
  const carbsArc = carbsFrac * fillRatio * circumference;
  const fatArc = fatFrac * fillRatio * circumference;

  const calLevel = targets ? getComplianceLevel(cal, targetCal) : "green";

  const macros = [
    {
      label: "Protein",
      current: totals.protein,
      target: targets?.protein ?? 0,
      color: "#ef4444",
    },
    {
      label: "Carbs",
      current: totals.carbs,
      target: targets?.carbs ?? 0,
      color: "#3b82f6",
    },
    {
      label: "Fat",
      current: totals.fat,
      target: targets?.fat ?? 0,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="glass-card p-4">
      {isAverage && daysLogged !== undefined && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px] font-medium text-muted">
            Average per day · {daysLogged} day{daysLogged !== 1 ? "s" : ""} logged
          </span>
        </div>
      )}

      <div className="flex items-center gap-5">
        {/* Donut — macro proportion colors */}
        <div className="relative w-[80px] h-[80px] shrink-0">
          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
            {/* Background track */}
            <circle
              cx="44" cy="44" r="38" fill="none"
              stroke="currentColor" className="text-black/[0.06]"
              strokeWidth="7"
            />
            {/* Fat segment (bottom layer — drawn first, offset furthest back) */}
            {fatArc > 0.5 && (
              <circle
                cx="44" cy="44" r="38" fill="none"
                stroke="#f59e0b" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${fatArc} ${circumference - fatArc}`}
                strokeDashoffset={-proteinArc - carbsArc}
                className="transition-all duration-500"
              />
            )}
            {/* Carbs segment */}
            {carbsArc > 0.5 && (
              <circle
                cx="44" cy="44" r="38" fill="none"
                stroke="#3b82f6" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${carbsArc} ${circumference - carbsArc}`}
                strokeDashoffset={-proteinArc}
                className="transition-all duration-500"
              />
            )}
            {/* Protein segment (top layer — drawn last) */}
            {proteinArc > 0.5 && (
              <circle
                cx="44" cy="44" r="38" fill="none"
                stroke="#ef4444" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${proteinArc} ${circumference - proteinArc}`}
                strokeDashoffset={0}
                className="transition-all duration-500"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xs font-bold leading-none ${
              calLevel === "red" ? "text-red-500" : calLevel === "orange" ? "text-orange-500" : "text-foreground"
            }`}>
              {cal}
            </span>
            {targetCal > 0 && (
              <span className="text-[8px] text-muted leading-tight">
                / {Math.round(targetCal)}
              </span>
            )}
            <span className="text-[7px] text-muted">kcal</span>
          </div>
        </div>

        {/* Macro bars */}
        <div className="flex-1 space-y-1.5">
          {macros.map((m) => {
            const level = m.target > 0
              ? getComplianceLevel(m.current, m.target)
              : "green";
            const fillPct =
              m.target > 0
                ? Math.min((m.current / m.target) * 100, 100)
                : 0;
            return (
              <div key={m.label} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold w-10 shrink-0"
                  style={{ color: m.color }}
                >
                  {m.label}
                </span>
                <span className="text-[10px] text-muted w-8 text-right tabular-nums shrink-0">
                  {Math.round(m.current)}g
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: COMPLIANCE_BAR[level],
                    }}
                  />
                </div>
                {m.target > 0 && (
                  <>
                    <span className="text-[10px] text-muted w-8 tabular-nums shrink-0">
                      {Math.round(m.target)}g
                    </span>
                    <span
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${COMPLIANCE_STYLES[level]}`}
                    >
                      {Math.round((m.current / m.target) * 100)}%
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Meal Slot Log Card ──────────────────────────────────────

function MealSlotLogCard({
  slotName,
  entries,
}: {
  slotName: string;
  entries: FoodLogEntry[];
}) {
  function formatEntryTime(value: string): string | null {
    if (!value) return null;
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, "HH:mm");
  }

  const slotCal = entries.reduce(
    (s, e) => s + e.calories * e.servingMultiplier,
    0
  );
  const slotP = entries.reduce(
    (s, e) => s + e.proteinG * e.servingMultiplier,
    0
  );
  const slotC = entries.reduce(
    (s, e) => s + e.carbsG * e.servingMultiplier,
    0
  );
  const slotF = entries.reduce(
    (s, e) => s + e.fatG * e.servingMultiplier,
    0
  );

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {slotName}
          </span>
          <span className="text-[10px] text-muted">
            {entries.length} item{entries.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <Flame size={10} className="text-accent" />
          <span className="font-semibold text-foreground tabular-nums">
            {Math.round(slotCal)} kcal
          </span>
        </div>
      </div>

      {/* Slot macro summary */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-black/5 bg-black/[0.01]">
        <span className="text-[10px] font-medium text-red-500 tabular-nums">
          P{Math.round(slotP)}g
        </span>
        <span className="text-[10px] font-medium text-blue-500 tabular-nums">
          C{Math.round(slotC)}g
        </span>
        <span className="text-[10px] font-medium text-amber-500 tabular-nums">
          F{Math.round(slotF)}g
        </span>
      </div>

      {/* Food entries */}
      <div className="divide-y divide-black/5">
        {entries.map((entry) => {
          const mult = entry.servingMultiplier;
          const timeLabel = formatEntryTime(entry.loggedAt);
          const gramLabel = entry.gramWeight > 0 ? `${Math.round(entry.gramWeight)} g` : null;
          return (
            <div
              key={entry.id}
              className="flex items-center gap-2 px-4 py-2 text-[10px]"
            >
              <span className="flex-1 text-foreground truncate">
                {entry.foodName}
              </span>
              {entry.servingSize && (
                <span className="text-muted tabular-nums shrink-0">
                  {entry.servingSize}
                  {mult !== 1 ? ` x${mult}` : ""}
                </span>
              )}
              {gramLabel && (
                <span className="text-muted tabular-nums shrink-0">
                  {gramLabel}
                </span>
              )}
              {timeLabel && (
                <span className="text-muted tabular-nums shrink-0">
                  {timeLabel}
                </span>
              )}
              <span className="text-muted tabular-nums shrink-0 w-14 text-right">
                {Math.round(entry.calories * mult)} kcal
              </span>
              <span className="text-red-500 font-medium tabular-nums shrink-0 w-7 text-right">
                P{Math.round(entry.proteinG * mult)}
              </span>
              <span className="text-blue-500 font-medium tabular-nums shrink-0 w-7 text-right">
                C{Math.round(entry.carbsG * mult)}
              </span>
              <span className="text-amber-500 font-medium tabular-nums shrink-0 w-7 text-right">
                F{Math.round(entry.fatG * mult)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupplementAdherenceCard({
  prescriptions,
  adherenceByPrescriptionId,
}: {
  prescriptions: ClientSupplementPrescription[];
  adherenceByPrescriptionId: Map<string, SupplementAdherenceLog>;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-foreground">Supplement Adherence</span>
      </div>
      {prescriptions.length === 0 ? (
        <p className="text-[11px] text-muted">No supplements assigned.</p>
      ) : (
        <div className="space-y-2">
          {prescriptions.map((prescription) => {
            const log = adherenceByPrescriptionId.get(prescription.id);
            const taken = log?.taken ?? false;
            return (
              <div
                key={prescription.id}
                className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground truncate">
                    {prescription.supplementName}
                  </p>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      taken ? "bg-green-500/15 text-green-600" : "bg-black/10 text-muted"
                    }`}
                  >
                    {taken ? "Taken" : "Pending"}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-muted flex items-center gap-2 flex-wrap">
                  <span>{prescription.dosageFrequency.replaceAll("_", " ")}</span>
                  {prescription.dosage && <span>· {prescription.dosage}</span>}
                  {prescription.timing && <span>· {prescription.timing}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NutritionDayStatusCard({
  status,
}: {
  status: "complete" | "incomplete" | null;
}) {
  const resolved = status === "complete" ? "complete" : "incomplete";
  const pillClass =
    resolved === "complete"
      ? "bg-green-500/15 text-green-700"
      : "bg-amber-500/15 text-amber-700";

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-foreground">Nutrition Day Status</span>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${pillClass}`}>
          {resolved}
        </span>
      </div>
    </div>
  );
}

function NutritionDailyNoteCard({ note }: { note: string | null }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-foreground">Client Daily Note</span>
      </div>
      {note && note.trim().length > 0 ? (
        <p className="text-xs text-foreground whitespace-pre-wrap">{note}</p>
      ) : (
        <p className="text-[11px] text-muted">No note added for this day.</p>
      )}
    </div>
  );
}

function SupplementAdherenceSummaryCard({
  total,
  taken,
  pct,
}: {
  total: number;
  taken: number;
  pct: number;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-foreground">Supplement Adherence Summary</span>
      </div>
      {total === 0 ? (
        <p className="text-[11px] text-muted">No supplement check-ins in this range.</p>
      ) : (
        <p className="text-xs text-foreground">
          {taken}/{total} logged as taken ({pct}%)
        </p>
      )}
    </div>
  );
}

function NutritionNotesSummaryCard({ notes }: { notes: NutritionDailyNote[] }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-foreground">Client Nutrition Notes</span>
      </div>
      {notes.length === 0 ? (
        <p className="text-[11px] text-muted">No notes in this range.</p>
      ) : (
        <div className="space-y-2">
          {notes.slice(0, 7).map((row) => (
            <div key={row.id} className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2">
              <p className="text-[10px] font-medium text-muted">{row.date}</p>
              <p className="text-xs text-foreground whitespace-pre-wrap">{row.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stacked Macro Bar Chart ─────────────────────────────────

interface BarDayData {
  date: string;
  label: string;
  shortLabel: string;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  totalKcal: number;
}

function MacroStackedBarChart({
  data,
  targets,
}: {
  data: BarDayData[];
  targets: MacroTargets | null;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxKcal = useMemo(() => {
    const dataMax = Math.max(...data.map((d) => d.totalKcal), 0);
    const targetMax = targets?.calories ?? 0;
    return Math.max(dataMax, targetMax, 100);
  }, [data, targets]);

  // Y-axis gridlines
  const gridStep = maxKcal > 3000 ? 1000 : maxKcal > 1500 ? 500 : 250;
  const gridLines = [];
  for (let v = gridStep; v <= maxKcal; v += gridStep) {
    gridLines.push(v);
  }

  const barWidth = data.length <= 7 ? 32 : data.length <= 14 ? 20 : 14;
  const barGap = data.length <= 7 ? 8 : 4;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={12} className="text-muted" />
        <span className="text-xs font-semibold text-foreground">
          Energy Consumed
        </span>
        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto">
          {[
            { label: "Protein", color: "#ef4444" },
            { label: "Carbs", color: "#3b82f6" },
            { label: "Fat", color: "#f59e0b" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: l.color }}
              />
              <span className="text-[9px] text-muted">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="relative" style={{ height: 180 }}>
        {/* Grid lines */}
        {gridLines.map((v) => (
          <div
            key={v}
            className="absolute left-8 right-0 border-t border-black/[0.06]"
            style={{ bottom: `${(v / maxKcal) * 100}%` }}
          >
            <span className="absolute -left-8 -top-2 text-[8px] text-muted w-7 text-right">
              {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
            </span>
          </div>
        ))}

        {/* Target line */}
        {targets && targets.calories > 0 && (
          <div
            className="absolute left-8 right-0 border-t border-dashed border-accent/40"
            style={{ bottom: `${(targets.calories / maxKcal) * 100}%` }}
          />
        )}

        {/* Bars */}
        <div
          className="absolute left-8 right-0 bottom-0 top-0 flex justify-center"
          style={{ gap: barGap }}
        >
          {data.map((day, idx) => {
            const pH = (day.proteinKcal / maxKcal) * 100;
            const cH = (day.carbsKcal / maxKcal) * 100;
            const fH = (day.fatKcal / maxKcal) * 100;

            return (
              <div
                key={day.date}
                className="relative flex flex-col items-center"
                style={{ width: barWidth }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Bar area — flex-1 gives definite height so % children resolve */}
                <div className="flex-1 w-full relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-sm overflow-hidden flex flex-col-reverse cursor-pointer"
                    style={{ height: `${pH + cH + fH}%` }}
                  >
                    {/* Protein (bottom) */}
                    <div
                      className="w-full transition-all duration-300"
                      style={{
                        height: pH + cH + fH > 0 ? `${(pH / (pH + cH + fH)) * 100}%` : "0%",
                        backgroundColor: "#ef4444",
                      }}
                    />
                    {/* Carbs (middle) */}
                    <div
                      className="w-full transition-all duration-300"
                      style={{
                        height: pH + cH + fH > 0 ? `${(cH / (pH + cH + fH)) * 100}%` : "0%",
                        backgroundColor: "#3b82f6",
                      }}
                    />
                    {/* Fat (top) */}
                    <div
                      className="w-full transition-all duration-300"
                      style={{
                        height: pH + cH + fH > 0 ? `${(fH / (pH + cH + fH)) * 100}%` : "0%",
                        backgroundColor: "#f59e0b",
                      }}
                    />
                  </div>
                </div>

                {/* X-axis label */}
                <span className="text-[7px] text-muted mt-1 leading-none shrink-0">
                  {data.length <= 14 ? day.label : day.shortLabel}
                </span>

                {/* Hover tooltip */}
                {hoveredIdx === idx && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-black/10 p-2.5 z-20 whitespace-nowrap">
                    <div className="text-[10px] font-semibold text-foreground mb-1.5">
                      {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-[10px]">
                        <div className="w-2 h-2 rounded-sm bg-[#ef4444]" />
                        <span className="text-muted w-10">Protein:</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {Math.round(day.proteinKcal)}
                        </span>
                        <span className="text-muted text-[9px]">kcal</span>
                        <span className="text-muted">·</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {Math.round(day.proteinG)}g
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <div className="w-2 h-2 rounded-sm bg-[#3b82f6]" />
                        <span className="text-muted w-10">Carbs:</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {Math.round(day.carbsKcal)}
                        </span>
                        <span className="text-muted text-[9px]">kcal</span>
                        <span className="text-muted">·</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {Math.round(day.carbsG)}g
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <div className="w-2 h-2 rounded-sm bg-[#f59e0b]" />
                        <span className="text-muted w-10">Fat:</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {Math.round(day.fatKcal)}
                        </span>
                        <span className="text-muted text-[9px]">kcal</span>
                        <span className="text-muted">·</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {Math.round(day.fatG)}g
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-black/5 mt-1.5 pt-1.5 text-[10px] flex items-center justify-between">
                      <span className="text-muted">Total:</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {Math.round(day.totalKcal)} kcal
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
