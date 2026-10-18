import { todayIn } from './local-time';

/** Chips shown before the "Other date" input (Round F6). */
export const STRIP_DAYS = 14;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface StripDate {
  /** `YYYY-MM-DD`, the value the form sends (unchanged format). */
  value: string;
  /** Chip text, e.g. `Mon · 20/10`. */
  short: string;
  /** Screen-reader label, e.g. `Monday 20 October 2026`. */
  full: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** The next `STRIP_DAYS` local dates in `timezone`, starting with today there; `now` is injectable for tests. */
export function dateStrip(timezone: string, now: Date = new Date()): StripDate[] {
  const [year, month, day] = todayIn(timezone, now).split('-').map(Number);
  return Array.from({ length: STRIP_DAYS }, (_, offset) => {
    // A UTC calendar date: getUTC* read the local calendar fields, never shifted by the runtime's own zone.
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    const weekday = WEEKDAYS[date.getUTCDay()];
    const d = date.getUTCDate();
    const m = date.getUTCMonth();
    return {
      value: `${date.getUTCFullYear()}-${pad(m + 1)}-${pad(d)}`,
      short: `${weekday.slice(0, 3)} · ${pad(d)}/${pad(m + 1)}`,
      full: `${weekday} ${d} ${MONTHS[m]} ${date.getUTCFullYear()}`,
    };
  });
}
