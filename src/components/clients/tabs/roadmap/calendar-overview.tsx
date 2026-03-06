"use client";

import { getMonthSpans, getCurrentWeek } from "./roadmap-utils";

interface CalendarOverviewProps {
  year: number;
}

export function CalendarOverview({ year }: CalendarOverviewProps) {
  const months = getMonthSpans(year);
  const currentWeek = getCurrentWeek();
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <>
      {/* Month row */}
      <div className="sticky left-0 z-10 bg-surface px-3 flex items-center text-[10px] text-muted font-medium uppercase tracking-wider border-b border-black/5">
        MONTH
      </div>
      {months.map((m) => (
        <div
          key={m.name}
          className="text-center text-[10px] text-muted font-medium uppercase tracking-wider border-b border-black/5 flex items-center justify-center py-2"
          style={{ gridColumn: `span ${m.span}` }}
        >
          {m.name}
        </div>
      ))}

      {/* Week number row */}
      <div className="sticky left-0 z-10 bg-surface px-3 flex items-center text-[10px] text-muted font-semibold border-b border-black/10">
        WEEK
      </div>
      {weeks.map((w) => (
        <div
          key={w}
          className={`text-center text-[10px] font-medium border-b border-black/10 flex items-center justify-center py-1.5 ${
            w === currentWeek
              ? "bg-accent/15 text-accent font-bold"
              : "text-muted"
          }`}
        >
          {w}
        </div>
      ))}
    </>
  );
}
