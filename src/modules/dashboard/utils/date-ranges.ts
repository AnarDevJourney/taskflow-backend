/**
 * Every boundary the dashboard pipelines compare against, computed once per
 * request and passed into the pipeline builders as plain `Date`s.
 *
 * Two deliberate choices:
 *  - "week" is a rolling 7-day window, not a calendar week. There is no
 *    per-user week-start preference in the app, so a rolling window is the
 *    only definition that reads the same for every user.
 *  - "month" is the calendar month in the API process's timezone, because
 *    "completed this month" is the one KPI users read against a calendar.
 */
export interface DashboardRanges {
  /** request time — the reference point every other boundary is derived from */
  now: Date;
  /** 00:00 today */
  todayStart: Date;
  /** 23:59:59.999 today */
  todayEnd: Date;
  /** now − 7d — start of the current rolling week */
  weekStart: Date;
  /** now − 14d — start of the preceding rolling week */
  prevWeekStart: Date;
  /** 00:00 on the 1st of the current calendar month */
  monthStart: Date;
  /** 00:00 on the 1st of the preceding calendar month */
  prevMonthStart: Date;
  /** todayStart + 7d — how far ahead "upcoming deadlines" looks */
  deadlineHorizon: Date;
  /** 00:00 six days ago — the start of the productivity-trend window */
  trendStart: Date;
  /**
   * The trend window's seven calendar days as `YYYY-MM-DD`, oldest first.
   *
   * Precomputed here (rather than derived from whatever the aggregation
   * happens to return) so the chart always plots seven points in a fixed
   * order, with zeros for days nothing was finished — a line that silently
   * skips its empty days misstates the slope.
   */
  trendDays: string[];
  /**
   * 00:00 on the Monday that opens the activity heatmap's grid — 53 weeks
   * back, snapped to a week boundary so every column is a whole week.
   */
  heatmapStart: Date;
  /**
   * The heatmap's 53 × 7 days as `YYYY-MM-DD`, oldest first, in reading
   * order (Monday → Sunday, week after week). Precomputed server-side for
   * the same reason `trendDays` is: the counts are bucketed into *server*
   * calendar days, so a client generating its own date scaffold in a
   * different timezone would drop counts into the wrong cells.
   */
  heatmapDays: string[];
  /** today in the same local calendar — cells after it are in the future */
  todayKey: string;
  /**
   * IANA zone every boundary above was computed in. `$dateToString` needs it
   * to bucket a timestamp into the same calendar day these strings name;
   * without it MongoDB would group by UTC day and the chart would disagree
   * with the KPI cards near midnight.
   */
  timezone: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** how many days the productivity trend plots */
const TREND_DAY_COUNT = 7;

/** how many week-columns the activity heatmap draws */
const HEATMAP_WEEK_COUNT = 53;

/** local-time calendar day as `YYYY-MM-DD` — never `toISOString()`, which is UTC */
function toDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function buildDashboardRanges(now: Date = new Date()): DashboardRanges {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1);

  // built with the date constructor rather than by subtracting milliseconds so
  // a DST change inside the window can't shift a day onto its neighbour
  const startOfDaysAgo = (days: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

  const trendDays: string[] = [];
  for (let i = TREND_DAY_COUNT - 1; i >= 0; i--) {
    trendDays.push(toDayKey(startOfDaysAgo(i)));
  }

  // Weeks run Monday→Sunday, so the grid opens on the Monday of the week 52
  // weeks ago and closes on the Sunday of the current one. `getDay()` is
  // 0=Sunday, hence the shift.
  const mondayOffset = (now.getDay() + 6) % 7;
  const daysBackToGridStart = mondayOffset + (HEATMAP_WEEK_COUNT - 1) * 7;

  const heatmapDays: string[] = [];
  for (let i = 0; i < HEATMAP_WEEK_COUNT * 7; i++) {
    heatmapDays.push(toDayKey(startOfDaysAgo(daysBackToGridStart - i)));
  }

  return {
    now,
    todayStart,
    todayEnd,
    weekStart: new Date(now.getTime() - 7 * DAY_MS),
    prevWeekStart: new Date(now.getTime() - 14 * DAY_MS),
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    prevMonthStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    deadlineHorizon: new Date(todayStart.getTime() + 7 * DAY_MS),
    trendStart: startOfDaysAgo(TREND_DAY_COUNT - 1),
    trendDays,
    heatmapStart: startOfDaysAgo(daysBackToGridStart),
    heatmapDays,
    todayKey: toDayKey(todayStart),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}
