"use client";

import { useState, useEffect, useMemo, useCallback, useId } from "react";
import { Star, BarChart3, Target, CheckCircle2, XCircle, ListChecks, ChevronDown, ChevronRight, ChevronLeft, Settings2, Activity, Plus, Trash2, Heart, Clock, Flame, Zap } from "lucide-react";
import { fetchWorkoutLogs, fetchClientTasks, fetchMetricConfigs, fetchMetricEntries, createMetricConfig, updateMetricConfig, deleteMetricConfig, fetchActivitySessions, deleteActivitySession } from "@/lib/supabase/db";
import type { WorkoutLogEntry, Task, MetricConfig, MetricEntry, ActivitySession } from "@/lib/types";
import { AVAILABLE_HEALTH_METRICS, HEALTH_METRIC_CATEGORIES } from "@/lib/types";
import { WorkoutLogDetail } from "./workout-log-viewer";

// ─── Simple SVG Line Chart ───
function LineChart({
  data,
  color,
  height = 200,
  targetValue = null,
  valueFormatter,
}: {
  data: { date: string; value: number }[];
  color: string;
  height?: number;
  targetValue?: number | null;
  valueFormatter?: (value: number) => string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted"
        style={{ height }}
      >
        Not enough data
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = 500;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartH;

  const values = data.map((d) => d.value);
  const domainValues =
    targetValue !== null && Number.isFinite(targetValue)
      ? [...values, targetValue]
      : values;
  const minV = Math.min(...domainValues);
  const maxV = Math.max(...domainValues);
  const range = maxV - minV || 1;

  const toY = (value: number) => padding.top + chartH - ((value - minV) / range) * chartH;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = toY(d.value);
    return { x, y, date: d.date, value: d.value };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  const formatTick = (value: number) => {
    if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString();
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(1);
  };

  // Y-axis labels
  const yLabels = [minV, minV + range / 2, maxV].map((v) => ({
    value: formatTick(v),
    y: toY(v),
  }));

  // X-axis labels (first, middle, last)
  const xIdxs = [...new Set([0, Math.floor(data.length / 2), data.length - 1])];
  const hoveredPoint =
    hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;
  const targetY =
    targetValue !== null && Number.isFinite(targetValue) ? toY(targetValue) : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.36} />
          <stop offset="60%" stopColor={color} stopOpacity={0.12} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={yl.y}
            x2={width - padding.right}
            y2={yl.y}
            stroke="#e5e5e5"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={yl.y + 4}
            textAnchor="end"
            className="fill-gray-400"
            fontSize={10}
          >
            {yl.value}
          </text>
        </g>
      ))}

      {targetY !== null && (
        <g>
          <line
            x1={padding.left}
            y1={targetY}
            x2={width - padding.right}
            y2={targetY}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.8}
          />
          <text
            x={width - padding.right}
            y={Math.max(padding.top + 10, targetY - 6)}
            textAnchor="end"
            fontSize={10}
            className="fill-gray-500"
          >
            Target {formatTick(targetValue as number)}
          </text>
        </g>
      )}

      {/* X-axis labels */}
      {xIdxs.map((idx) => {
        const p = points[idx];
        if (!p) return null;
        const raw = data[idx].date;
        const d = new Date(raw);
        const label = Number.isNaN(d.getTime()) ? raw : `${d.getDate()}/${d.getMonth() + 1}`;
        return (
          <text
            key={`${idx}-${data[idx].date}`}
            x={p.x}
            y={height - 5}
            textAnchor="middle"
            className="fill-gray-400"
            fontSize={10}
          >
            {label}
          </text>
        );
      })}

      {/* Area */}
      <path d={areaD} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <g key={`${p.date}-${i}`}>
          <circle
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 5 : 3.5}
            fill={color}
            stroke="white"
            strokeWidth={2}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <title>{`${p.date}: ${valueFormatter ? valueFormatter(p.value) : formatTick(p.value)}`}</title>
          </circle>
        </g>
      ))}

      {hoveredPoint && (
        <g pointerEvents="none">
          <line
            x1={hoveredPoint.x}
            y1={padding.top}
            x2={hoveredPoint.x}
            y2={baselineY}
            stroke={color}
            strokeOpacity={0.28}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <rect
            x={Math.min(width - 160, hoveredPoint.x + 10)}
            y={Math.max(8, hoveredPoint.y - 42)}
            width={150}
            height={34}
            rx={6}
            fill="rgba(17,17,17,0.92)"
          />
          <text
            x={Math.min(width - 150, hoveredPoint.x + 18)}
            y={Math.max(24, hoveredPoint.y - 26)}
            fontSize={10}
            className="fill-white"
          >
            {hoveredPoint.date}
          </text>
          <text
            x={Math.min(width - 150, hoveredPoint.x + 18)}
            y={Math.max(37, hoveredPoint.y - 12)}
            fontSize={11}
            className="fill-white"
          >
            {valueFormatter ? valueFormatter(hoveredPoint.value) : formatTick(hoveredPoint.value)}
          </text>
        </g>
      )}
    </svg>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          className={i < rating ? "text-warning fill-warning" : "text-black/10"}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][d.getMonth()]}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Get the Monday of a given date's week */
