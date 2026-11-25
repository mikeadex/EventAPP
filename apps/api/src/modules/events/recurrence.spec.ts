import { nthOccurrenceStart, seriesOccurrences } from '@ekklesia/shared';

const LONDON = 'Europe/London';

/** The wall clock in `tz` as "YYYY-MM-DD HH:mm", for readable assertions. */
function wall(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;
}

describe('weekly occurrences', () => {
  it('keeps the wall-clock time across the spring clock change in London', () => {
    // Sunday 22 March 2026 10:30 GMT. Clocks go forward on 29 March.
    const first = new Date('2026-03-22T10:30:00Z');
    const dates = seriesOccurrences(first, new Date('2026-03-22T12:00:00Z'), { every: 'week', count: 3 }, LONDON);
    expect(dates.map((d) => wall(d.startsAt, LONDON))).toEqual([
      '2026-03-22 10:30',
      '2026-03-29 10:30',
      '2026-04-05 10:30',
    ]);
    // After the change 10:30 BST is 09:30Z — not 10:30Z, which would be 11:30 on the wall.
    expect(dates[1]!.startsAt.toISOString()).toBe('2026-03-29T09:30:00.000Z');
    expect(dates[2]!.startsAt.toISOString()).toBe('2026-04-05T09:30:00.000Z');
  });

  it('keeps the wall-clock time across the autumn clock change in London', () => {
    // Sunday 18 October 2026 18:00 BST. Clocks go back on 25 October.
    const first = new Date('2026-10-18T17:00:00Z');
    const d = nthOccurrenceStart(first, 'week', 1, LONDON);
    expect(wall(d, LONDON)).toBe('2026-10-25 18:00');
    expect(d.toISOString()).toBe('2026-10-25T18:00:00.000Z');
  });

  it('keeps each occurrence the same length', () => {
    const dates = seriesOccurrences(
      new Date('2026-03-22T10:30:00Z'),
      new Date('2026-03-22T12:00:00Z'),
      { every: 'week', count: 2 },
      LONDON,
    );
    for (const d of dates) expect(d.endsAt.getTime() - d.startsAt.getTime()).toBe(90 * 60 * 1000);
  });

  it('counts the first date as occurrence one', () => {
    const dates = seriesOccurrences(
      new Date('2026-06-01T18:00:00Z'),
      new Date('2026-06-01T19:00:00Z'),
      { every: 'week', count: 6 },
      LONDON,
    );
    expect(dates).toHaveLength(6);
    expect(dates[0]!.startsAt.toISOString()).toBe('2026-06-01T18:00:00.000Z');
    expect(dates[5]!.startsAt.toISOString()).toBe('2026-07-06T18:00:00.000Z');
  });
});

describe('monthly occurrences', () => {
  it('keeps the day of the month', () => {
    const first = new Date('2026-01-15T19:00:00Z');
    const dates = seriesOccurrences(first, new Date('2026-01-15T21:00:00Z'), { every: 'month', count: 4 }, LONDON);
    expect(dates.map((d) => wall(d.startsAt, LONDON))).toEqual([
      '2026-01-15 19:00',
      '2026-02-15 19:00',
      '2026-03-15 19:00',
      '2026-04-15 19:00',
    ]);
  });

  it('clamps the 31st to the last day of shorter months and returns to it after', () => {
    const first = new Date('2026-01-31T19:00:00Z');
    const dates = seriesOccurrences(first, new Date('2026-01-31T21:00:00Z'), { every: 'month', count: 6 }, LONDON);
    expect(dates.map((d) => wall(d.startsAt, LONDON).slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
  });

  it('clamps to 29 February in a leap year', () => {
    const d = nthOccurrenceStart(new Date('2028-01-30T10:00:00Z'), 'month', 1, LONDON);
    expect(wall(d, LONDON)).toBe('2028-02-29 10:00');
  });

  it('rolls over the year end', () => {
    const d = nthOccurrenceStart(new Date('2026-11-25T10:00:00Z'), 'month', 3, LONDON);
    expect(wall(d, LONDON)).toBe('2027-02-25 10:00');
  });

  it('keeps the wall-clock time across the clock change', () => {
    // 19:00 GMT in February becomes 19:00 BST (18:00Z) in April.
    const first = new Date('2026-02-10T19:00:00Z');
    const april = nthOccurrenceStart(first, 'month', 2, LONDON);
    expect(wall(april, LONDON)).toBe('2026-04-10 19:00');
    expect(april.toISOString()).toBe('2026-04-10T18:00:00.000Z');
  });

  it('works in a zone with no clock changes', () => {
    const d = nthOccurrenceStart(new Date('2026-01-31T09:00:00Z'), 'month', 1, 'Africa/Lagos');
    expect(d.toISOString()).toBe('2026-02-28T09:00:00.000Z');
  });
});
