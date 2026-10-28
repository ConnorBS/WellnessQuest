"use client";

import { formatViewedDate, formatViewedDay, useViewedDay } from "@/lib/day-context";

export function DayHeader() {
  const { viewedDay, today, isToday, goToPrev, goToNext, goToToday } = useViewedDay();
  const label = formatViewedDay(viewedDay, today);
  const dateLabel = formatViewedDate(viewedDay, today);

  const arrowBtn: React.CSSProperties = {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    color: "var(--wq-text-2)",
    border: "1px solid var(--wq-border)",
    borderRadius: 8,
    fontSize: 18,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        margin: "6px 0 12px",
      }}
    >
      <button type="button" onClick={goToPrev} aria-label="Previous day" style={arrowBtn}>
        ←
      </button>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }} data-testid="day-header-label">
          {label}
        </span>
        <span
          style={{ fontSize: 12, color: "var(--wq-muted)", marginTop: 1 }}
          data-testid="day-header-date"
        >
          {dateLabel}
        </span>
        {!isToday && (
          <button
            type="button"
            onClick={goToToday}
            style={{ color: "var(--wq-accent)", fontSize: 12, marginTop: 2 }}
          >
            Jump to today
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={goToNext}
        disabled={isToday}
        aria-label="Next day"
        style={{ ...arrowBtn, opacity: isToday ? 0.4 : 1 }}
      >
        →
      </button>
    </div>
  );
}