function getMonday(d: Date): string {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function fromDbTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    clientId: row.client_id as string,
    title: row.title as string,
    completed: (row.completed as boolean) ?? false,
    completedAt: (row.completed_at as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    owner: (row.owner as "coach" | "client") ?? "coach",
    isWeeklyFocus: (row.is_weekly_focus as boolean) ?? false,
    createdAt: row.created_at as string,
  };
}

const WEEKS_PER_PAGE = 12;

function TaskHistorySection({ tasksByWeek }: { tasksByWeek: [string, Task[]][] }) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // Auto-expand the first week on mount / page change
  useEffect(() => {
    const pageWeeks = tasksByWeek.slice(page * WEEKS_PER_PAGE, (page + 1) * WEEKS_PER_PAGE);
    if (pageWeeks.length > 0) {
      setExpandedWeeks(new Set([pageWeeks[0][0]]));
    }
  }, [page, tasksByWeek]);

  const totalPages = Math.max(1, Math.ceil(tasksByWeek.length / WEEKS_PER_PAGE));
  const pageWeeks = tasksByWeek.slice(page * WEEKS_PER_PAGE, (page + 1) * WEEKS_PER_PAGE);

  function toggleWeek(monday: string) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(monday)) next.delete(monday);
      else next.add(monday);
      return next;
    });
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks size={16} className="text-accent" />
        <h3 className="text-base font-bold">Task History</h3>
      </div>
      {tasksByWeek.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No tasks assigned yet</p>
      ) : (
        <>
          <div className="space-y-1">
            {pageWeeks.map(([monday, weekTasks]) => {
              const isOpen = expandedWeeks.has(monday);
              const mondayDate = new Date(monday + "T00:00:00");
              const weekLabel = mondayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const completed = weekTasks.filter((t) => t.completed).length;
              const allDone = completed === weekTasks.length;
              return (
                <div key={monday}>
                  <button
                    onClick={() => toggleWeek(monday)}
                    className="w-full flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-black/[0.03] transition-colors"
                  >
                    {isOpen ? (
                      <ChevronDown size={14} className="text-muted shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-muted shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-muted">Week of {weekLabel}</span>
                    <span className="ml-auto text-[10px]" style={{ color: allDone ? "var(--color-success)" : "var(--color-muted)" }}>
                      {completed}/{weekTasks.length}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-1 pl-6 pb-2">
                      {weekTasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 py-1.5">
                          {t.completed ? (
                            <CheckCircle2 size={15} className="text-success shrink-0" />
                          ) : (
                            <XCircle size={15} className="text-danger shrink-0" />
                          )}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {t.isWeeklyFocus && <Target size={11} className="text-accent shrink-0" />}
                            <span className={`text-sm truncate ${t.completed ? "text-foreground" : "text-danger"}`}>
                              {t.title}
                            </span>
                          </div>
                          {t.completedAt && (
                            <span className="text-[10px] text-muted shrink-0">
                              {new Date(t.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4 border-t border-black/5 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-7 h-7 rounded text-xs font-medium ${
                    i === page ? "bg-accent text-white" : "text-muted hover:bg-black/5"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1 rounded hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Time Period Filter ───
const TIME_PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: 0 },
] as const;

function TimePeriodPicker({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex bg-black/[0.03] rounded-lg p-0.5 gap-0.5">
      {TIME_PERIODS.map((p) => (
        <button
          key={p.label}
          onClick={() => onChange(p.days)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            selected === p.days
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function filterByPeriod<T extends { date: string }>(items: T[], days: number): T[] {
  if (days === 0) return items;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter((item) => new Date(item.date) >= cutoff);
}

// ─── Default colors for metric categories ───
const CATEGORY_COLORS: Record<string, string> = {
  body: "#6366f1",
  activity: "#22c55e",
  heart: "#ef4444",
  sleep: "#8b5cf6",
  nutrition: "#f59e0b",
  custom: "#c4841d",
};

// ─── Metrics Management Panel ───
function MetricsManagement({
  clientId,
  configs,
  onRefresh,
}: {
  clientId: string;
  configs: MetricConfig[];
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("");

  // Which healthkit keys are already configured
  const configuredKeys = useMemo(() => {
    const map = new Map<string, MetricConfig>();
    for (const c of configs) {
      if (c.healthkitKey) map.set(c.healthkitKey, c);
    }
    return map;
  }, [configs]);

  async function toggleHealthMetric(key: string, name: string, unit: string, category: string, defaultTarget?: number) {
    setBusy(key);
    try {
      const existing = configuredKeys.get(key);
      if (existing) {
        await updateMetricConfig(existing.id, { isActive: !existing.isActive });
      } else {
        await createMetricConfig({
          clientId,
          name,
          unit,
          color: CATEGORY_COLORS[category] ?? "#c4841d",
          source: "healthkit",
          healthkitKey: key,
          isActive: true,
          category,
          dailyTarget: defaultTarget ?? null,
        });
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle metric:", err);
    } finally {
      setBusy(null);
    }
  }

  async function addCustomMetric() {
    if (!customName.trim()) return;
    setBusy("custom");
    try {
      await createMetricConfig({
        clientId,
        name: customName.trim(),
        unit: customUnit.trim(),
        color: CATEGORY_COLORS.custom,
        source: "manual",
        healthkitKey: null,
        isActive: true,
        category: "custom",
      });
      setCustomName("");
      setCustomUnit("");
      setShowCustomForm(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to add custom metric:", err);
    } finally {
      setBusy(null);
    }
  }

  async function removeCustomMetric(configId: string) {
    setBusy(configId);
    try {
      await deleteMetricConfig(configId);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete metric:", err);
    } finally {
      setBusy(null);
    }
  }

  const customConfigs = configs.filter((c) => c.source === "manual");
  const activeConfigsForTargets = configs.filter((c) => c.isActive);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 size={16} className="text-accent" />
        <h3 className="text-base font-bold">Manage Tracked Metrics</h3>
      </div>

      {/* Apple Health metrics grouped by category */}
      <div className="space-y-4">
        {HEALTH_METRIC_CATEGORIES.map((cat) => {
          const metrics = AVAILABLE_HEALTH_METRICS.filter((m) => m.category === cat.key);
          return (
            <div key={cat.key}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{cat.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {metrics.map((m) => {
                  const existing = configuredKeys.get(m.key);
                  const isActive = existing?.isActive ?? false;
                  const isBusy = busy === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggleHealthMetric(m.key, m.name, m.unit, m.category, m.defaultTarget)}
                      disabled={isBusy}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border ${
                        isActive
                          ? "bg-accent/10 border-accent/30 text-accent font-medium"
                          : "bg-black/[0.02] border-black/5 text-muted hover:bg-black/[0.05]"
                      } ${isBusy ? "opacity-50" : ""}`}
                    >
                      <span className="truncate">{m.name}</span>
                      {m.unit && <span className="text-[10px] opacity-60 shrink-0">{m.unit}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily targets for active metrics */}
      {activeConfigsForTargets.length > 0 && (
        <div className="mt-5 pt-4 border-t border-black/5">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-accent" />
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Daily Targets</p>
          </div>
          <div className="space-y-2">
            {activeConfigsForTargets.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/[0.02] border border-black/5">
                <span className="text-sm flex-1 truncate">{c.name}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="any"
                    defaultValue={c.dailyTarget ?? ""}
                    placeholder="—"
                    onBlur={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      if (val !== c.dailyTarget) {
                        updateMetricConfig(c.id, { dailyTarget: val }).then(onRefresh);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-20 text-sm text-right bg-black/5 border border-black/10 rounded-lg px-2 py-1 focus:outline-none focus:border-accent/50"
                  />
                  {c.unit && <span className="text-[10px] text-muted w-10">{c.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom metrics */}
      <div className="mt-5 pt-4 border-t border-black/5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Custom Metrics</p>
          <button
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {customConfigs.length > 0 && (
          <div className="space-y-1 mb-3">
            {customConfigs.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/[0.02] border border-black/5">
                <span className="text-sm flex-1">{c.name}</span>
                {c.unit && <span className="text-[10px] text-muted">{c.unit}</span>}
                <button
                  onClick={() => removeCustomMetric(c.id)}
                  disabled={busy === c.id}
                  className="text-danger/60 hover:text-danger p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showCustomForm && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted font-medium">Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Waist"
                className="w-full text-sm bg-black/5 border border-black/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-muted font-medium">Unit</label>
              <input
                type="text"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="cm"
                className="w-full text-sm bg-black/5 border border-black/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent/50"
              />
            </div>
            <button
              onClick={addCustomMetric}
              disabled={!customName.trim() || busy === "custom"}
              className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metrics Data Display ───
function MetricsDataDisplay({
  configs,
  entries,
}: {
  configs: MetricConfig[];
  entries: MetricEntry[];
}) {
  const activeConfigs = configs.filter((c) => c.isActive);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState(30);

  // Auto-select first metric
  const effectiveId = activeConfigs.find((c) => c.id === selectedMetricId)
    ? selectedMetricId
    : activeConfigs[0]?.id ?? null;

  const selectedConfig = activeConfigs.find((c) => c.id === effectiveId);

  const chartData = useMemo(() => {
    if (!effectiveId) return [];
    const filtered = filterByPeriod(
      entries.filter((e) => e.metricId === effectiveId),
      periodDays,
    );
    return filtered
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e) => ({ date: e.date.slice(0, 10), value: e.value }));
  }, [entries, effectiveId, periodDays]);

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;
  const prevValue = chartData.length >= 2 ? chartData[chartData.length - 2].value : null;
  const change = latestValue !== null && prevValue !== null ? latestValue - prevValue : null;

  if (activeConfigs.length === 0) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-accent" />
          <h3 className="text-base font-bold">Health Metrics</h3>
        </div>
        <div className="py-6 text-center text-muted text-sm">
          <Activity size={28} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium">No metrics tracked</p>
          <p className="text-xs mt-1">Toggle metrics above to start tracking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-accent" />
        <h3 className="text-base font-bold">Health Metrics</h3>
      </div>

      {/* Metric selector pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {activeConfigs.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedMetricId(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              c.id === effectiveId
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-black/5 bg-black/[0.02] text-muted hover:bg-black/[0.05]"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Time period filter */}
      <div className="mb-4">
        <TimePeriodPicker selected={periodDays} onChange={setPeriodDays} />
      </div>

      {/* Current value + change */}
      {selectedConfig && (
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-muted">{selectedConfig.name}</p>
            <p className="text-2xl font-bold">
              {latestValue !== null ? latestValue.toFixed(selectedConfig.unit === "steps" ? 0 : 1) : "—"}
              {selectedConfig.unit && (
                <span className="text-sm font-normal text-muted ml-1">{selectedConfig.unit}</span>
              )}
            </p>
          </div>
          {change !== null && (
            <div className={`text-xs font-medium ${change > 0 ? "text-success" : change < 0 ? "text-danger" : "text-muted"}`}>
              {change > 0 ? "+" : ""}{change.toFixed(1)} {selectedConfig.unit}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {selectedConfig && (
        <LineChart
          data={chartData}
          color={selectedConfig.color || "#c4841d"}
          height={220}
          targetValue={selectedConfig.dailyTarget}
          valueFormatter={(value) =>
            `${value.toFixed(selectedConfig.unit === "steps" ? 0 : 1)}${selectedConfig.unit ? ` ${selectedConfig.unit}` : ""}`
          }
        />
      )}

      {chartData.length === 0 && selectedConfig && (
        <div className="py-6 text-center text-muted text-sm">
          <p className="text-xs">No data recorded yet for {selectedConfig.name}</p>
        </div>
      )}
    </div>
  );
}

// ─── Activity Type Icons & Colors ───
const ACTIVITY_ICONS: Record<number, { emoji: string; color: string }> = {
  37: { emoji: "🏃", color: "#22c55e" },   // Running
  13: { emoji: "🚴", color: "#f97316" },   // Cycling
  46: { emoji: "🏊", color: "#3b82f6" },   // Swimming
  50: { emoji: "🏋️", color: "#8b5cf6" },   // Traditional Strength
  20: { emoji: "🏋️", color: "#8b5cf6" },   // Functional Strength
  52: { emoji: "🚶", color: "#06b6d4" },   // Walking
  57: { emoji: "🧘", color: "#ec4899" },   // Yoga
  66: { emoji: "🤸", color: "#a855f7" },   // Pilates
  16: { emoji: "⚡", color: "#eab308" },   // Elliptical
  35: { emoji: "🚣", color: "#14b8a6" },   // Rowing
  11: { emoji: "🔄", color: "#eab308" },   // Cross Training
  63: { emoji: "🔥", color: "#ef4444" },   // HIIT
  8:  { emoji: "🥊", color: "#ef4444" },   // Boxing
  65: { emoji: "🥊", color: "#ef4444" },   // Kickboxing
  24: { emoji: "🥾", color: "#22c55e" },   // Hiking
  75: { emoji: "🥏", color: "#f97316" },   // Disc Sports
};
const DEFAULT_ACTIVITY = { emoji: "💪", color: "#6366f1" };

function getActivityMeta(rawType: number) {
  return ACTIVITY_ICONS[rawType] ?? DEFAULT_ACTIVITY;
}

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// HR zone color mapping
const ZONE_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444"];

function ActivitySessionsSection({
  sessions,
  deletingSessionId,
  onDeleteSession,
}: {
  sessions: ActivitySession[];
  deletingSessionId: string | null;
  onDeleteSession: (sessionId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState(30);

  const filtered = useMemo(() => {
    if (periodDays === 0) return sessions;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    return sessions.filter((s) => new Date(s.startDate) >= cutoff);
  }, [sessions, periodDays]);

  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currentTs = new Date(current.startDate).getTime();
      for (let j = i + 1; j < sorted.length; j++) {
        const compare = sorted[j];
        const compareTs = new Date(compare.startDate).getTime();
        if (compareTs - currentTs > 2 * 60 * 1000) break;

        const sameType = current.activityTypeRaw === compare.activityTypeRaw;
        const durationClose = Math.abs(current.durationSeconds - compare.durationSeconds) <= 180;
        const caloriesClose =
          current.caloriesBurned == null ||
          compare.caloriesBurned == null ||
          Math.abs(current.caloriesBurned - compare.caloriesBurned) <= 120;

        if (sameType && durationClose && caloriesClose) {
          ids.add(current.id);
          ids.add(compare.id);
        }
      }
    }
    return ids;
  }, [filtered]);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-danger" />
          <h3 className="text-base font-bold">Activity Sessions</h3>
          <span className="text-xs text-muted">({filtered.length})</span>
        </div>
        <TimePeriodPicker selected={periodDays} onChange={setPeriodDays} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No activity sessions in this period</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const meta = getActivityMeta(s.activityTypeRaw);
            const isOpen = expandedId === s.id;
            const durationMin = Math.round(s.durationSeconds / 60);
            const isPossibleDuplicate = duplicateIds.has(s.id);
            return (
              <div key={s.id} className="rounded-xl border border-black/5 overflow-hidden">
                {/* Row */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors text-left"
                >
                  <span className="text-xl">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-2">
                      <span className="truncate">{s.activityType}</span>
                      {isPossibleDuplicate && (
                        <span className="shrink-0 rounded-full bg-warning/15 text-warning text-[10px] px-2 py-0.5 font-medium">
                          Possible duplicate
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted">{formatActivityDate(s.startDate)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted shrink-0">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {formatDuration(s.durationSeconds)}
                    </span>
                    {s.caloriesBurned != null && (
                      <span className="flex items-center gap-1">
                        <Flame size={12} /> {Math.round(s.caloriesBurned)}
                      </span>
                    )}
                    {s.avgHeartRate != null && (
                      <span className="flex items-center gap-1">
                        <Heart size={12} /> {Math.round(s.avgHeartRate)}
                      </span>
                    )}
                    {s.effortRating != null && (
                      <span className="flex items-center gap-1 font-medium" style={{ color: meta.color }}>
                        <Zap size={12} /> {s.effortRating}/10
                      </span>
                    )}
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-black/5 space-y-4">
                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-[10px] text-muted uppercase font-medium">Duration</p>
                        <p className="font-semibold">{durationMin} min</p>
                      </div>
                      {s.caloriesBurned != null && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-medium">Calories</p>
                          <p className="font-semibold">{Math.round(s.caloriesBurned)} kcal</p>
                        </div>
                      )}
                      {s.distanceMeters != null && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-medium">Distance</p>
                          <p className="font-semibold">{(s.distanceMeters / 1000).toFixed(2)} km</p>
                        </div>
                      )}
                      {s.distanceMeters != null && s.durationSeconds > 0 && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-medium">Avg Pace</p>
                          <p className="font-semibold">
                            {(() => {
                              const km = s.distanceMeters! / 1000;
                              if (km <= 0) return "—";
                              const paceMin = (s.durationSeconds / 60) / km;
                              const m = Math.floor(paceMin);
                              const sec = Math.round((paceMin - m) * 60);
                              return `${m}:${String(sec).padStart(2, "0")} /km`;
                            })()}
                          </p>
                        </div>
                      )}
                      {s.avgHeartRate != null && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-medium">Avg HR</p>
                          <p className="font-semibold">{Math.round(s.avgHeartRate)} bpm</p>
                        </div>
                      )}
                      {s.maxHeartRate != null && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-medium">Max HR</p>
                          <p className="font-semibold">{Math.round(s.maxHeartRate)} bpm</p>
                        </div>
                      )}
                      {s.effortRating != null && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-medium">Effort</p>
                          <p className="font-semibold">{s.effortRating}/10</p>
                        </div>
                      )}
                      {s.srpe != null && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-medium">sRPE</p>
                          <p className="font-semibold">{Math.round(s.srpe)}</p>
                        </div>
                      )}
                    </div>

                    {/* HR Chart */}
                    {s.hrSamples && s.hrSamples.length >= 2 && (
                      <div>
                        <p className="text-xs text-muted mb-1 font-medium flex items-center gap-1">
                          <Heart size={11} /> Heart Rate
                          {s.minHeartRate != null && s.maxHeartRate != null && (
                            <span className="ml-auto text-[10px] font-normal">
                              {Math.round(s.minHeartRate)} – {Math.round(s.maxHeartRate)} BPM
                            </span>
                          )}
                        </p>
                        <LineChart
                          data={s.hrSamples.map((h) => ({
                            date: `${Math.round(h.t / 60)}m`,
                            value: h.bpm,
                          }))}
                          color={meta.color}
                          height={170}
                          valueFormatter={(value) => `${Math.round(value)} bpm`}
                        />
                      </div>
                    )}

                    {/* HR Zones */}
                    {s.hrZoneSeconds && (
                      <HRZoneBar zones={s.hrZoneSeconds} />
                    )}

                    {/* Source */}
                    {s.sourceName && (
                      <p className="text-[10px] text-muted flex items-center gap-1">
                        <Heart size={10} className="text-danger" />
                        Synced from Apple Health · {s.sourceName}
                      </p>
                    )}

                    <div className="pt-2 border-t border-black/5">
                      <button
                        onClick={() => onDeleteSession(s.id)}
                        disabled={deletingSessionId === s.id}
                        className="inline-flex items-center gap-1.5 text-xs text-danger hover:opacity-80 disabled:opacity-60"
                      >
                        <Trash2 size={13} />
                        {deletingSessionId === s.id ? "Deleting..." : "Delete session"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HRZoneBar({ zones }: { zones: Record<string, number> }) {
  const zoneKeys = ["zone1", "zone2", "zone3", "zone4", "zone5"];
  const zoneLabels = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];
  const totalSeconds = zoneKeys.reduce((sum, k) => sum + (zones[k] ?? 0), 0);
  if (totalSeconds <= 0) return null;

  return (
    <div>
      <p className="text-xs text-muted mb-2 font-medium">Heart Rate Zones</p>
      {/* Stacked bar */}
      <div className="flex h-4 rounded-lg overflow-hidden gap-[1px]">
        {zoneKeys.map((k, i) => {
          const secs = zones[k] ?? 0;
          const pct = (secs / totalSeconds) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={k}
              className="h-full"
              style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS[i], minWidth: 2 }}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {zoneKeys.map((k, i) => {
          const secs = zones[k] ?? 0;
          if (secs <= 0) return null;
          const mins = Math.floor(secs / 60);
          const s = Math.round(secs % 60);
          const minBpm = zones[`${k}_min_bpm`];
          const maxBpm = zones[`${k}_max_bpm`];
          return (
            <div key={k} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ZONE_COLORS[i] }} />
              <span className="font-medium">{zoneLabels[i]}</span>
              <span className="text-muted">{mins}:{String(s).padStart(2, "0")}</span>
              {minBpm != null && maxBpm != null && (
                <span className="text-muted text-[10px]">{Math.round(minBpm)}-{Math.round(maxBpm)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly sRPE ───

function WeeklySrpeSection({ sessions }: { sessions: ActivitySession[] }) {
  const [periodDays, setPeriodDays] = useState(90);

  const weeklyData = useMemo(() => {
    const grouped = new Map<string, { total: number; count: number }>();
    for (const s of sessions) {
      if (s.srpe == null) continue;
      const monday = getMonday(new Date(s.startDate));
      const existing = grouped.get(monday) ?? { total: 0, count: 0 };
      grouped.set(monday, { total: existing.total + s.srpe, count: existing.count + 1 });
    }

    let entries = [...grouped.entries()]
      .map(([monday, { total, count }]) => ({ monday, totalSrpe: total, sessionCount: count }))
      .sort((a, b) => a.monday.localeCompare(b.monday));

    // Apply time period filter
    if (periodDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - periodDays);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      entries = entries.filter((e) => e.monday >= cutoffStr);
    }

    return entries;
  }, [sessions, periodDays]);

  // Current week total
  const thisWeekMonday = getMonday(new Date());
  const thisWeekSrpe = weeklyData.find((w) => w.monday === thisWeekMonday)?.totalSrpe ?? 0;

  // 4-week average
  const fourWeekAvg = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recent = weeklyData.filter((w) => w.monday >= cutoffStr);
    if (recent.length === 0) return null;
    return recent.reduce((sum, w) => sum + w.totalSrpe, 0) / recent.length;
  }, [weeklyData]);

  if (weeklyData.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-warning" />
          <h3 className="text-base font-bold">Weekly sRPE</h3>
        </div>
        <TimePeriodPicker selected={periodDays} onChange={setPeriodDays} />
      </div>

      {/* Summary cards */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 rounded-xl bg-black/[0.03] p-3 text-center">
          <p className="text-[10px] text-muted uppercase font-medium">This Week</p>
          <p className="text-xl font-bold">{Math.round(thisWeekSrpe)}</p>
        </div>
        <div className="flex-1 rounded-xl bg-black/[0.03] p-3 text-center">
          <p className="text-[10px] text-muted uppercase font-medium">4-Week Avg</p>
          <p className="text-xl font-bold">{fourWeekAvg != null ? Math.round(fourWeekAvg) : "—"}</p>
        </div>
      </div>

      {/* Chart */}
      {weeklyData.length >= 2 && (
        <div className="mb-4">
          <LineChart
            data={weeklyData.map((w) => ({ date: w.monday, value: w.totalSrpe }))}
            color="#eab308"
            height={200}
            valueFormatter={(value) => `${Math.round(value)} sRPE`}
          />
        </div>
      )}

      {/* Weekly history */}
      <div className="space-y-1">
        {[...weeklyData].reverse().map((w) => {
          const mondayDate = new Date(w.monday + "T00:00:00");
          const sundayDate = new Date(mondayDate);
          sundayDate.setDate(sundayDate.getDate() + 6);
          const weekLabel = `${mondayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sundayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

          return (
            <div key={w.monday} className="flex items-center justify-between px-1 py-2 text-sm">
              <span className="text-muted text-xs">{weekLabel}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{w.sessionCount} session{w.sessionCount === 1 ? "" : "s"}</span>
                <span className="font-semibold text-warning">{Math.round(w.totalSrpe)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProgressTab({ clientId }: { clientId: string }) {
  // Workout sessions from Supabase
  const [sessions, setSessions] = useState<{ id: string; templateName: string; sectionName: string; rating: number; note: string; completedAt: string }[]>([]);

  // Exercise performance derived from workout logs
  const [allLogs, setAllLogs] = useState<WorkoutLogEntry[]>([]);

  // Task history
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  // Activity sessions from HealthKit
  const [activitySessions, setActivitySessions] = useState<ActivitySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);

  // Metrics
  const [metricConfigs, setMetricConfigs] = useState<MetricConfig[]>([]);
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([]);
  const [showMetricsMgmt, setShowMetricsMgmt] = useState(false);

  const loadMetrics = useCallback(async () => {
    try {
      const [configs, entries] = await Promise.all([
        fetchMetricConfigs(clientId),
        fetchMetricEntries(clientId),
      ]);
      setMetricConfigs(configs);
      setMetricEntries(entries);
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
    }
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [logs, taskRows, activities] = await Promise.all([
          fetchWorkoutLogs(clientId),
          fetchClientTasks(clientId),
          fetchActivitySessions(clientId),
        ]);
        if (!cancelled) {
          setAllLogs(logs);
          setSessions(logs.map((l) => ({
            id: l.id,
            templateName: l.workoutName,
            sectionName: "",
            rating: l.rating ?? 0,
            note: l.notes ?? "",
            completedAt: l.date,
          })));
          setAllTasks((taskRows ?? []).map(fromDbTask));
          setActivitySessions(activities);
        }
      } catch (err) {
        console.error("Failed to fetch progress data:", err);
      }
    }
    load();
    loadMetrics();
    return () => { cancelled = true; };
  }, [clientId, loadMetrics]);

  // Derive exercise performance from real workout logs
  const exercisePerformance = useMemo(() => {
    const byExercise = new Map<string, { date: string; weight: number; reps: number; estimatedOneRM: number; totalVolume: number }[]>();
    for (const log of allLogs) {
      for (const ex of log.exerciseLogs) {
        const completedSetLogs = ex.setLogs.filter((s) => s.completed);
        const hasLoadData = completedSetLogs.some((s) => s.weight > 0 || s.reps > 0);
        if (!hasLoadData) continue;

        if (!byExercise.has(ex.exerciseName)) {
          byExercise.set(ex.exerciseName, []);
        }
        let bestWeight = 0;
        let bestReps = 0;
        const totalVol = completedSetLogs.reduce((sum: number, s: { weight: number; reps: number }) => {
          if (s.weight > bestWeight) {
            bestWeight = s.weight;
            bestReps = s.reps;
          }
          return sum + s.weight * s.reps;
        }, 0);

        if (bestWeight <= 0 && totalVol <= 0) continue;

        // Epley formula for estimated 1RM
        const e1rm = bestReps > 1 ? bestWeight * (1 + bestReps / 30) : bestWeight;
        byExercise.get(ex.exerciseName)!.push({
          date: log.date,
          weight: bestWeight,
          reps: bestReps,
          estimatedOneRM: e1rm,
          totalVolume: totalVol,
        });
      }
    }
    return byExercise;
  }, [allLogs]);

  const exerciseNames = useMemo(() => [...exercisePerformance.keys()], [exercisePerformance]);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [perfPeriodDays, setPerfPeriodDays] = useState(90);

  // Derive effective selection: user pick if valid, otherwise first available
  const effectiveExercise = exerciseNames.includes(selectedExercise)
    ? selectedExercise
    : exerciseNames[0] ?? "";

  const exerciseData = useMemo(
    () =>
      filterByPeriod(
        (exercisePerformance.get(effectiveExercise) ?? [])
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        perfPeriodDays,
      ),
    [exercisePerformance, effectiveExercise, perfPeriodDays]
  );

  // Group tasks by week (Monday date string) — only client-owned tasks with due dates
  const tasksByWeek = useMemo(() => {
    const clientTasks = allTasks.filter((t) => t.owner === "client" && t.dueDate);
    const grouped = new Map<string, Task[]>();
    for (const t of clientTasks) {
      const monday = getMonday(new Date(t.dueDate! + "T00:00:00"));
      if (!grouped.has(monday)) grouped.set(monday, []);
      grouped.get(monday)!.push(t);
    }
    // Sort weeks descending (most recent first)
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [allTasks]);

  const selectedSessionLog = useMemo(
    () => allLogs.find((log) => log.id === selectedSessionId) ?? null,
    [allLogs, selectedSessionId],
  );

  const handleDeleteActivity = useCallback(async (sessionId: string) => {
    const confirmed = window.confirm("Delete this activity session for the client?");
    if (!confirmed) return;
    setDeletingActivityId(sessionId);
    try {
      await deleteActivitySession(sessionId);
      setActivitySessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error("Failed to delete activity session:", err);
      window.alert("Could not delete this session. Please try again.");
    } finally {
      setDeletingActivityId(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* ─── Health Metrics Data ─── */}
      <MetricsDataDisplay configs={metricConfigs} entries={metricEntries} />

      {/* ─── Manage Tracked Metrics (collapsible) ─── */}
      <div>
        <button
          onClick={() => setShowMetricsMgmt(!showMetricsMgmt)}
          className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors mb-2"
        >
          <Settings2 size={13} />
          <span>{showMetricsMgmt ? "Hide" : "Manage"} Tracked Metrics</span>
          {showMetricsMgmt ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {showMetricsMgmt && (
          <MetricsManagement clientId={clientId} configs={metricConfigs} onRefresh={loadMetrics} />
        )}
      </div>

      {/* ─── Exercise Performance ─── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-warning" />
            <h3 className="text-base font-bold">Exercise Performance</h3>
          </div>
          {exerciseNames.length > 0 && (
            <select
              value={effectiveExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="text-sm bg-black/5 border border-black/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent/50"
            >
              {exerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Time period filter */}
        <div className="mb-4">
          <TimePeriodPicker selected={perfPeriodDays} onChange={setPerfPeriodDays} />
        </div>

        {exerciseData.length >= 2 ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted mb-1 font-medium">Estimated 1RM</p>
              <LineChart
                data={exerciseData.map((e) => ({ date: e.date, value: e.estimatedOneRM }))}
                color="#c4841d"
                height={200}
                valueFormatter={(value) => `${value.toFixed(1)} kg`}
              />
            </div>
            <div>
              <p className="text-xs text-muted mb-1 font-medium">Total Volume (sets × reps × weight)</p>
              <LineChart
                data={exerciseData.map((e) => ({ date: e.date, value: e.totalVolume }))}
                color="#2d8a4e"
                height={200}
                valueFormatter={(value) => `${Math.round(value).toLocaleString()} kg`}
              />
            </div>
            <div className="flex items-center gap-6 pt-3 border-t border-black/5 text-xs text-muted">
              <span>
                Best Set: <strong className="text-foreground">{exerciseData[exerciseData.length - 1].weight} kg × {exerciseData[exerciseData.length - 1].reps}</strong>
              </span>
              <span>
                Est. 1RM: <strong className="text-foreground">{exerciseData[exerciseData.length - 1].estimatedOneRM.toFixed(1)} kg</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-muted text-sm">
            <BarChart3 size={28} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">Not enough data</p>
            <p className="text-xs mt-1">Performance charts will appear once the client logs workouts</p>
          </div>
        )}
      </div>

      {/* ─── Session History ─── */}
      <div className="glass-card p-5">
        <h3 className="text-base font-bold mb-4">Recent Workout Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No sessions recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5">
                  <th className="text-left py-2 pr-4 text-xs text-muted font-semibold">Template</th>
                  <th className="text-left py-2 pr-4 text-xs text-muted font-semibold">Section</th>
                  <th className="text-left py-2 pr-4 text-xs text-muted font-semibold">Rating</th>
                  <th className="text-left py-2 pr-4 text-xs text-muted font-semibold">Note</th>
                  <th className="text-left py-2 text-xs text-muted font-semibold">Completed</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className="border-b border-black/5 last:border-b-0 hover:bg-black/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 pr-4">{s.templateName}</td>
                    <td className="py-2.5 pr-4 text-muted">{s.sectionName}</td>
                    <td className="py-2.5 pr-4">
                      <StarRating rating={s.rating} />
                    </td>
                    <td className="py-2.5 pr-4 text-muted italic max-w-[300px] truncate">
                      {s.note || "—"}
                    </td>
                    <td className="py-2.5 text-muted whitespace-nowrap">{formatDate(s.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Weekly sRPE ─── */}
      <WeeklySrpeSection sessions={activitySessions} />

      {/* ─── Activity Sessions ─── */}
      {activitySessions.length > 0 && (
        <ActivitySessionsSection
          sessions={activitySessions}
          deletingSessionId={deletingActivityId}
          onDeleteSession={handleDeleteActivity}
        />
      )}

      {/* ─── Task History ─── */}
      <TaskHistorySection tasksByWeek={tasksByWeek} />

      {selectedSessionLog && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] overflow-y-auto p-4 md:p-8"
          onClick={() => setSelectedSessionId(null)}
        >
          <div className="max-w-5xl mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="glass-card p-5">
              <WorkoutLogDetail
                entry={selectedSessionLog}
                allLogs={allLogs}
                onBack={() => setSelectedSessionId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
