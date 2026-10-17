// Frontend copy of the offset technique in the backend's domain/working-hours.ts (ADR-0002, Time handling).
// A single offset lookup is exact because dealerships have no DST (DESIGN.md Assumption 4).

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timezone: string): Intl.DateTimeFormat => {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
};

/** Offset of `timezone` from UTC at `instantMs`, in ms (local = UTC + offset). */
const offsetMs = (instantMs: number, timezone: string): number => {
  const parts = formatterFor(timezone).formatToParts(new Date(instantMs));
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value);
  const localAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return localAsUtc - (instantMs - (instantMs % 1000));
};

/** Dealership local wall time `YYYY-MM-DD` + `HH:mm` in `timezone` → UTC instant `YYYY-MM-DDTHH:mm:00.000Z` (ADR-0002). */
export function toUtcIso(date: string, time: string, timezone: string): string {
  const d = DATE.exec(date);
  const t = TIME.exec(time);
  if (!d || !t) {
    throw new RangeError(`Invalid local date/time: "${date}" "${time}"`);
  }
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const localMs = Date.UTC(year, month - 1, day, Number(t[1]), Number(t[2]));
  const check = new Date(localMs);
  // Date.UTC rolls 2026-02-30 over to March; reject instead (FD-4).
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Invalid local date: "${date}"`);
  }
  const guess = localMs - offsetMs(localMs, timezone);
  return new Date(localMs - offsetMs(guess, timezone)).toISOString();
}

/** UTC instant → dealership local `YYYY-MM-DD HH:mm` in `timezone` (DESIGN.md "Lookup times in the frontend"). */
export function formatLocal(isoUtc: string, timezone: string): string {
  const instantMs = new Date(isoUtc).getTime();
  return new Date(instantMs + offsetMs(instantMs, timezone)).toISOString().slice(0, 16).replace('T', ' ');
}

/** Today's `YYYY-MM-DD` in `timezone`; a date-picker hint only, the API decides (DESIGN.md Validation order step 3). */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return formatLocal(now.toISOString(), timezone).slice(0, 10);
}
