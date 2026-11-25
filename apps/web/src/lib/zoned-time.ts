// Pure, import-free, so `node --test` can run its spec without a bundler.

/** Offset of `timeZone` from UTC, in ms, at instant `t`. */
function zoneOffset(t: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - t;
}

/** The instant at which the wall clock in `timeZone` reads `date` (YYYY-MM-DD) `time` (HH:mm). */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [y, m, day] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y!, m! - 1, day!, hh!, mm!);
  // Two passes so a time near a clock change lands on the right side of it.
  const first = wall - zoneOffset(wall, timeZone);
  return new Date(wall - zoneOffset(first, timeZone));
}
