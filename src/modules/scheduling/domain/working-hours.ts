import {
  OutsideWorkingHoursException,
  OvernightConsentRequiredException,
  PastStartTimeException,
} from './scheduling.exceptions';

export interface WorkingHours {
  /** Local time `HH:mm`. */
  openTime: string;
  /** Local time `HH:mm`. */
  closeTime: string;
  /** IANA timezone identifier. */
  timezone: string;
}

export interface ServiceWindow {
  endTime: Date;
  /** True when `endTime` falls on a later local date than `startTime`. */
  spansOvernight: boolean;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

const parseMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};

/** Offset of `timezone` from UTC at `instantMs`, in ms (local = UTC + offset). */
const offsetMs = (instantMs: number, timezone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  const localAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return localAsUtc - (instantMs - (instantMs % 1000));
};

/** Local wall-clock time encoded as a UTC epoch value, so UTC arithmetic gives local dates. */
const toLocalMs = (instant: Date, timezone: string): number => instant.getTime() + offsetMs(instant.getTime(), timezone);

const fromLocalMs = (localMs: number, timezone: string): Date => {
  const guess = localMs - offsetMs(localMs, timezone);
  return new Date(localMs - offsetMs(guess, timezone));
};

const startOfDay = (localMs: number): number => localMs - (((localMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);

export function computeServiceWindow(startTime: Date, durationMinutes: number, hours: WorkingHours): ServiceWindow {
  const openMs = parseMinutes(hours.openTime) * MS_PER_MINUTE;
  const closeMs = parseMinutes(hours.closeTime) * MS_PER_MINUTE;
  const startLocal = toLocalMs(startTime, hours.timezone);
  const startDay = startOfDay(startLocal);

  // Advance through working hours only; DESIGN.md A-4 guarantees openTime < closeTime.
  let day = startDay;
  let cursor = Math.max(startLocal - startDay, openMs);
  let remaining = durationMinutes * MS_PER_MINUTE;
  while (remaining > closeMs - cursor) {
    remaining -= Math.max(closeMs - cursor, 0);
    day += MS_PER_DAY;
    cursor = openMs;
  }

  return {
    endTime: fromLocalMs(day + cursor + remaining, hours.timezone),
    spansOvernight: day > startDay,
  };
}

export function assertStartNotInPast(startTime: Date, now: Date): void {
  if (startTime.getTime() <= now.getTime()) {
    throw new PastStartTimeException();
  }
}

export function assertStartWithinWorkingHours(startTime: Date, hours: WorkingHours): void {
  const startLocal = toLocalMs(startTime, hours.timezone);
  const timeOfDay = startLocal - startOfDay(startLocal);
  if (
    timeOfDay < parseMinutes(hours.openTime) * MS_PER_MINUTE ||
    timeOfDay >= parseMinutes(hours.closeTime) * MS_PER_MINUTE
  ) {
    throw new OutsideWorkingHoursException();
  }
}

export function assertOvernightConsent(window: ServiceWindow, overnightConsent?: boolean): void {
  if (window.spansOvernight && overnightConsent !== true) {
    throw new OvernightConsentRequiredException();
  }
}
