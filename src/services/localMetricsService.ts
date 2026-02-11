export type LocalMetricEventType =
  | "message_send_success"
  | "dead_click"
  | "settings_completion"
  | "moderation_action_success";

export interface LocalMetricEvent {
  id: string;
  type: LocalMetricEventType;
  timestamp: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface WeeklyMetricSummary {
  weekStartIso: string;
  totals: Record<LocalMetricEventType, number>;
}

const LOCAL_METRICS_KEY = "fray.local.metrics.events";
const METRIC_EVENT_LIMIT = 5000;

const uid = () => `metric_${Math.random().toString(36).slice(2, 10)}`;

const metricTypes: LocalMetricEventType[] = [
  "message_send_success",
  "dead_click",
  "settings_completion",
  "moderation_action_success"
];

const createEmptyTotals = (): Record<LocalMetricEventType, number> => ({
  message_send_success: 0,
  dead_click: 0,
  settings_completion: 0,
  moderation_action_success: 0
});

const parseMetricType = (value: unknown): LocalMetricEventType | null => {
  if (
    value === "message_send_success" ||
    value === "dead_click" ||
    value === "settings_completion" ||
    value === "moderation_action_success"
  ) {
    return value;
  }
  return null;
};

const normalizeEvent = (value: unknown): LocalMetricEvent | null => {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const type = parseMetricType(input.type);
  if (!type) return null;
  return {
    id: typeof input.id === "string" ? input.id : uid(),
    type,
    timestamp: typeof input.timestamp === "number" ? input.timestamp : Date.now(),
    metadata:
      input.metadata && typeof input.metadata === "object"
        ? (input.metadata as Record<string, string | number | boolean>)
        : undefined
  };
};

export const loadLocalMetricEvents = () => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LOCAL_METRICS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeEvent)
      .filter((event): event is LocalMetricEvent => Boolean(event))
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-METRIC_EVENT_LIMIT);
  } catch {
    return [];
  }
};

export const saveLocalMetricEvents = (events: LocalMetricEvent[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_METRICS_KEY, JSON.stringify(events.slice(-METRIC_EVENT_LIMIT)));
};

export const trackLocalMetricEvent = (
  type: LocalMetricEventType,
  metadata?: Record<string, string | number | boolean>
) => {
  const existing = loadLocalMetricEvents();
  const next: LocalMetricEvent = {
    id: uid(),
    type,
    timestamp: Date.now(),
    metadata
  };
  saveLocalMetricEvents([...existing, next]);
  return next;
};

const startOfWeekUtc = (timestamp: number) => {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const summarizeWeeklyMetrics = (
  events: LocalMetricEvent[],
  numberOfWeeks = 4,
  referenceTimestamp = Date.now()
): WeeklyMetricSummary[] => {
  const summaries: WeeklyMetricSummary[] = [];
  const thisWeekStart = startOfWeekUtc(referenceTimestamp);

  for (let offset = numberOfWeeks - 1; offset >= 0; offset -= 1) {
    const weekStart = new Date(thisWeekStart);
    weekStart.setUTCDate(thisWeekStart.getUTCDate() - offset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
    const totals = createEmptyTotals();

    events.forEach((event) => {
      if (event.timestamp < weekStart.getTime()) return;
      if (event.timestamp >= weekEnd.getTime()) return;
      totals[event.type] += 1;
    });

    summaries.push({
      weekStartIso: weekStart.toISOString().slice(0, 10),
      totals
    });
  }

  return summaries;
};

export const createWeeklyMetricsMarkdownReport = (events: LocalMetricEvent[]) => {
  const summaries = summarizeWeeklyMetrics(events, 4);
  const lines = [
    "# Weekly UX Metrics Report",
    "",
    "| Week Start (UTC) | Message Sends | Dead Clicks | Settings Completions | Moderation Success |",
    "| --- | ---: | ---: | ---: | ---: |"
  ];

  summaries.forEach((summary) => {
    lines.push(
      `| ${summary.weekStartIso} | ${summary.totals.message_send_success} | ${summary.totals.dead_click} | ${summary.totals.settings_completion} | ${summary.totals.moderation_action_success} |`
    );
  });

  const aggregateTotals = createEmptyTotals();
  summaries.forEach((summary) => {
    metricTypes.forEach((type) => {
      aggregateTotals[type] += summary.totals[type];
    });
  });
  const deadClickRate =
    aggregateTotals.message_send_success > 0
      ? ((aggregateTotals.dead_click / aggregateTotals.message_send_success) * 100).toFixed(2)
      : "0.00";

  lines.push("");
  lines.push(`Total message sends: ${aggregateTotals.message_send_success}`);
  lines.push(`Total dead clicks: ${aggregateTotals.dead_click}`);
  lines.push(`Dead click rate: ${deadClickRate}%`);
  lines.push(`Settings completions: ${aggregateTotals.settings_completion}`);
  lines.push(`Moderation successes: ${aggregateTotals.moderation_action_success}`);

  return lines.join("\n");
};
