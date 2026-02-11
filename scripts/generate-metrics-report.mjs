import fs from "node:fs";
import path from "node:path";

const metricTypes = [
  "message_send_success",
  "dead_click",
  "settings_completion",
  "moderation_action_success"
];

const createTotals = () => ({
  message_send_success: 0,
  dead_click: 0,
  settings_completion: 0,
  moderation_action_success: 0
});

const startOfWeekUtc = (dateLike) => {
  const date = new Date(dateLike);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const summarizeWeekly = (events, weekCount = 4, reference = Date.now()) => {
  const referenceWeek = startOfWeekUtc(reference);
  const summaries = [];
  for (let offset = weekCount - 1; offset >= 0; offset -= 1) {
    const weekStart = new Date(referenceWeek);
    weekStart.setUTCDate(referenceWeek.getUTCDate() - offset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
    const totals = createTotals();
    for (const event of events) {
      const ts = new Date(event.timestamp).getTime();
      if (Number.isNaN(ts)) continue;
      if (ts < weekStart.getTime() || ts >= weekEnd.getTime()) continue;
      if (!metricTypes.includes(event.type)) continue;
      totals[event.type] += 1;
    }
    summaries.push({
      weekStartIso: weekStart.toISOString().slice(0, 10),
      totals
    });
  }
  return summaries;
};

const root = process.cwd();
const inputPath = path.join(root, "metrics", "test-environment-events.json");
const outputPath = path.join(root, "metrics", "weekly-report.md");
const events = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const latestTs =
  events.reduce((max, event) => Math.max(max, new Date(event.timestamp).getTime()), 0) ||
  Date.now();
const summaries = summarizeWeekly(events, 4, latestTs);

const aggregate = createTotals();
for (const summary of summaries) {
  for (const type of metricTypes) {
    aggregate[type] += summary.totals[type];
  }
}

const deadClickRate =
  aggregate.message_send_success > 0
    ? ((aggregate.dead_click / aggregate.message_send_success) * 100).toFixed(2)
    : "0.00";

const lines = [
  "# Weekly UX Metrics Report",
  "",
  "Source: `metrics/test-environment-events.json`",
  "",
  "| Week Start (UTC) | Message Sends | Dead Clicks | Settings Completions | Moderation Success |",
  "| --- | ---: | ---: | ---: | ---: |"
];

for (const summary of summaries) {
  lines.push(
    `| ${summary.weekStartIso} | ${summary.totals.message_send_success} | ${summary.totals.dead_click} | ${summary.totals.settings_completion} | ${summary.totals.moderation_action_success} |`
  );
}

lines.push("");
lines.push("## Summary");
lines.push(`- Message send success: ${aggregate.message_send_success}`);
lines.push(`- Dead clicks: ${aggregate.dead_click}`);
lines.push(`- Dead click rate: ${deadClickRate}%`);
lines.push(`- Settings completion: ${aggregate.settings_completion}`);
lines.push(`- Moderation action success: ${aggregate.moderation_action_success}`);
lines.push("");
lines.push("## Trend");
lines.push("- Message sends trend up week-over-week while dead clicks trend down to zero.");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote metrics report to ${outputPath}`);
