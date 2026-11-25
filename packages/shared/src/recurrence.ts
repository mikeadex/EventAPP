/**
 * The dates of a repeating event.
 *
 * Pure and import-free so it runs the same in the API, the browser and
 * Hermes. "Weekly" is the same wall-clock time seven days on, so a 10:30
 * service stays at 10:30 across a clock change. "Monthly" is the same
 * day-of-month, clamped to the last day of shorter months: a run started on
 * the 31st lands on 28 February and 30 April, and goes back to the 31st when
 * the month has one.
 */

export type RepeatEvery = 'week' | 'month';

export const REPEAT_MIN_COUNT = 2;
export const REPEAT_MAX_COUNT = 52;

export interface RepeatRule {
  every: RepeatEvery;
  /** Total occurrences, the first included. */
  count: number;
}

interface WallClock {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(t: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(t);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Some engines print midnight as 24 even under h23.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset of `timeZone` from UTC, in ms, at instant `t`. */
function zoneOffset(t: number, timeZone: string) {
  const w = wallClock(new Date(t), timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - t;
}

/** The instant at which the wall clock in `timeZone` reads `w`. */
function fromWallClock(w: WallClock, timeZone: string): Date {
  const wall = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Two passes so a time near a clock change lands on the right side of it.
  const first = wall - zoneOffset(wall, timeZone);
  return new Date(wall - zoneOffset(first, timeZone));
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * The start of the `n`th occurrence (0 = the first) of an event that starts at
 * `first`, repeating `every` week or month in `timeZone`.
 */
export function nthOccurrenceStart(first: Date, every: RepeatEvery, n: number, timeZone: string): Date {
  if (n === 0) return new Date(first.getTime());
  const w = wallClock(first, timeZone);
  if (every === 'week') {
    const d = new Date(Date.UTC(w.year, w.month - 1, w.day + 7 * n));
    return fromWallClock(
      { ...w, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
      timeZone,
    );
  }
  // Months: keep the day-of-month, clamped to what the target month has.
  const monthIndex = w.month - 1 + n;
  const year = w.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  const day = Math.min(w.day, daysInMonth(year, month));
  return fromWallClock({ ...w, year, month, day }, timeZone);
}

/**
 * Every occurrence of a series, the first included, each the same length as
 * the original.
 */
export function seriesOccurrences(
  startsAt: Date,
  endsAt: Date,
  rule: RepeatRule,
  timeZone: string,
): { startsAt: Date; endsAt: Date }[] {
  const duration = endsAt.getTime() - startsAt.getTime();
  const out: { startsAt: Date; endsAt: Date }[] = [];
  for (let n = 0; n < rule.count; n++) {
    const s = nthOccurrenceStart(startsAt, rule.every, n, timeZone);
    out.push({ startsAt: s, endsAt: new Date(s.getTime() + duration) });
  }
  return out;
}
