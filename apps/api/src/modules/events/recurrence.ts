/**
 * Turning a recurrence rule into dates.
 *
 * Deliberately a pure function over plain values: no Prisma, no clock, no
 * timezone library. Everything that makes recurrence hard to get right —
 * month lengths, "last Tuesday", a series that ends mid-month — is decidable
 * from the rule and a start date, and keeping it separable means it can be
 * tested exhaustively without a database.
 */

export type RecurrenceFreq = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY_BY_DATE' | 'MONTHLY_BY_WEEKDAY';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Every N periods. FORTNIGHTLY is WEEKLY with 2, kept separate for wording. */
  interval?: number;
  /** 0 = Sunday .. 6 = Saturday. Weekly frequencies only. */
  byWeekday?: number[];
  /** MONTHLY_BY_WEEKDAY: 1..4 for first..fourth, -1 for last. */
  nthWeekday?: number | null;
  /** The first occurrence. Its clock time is used for every occurrence. */
  startsAt: Date;
  /** Inclusive. Generation stops after this instant. */
  until?: Date | null;
  /** Total occurrences including the first. */
  count?: number | null;
}

/**
 * A ceiling on how far ahead occurrences are made, whatever the rule says.
 *
 * An open-ended weekly service would otherwise generate forever. The top-up
 * job extends the horizon as time passes, so this is a batch size rather than
 * a limit on the series.
 */
export const DEFAULT_HORIZON_DAYS = 180;
export const MAX_OCCURRENCES = 200;

/** Days in `month` of `year`, where month is 0-based. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Copy `from`'s clock time onto a date built from y/m/d. */
function at(from: Date, year: number, month: number, day: number): Date {
  return new Date(
    Date.UTC(year, month, day, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), 0),
  );
}

/**
 * The date of the `nth` given weekday in a month. `nth` of -1 means the last.
 * Returns null when the month has no such date — a fifth Tuesday often does
 * not exist, and inventing one by rolling into the next month would silently
 * move the event.
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number,
): number | null {
  const total = daysInMonth(year, month);

  if (nth === -1) {
    for (let day = total; day >= 1; day--) {
      if (new Date(Date.UTC(year, month, day)).getUTCDay() === weekday) return day;
    }
    return null;
  }

  let seen = 0;
  for (let day = 1; day <= total; day++) {
    if (new Date(Date.UTC(year, month, day)).getUTCDay() === weekday) {
      seen += 1;
      if (seen === nth) return day;
    }
  }
  return null;
}

/**
 * Expand a rule into start times.
 *
 * Always includes `startsAt` itself as the first occurrence, so what the
 * organiser typed is what they get regardless of whether it happens to match
 * the weekday pattern they also chose.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  opts: { horizonDays?: number; max?: number } = {},
): Date[] {
  const horizonDays = opts.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const max = Math.min(opts.max ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const interval = Math.max(1, rule.interval ?? (rule.freq === 'FORTNIGHTLY' ? 2 : 1));

  const start = rule.startsAt;
  const horizon = new Date(start.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const hardEnd = rule.until && rule.until < horizon ? rule.until : horizon;
  const wanted = rule.count && rule.count > 0 ? Math.min(rule.count, max) : max;

  const out: Date[] = [start];

  const push = (d: Date): boolean => {
    if (d <= start) return true; // never go backwards or repeat the first
    if (d > hardEnd) return false;
    out.push(d);
    return out.length < wanted;
  };

  if (rule.freq === 'WEEKLY' || rule.freq === 'FORTNIGHTLY') {
    // Which weekdays: the ones chosen, or the start's own if none were.
    const days = rule.byWeekday?.length ? [...new Set(rule.byWeekday)].sort() : [start.getUTCDay()];

    // Walk week by week from the start of the start's week, so multi-day
    // rules ("Tuesdays and Thursdays") come out in date order rather than
    // grouped by weekday.
    const weekStart = new Date(start);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());

    for (let week = 0; out.length < wanted; week += interval) {
      const base = new Date(weekStart);
      base.setUTCDate(base.getUTCDate() + week * 7);
      if (base > hardEnd && week > 0) break;

      let roomLeft = true;
      for (const weekday of days) {
        const d = at(start, base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + weekday);
        roomLeft = push(d);
        if (!roomLeft) break;
      }
      if (!roomLeft) break;
      // A rule whose horizon is already passed must not spin forever.
      if (week > 520) break;
    }
    return out.slice(0, wanted);
  }

  if (rule.freq === 'MONTHLY_BY_DATE') {
    const day = start.getUTCDate();
    for (let i = interval; out.length < wanted; i += interval) {
      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + i;
      const year = y + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      // The 31st does not exist in every month. Skipping is the honest
      // choice: clamping to the 30th moves the event, and rolling to the 1st
      // moves it into the wrong month.
      if (day > daysInMonth(year, month)) {
        if (i > 240) break;
        continue;
      }
      if (!push(at(start, year, month, day))) break;
      if (i > 240) break;
    }
    return out.slice(0, wanted);
  }

  // MONTHLY_BY_WEEKDAY — "the first Sunday", "the last Tuesday".
  const weekday = rule.byWeekday?.length ? rule.byWeekday[0]! : start.getUTCDay();
  const nth = rule.nthWeekday ?? 1;
  for (let i = interval; out.length < wanted; i += interval) {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + i;
    const year = y + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    const day = nthWeekdayOfMonth(year, month, weekday, nth);
    if (day === null) {
      if (i > 240) break;
      continue;
    }
    if (!push(at(start, year, month, day))) break;
    if (i > 240) break;
  }
  return out.slice(0, wanted);
}

/** "Every Sunday", "Every other Tuesday", "First Sunday of the month". */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function describeRecurrence(rule: RecurrenceRule): string {
  const interval = Math.max(1, rule.interval ?? (rule.freq === 'FORTNIGHTLY' ? 2 : 1));
  const days = rule.byWeekday?.length
    ? [...new Set(rule.byWeekday)].sort()
    : [rule.startsAt.getUTCDay()];
  const names = days.map((d) => DAY_NAMES[d] ?? '');

  const list = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

  if (rule.freq === 'WEEKLY' || rule.freq === 'FORTNIGHTLY') {
    if (interval === 1) return `Every ${list(names)}`;
    if (interval === 2) return `Every other ${list(names)}`;
    return `Every ${interval} weeks on ${list(names)}`;
  }

  if (rule.freq === 'MONTHLY_BY_DATE') {
    const day = rule.startsAt.getUTCDate();
    const suffix =
      day % 10 === 1 && day !== 11
        ? 'st'
        : day % 10 === 2 && day !== 12
          ? 'nd'
          : day % 10 === 3 && day !== 13
            ? 'rd'
            : 'th';
    return interval === 1
      ? `The ${day}${suffix} of every month`
      : `The ${day}${suffix}, every ${interval} months`;
  }

  const nth = rule.nthWeekday ?? 1;
  const ordinal =
    nth === -1
      ? 'Last'
      : nth === 1
        ? 'First'
        : nth === 2
          ? 'Second'
          : nth === 3
            ? 'Third'
            : 'Fourth';
  return interval === 1
    ? `${ordinal} ${names[0]} of the month`
    : `${ordinal} ${names[0]}, every ${interval} months`;
}
