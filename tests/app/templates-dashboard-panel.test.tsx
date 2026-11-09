import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildMonthlyTimeline, DashboardPanel, type DashboardStats } from "../../app/templates/DashboardPanel";
import { I18nProvider } from "../../app/lib/i18n";

const point = (label: string, value = 10) => ({ label, totalNm: value, sailNm: value, motorNm: 0, overallMinutes: value * 60, motionMinutes: value * 60, motorMinutes: 0 });

describe("dashboard chart baseline", () => {
  it("keeps empty data empty", () => {
    expect(buildMonthlyTimeline([])).toEqual([]);
  });
  it("preserves undated drafts without throwing", () => {
    expect(buildMonthlyTimeline([point("")])).toEqual([point("")]);
  });
  it("adds the previous calendar month, including year rollover", () => {
    expect(buildMonthlyTimeline([point("2026-01")])).toEqual([point("2025-12", 0), point("2026-01")]);
  });
  it("aggregates and sorts real months without filling existing gaps or changing totals", () => {
    const input = [point("2026-05"), point("2026-03"), point("2026-03")];
    const result = buildMonthlyTimeline(input);
    expect(result).toEqual([point("2026-02", 0), point("2026-03", 20), point("2026-05")]);
    expect(result.reduce((sum, item) => sum + item.totalNm, 0)).toBe(30);
    expect(input).toHaveLength(3);
  });
  it("positions both charts' first real bars away from the axis and starts cumulative lines at zero", () => {
    const stats: DashboardStats = { totalNm: 10, sailNm: 10, motorNm: 0, durationMinutes: 600, motionDurationMinutes: 600, motorHours: 0, sailingDays: 1, daysAtSea: 1, sheets: 1, boats: 1, timeline: [point("2026-01")], boatDistribution: [] };
    const markup = renderToStaticMarkup(<I18nProvider><DashboardPanel stats={stats} /></I18nProvider>);
    expect(markup.match(/2025-12/g)).toHaveLength(2);
    expect(markup).toContain('class="chart-bar-sail" x="611"');
    expect(markup).toContain('class="chart-bar-overall" x="606"');
    expect(markup).toContain('class="chart-line-total" points="40,230 620,30"');
    expect(markup).toContain('class="chart-line-motion" points="40,230 620,30"');
  });
});
