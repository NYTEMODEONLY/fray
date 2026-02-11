import { describe, expect, it } from "vitest";
import {
  createWeeklyMetricsMarkdownReport,
  summarizeWeeklyMetrics,
  type LocalMetricEvent
} from "../localMetricsService";

const events: LocalMetricEvent[] = [
  { id: "m1", type: "message_send_success", timestamp: Date.parse("2026-01-19T12:00:00Z") },
  { id: "m2", type: "message_send_success", timestamp: Date.parse("2026-01-20T12:00:00Z") },
  { id: "d1", type: "dead_click", timestamp: Date.parse("2026-01-21T12:00:00Z") },
  { id: "s1", type: "settings_completion", timestamp: Date.parse("2026-01-23T12:00:00Z") },
  { id: "m3", type: "message_send_success", timestamp: Date.parse("2026-01-28T12:00:00Z") },
  { id: "mod1", type: "moderation_action_success", timestamp: Date.parse("2026-02-04T12:00:00Z") }
];

describe("Phase 6 local metrics service", () => {
  it("summarizes metrics by week", () => {
    const summaries = summarizeWeeklyMetrics(events, 4, Date.parse("2026-02-10T10:00:00Z"));
    expect(summaries).toHaveLength(4);
    const aggregate = summaries.reduce(
      (accumulator, item) => accumulator + item.totals.message_send_success,
      0
    );
    expect(aggregate).toBe(3);
  });

  it("generates markdown weekly reports", () => {
    const markdown = createWeeklyMetricsMarkdownReport(events);
    expect(markdown).toContain("# Weekly UX Metrics Report");
    expect(markdown).toContain("Dead click rate");
    expect(markdown).toContain("| Week Start (UTC) |");
  });
});
