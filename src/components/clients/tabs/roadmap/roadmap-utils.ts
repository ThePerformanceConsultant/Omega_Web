import { RoadmapPhaseBlock } from "@/lib/types";

// ==========================================
// Roadmap Utility Functions
// ==========================================

export interface DerivedPhaseBlock {
  phaseId: string;
  name: string;
  color: string;
  startWeek: number;
  endWeek: number;
}

/**
 * Derives contiguous phase blocks from week→phaseId assignments.
 * Used by distribution chart and overview roadmap section.
 */
export function derivePhaseBlocks(
  phases: RoadmapPhaseBlock[],
  assignments: Record<number, string>
): DerivedPhaseBlock[] {
  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const blocks: DerivedPhaseBlock[] = [];
  let currentPhaseId: string | null = null;
  let currentStart = 1;

  for (let w = 1; w <= 52; w++) {
    const pid: string | undefined = assignments[w];
    if (pid && pid === currentPhaseId) {
      // Continue current block
      continue;
    }
    // Close previous block
    if (currentPhaseId) {
      const phase = phaseMap.get(currentPhaseId);
      if (phase) {
        blocks.push({
          phaseId: currentPhaseId,
          name: phase.name,
          color: phase.color,
          startWeek: currentStart,
          endWeek: w - 1,
        });
      }
    }
    // Start new block or set null
    if (pid) {
      currentPhaseId = pid;
      currentStart = w;
    } else {
      currentPhaseId = null;
    }
  }
  // Close final block
  if (currentPhaseId) {
    const phase = phaseMap.get(currentPhaseId);
    if (phase) {
      blocks.push({
        phaseId: currentPhaseId,
        name: phase.name,
        color: phase.color,
        startWeek: currentStart,
        endWeek: 52,
      });
    }
  }

  return blocks;
}

export interface MonthSpan {
  name: string;
  startWeek: number;
  span: number;
}

/**
 * Returns month column spans for the calendar header.
 * Calculates which ISO weeks each month occupies.
 */
export function getMonthSpans(_year: number): MonthSpan[] {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const spans: MonthSpan[] = [];

  // For simplicity, distribute weeks roughly across months
  // Jan=5wk, Feb=4wk, Mar=4wk, Apr=5wk, May=4wk, Jun=4wk,
  // Jul=5wk, Aug=4wk, Sep=5wk, Oct=4wk, Nov=4wk, Dec=4wk = 52
  const weekCounts = [5, 4, 4, 5, 4, 4, 5, 4, 5, 4, 4, 4];
  let currentWeek = 1;

  for (let i = 0; i < 12; i++) {
    spans.push({
      name: names[i],
      startWeek: currentWeek,
      span: weekCounts[i],
    });
    currentWeek += weekCounts[i];
  }

  return spans;
}

/**
 * Returns approximate date string for a given week number.
 */
export function weekToDate(year: number, week: number): string {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);
  const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[targetDate.getMonth()]} ${targetDate.getDate()}`;
}

/**
 * Get current week of year
 */
export function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Preset pastel color palette for phases and events
 */
export const ROADMAP_COLORS = [
  "#6dba8a", "#d4a843", "#e0a86e", "#b07ce8", "#a0a5ad",
  "#5ba3d9", "#e87c7c", "#5cc7a0", "#a78bfa", "#dbb85c",
  "#5cc0d4", "#e07aab",
];
