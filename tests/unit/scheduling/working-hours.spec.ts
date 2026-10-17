import {
  OutsideWorkingHoursException,
  OvernightConsentRequiredException,
  PastStartTimeException,
} from '../../../src/modules/scheduling/domain/scheduling.exceptions';
import {
  assertOvernightConsent,
  assertStartNotInPast,
  assertStartWithinWorkingHours,
  computeServiceWindow,
  WorkingHours,
} from '../../../src/modules/scheduling/domain/working-hours';

// D1: Asia/Ho_Chi_Minh is UTC+7 (no DST), so local 08:00 = 01:00Z.
const D1: WorkingHours = { openTime: '08:00', closeTime: '17:00', timezone: 'Asia/Ho_Chi_Minh' };
// D2: Asia/Tokyo is UTC+9 (no DST), so local 08:00 = 23:00Z of the previous UTC day.
const D2: WorkingHours = { openTime: '08:00', closeTime: '17:00', timezone: 'Asia/Tokyo' };

const utc = (iso: string): Date => new Date(iso);

describe('Working-hours endTime (I-7)', () => {
  it('T1.1 same-day service ends within the same working day', () => {
    // 09:00 local + 120 min → 11:00 local
    const window = computeServiceWindow(utc('2030-01-15T02:00:00Z'), 120, D1);

    expect(window.endTime).toEqual(utc('2030-01-15T04:00:00Z'));
    expect(window.spansOvernight).toBe(false);
  });

  it('T1.2 service ending exactly at closeTime stays on the same day', () => {
    // 15:00 local + 120 min → 17:00 local
    const window = computeServiceWindow(utc('2030-01-15T08:00:00Z'), 120, D1);

    expect(window.endTime).toEqual(utc('2030-01-15T10:00:00Z'));
    expect(window.spansOvernight).toBe(false);
  });

  it('T1.3 one minute past closeTime rolls over to the next opening', () => {
    // 16:59 local + 1 min → 17:00 local same day
    const endsAtClose = computeServiceWindow(utc('2030-01-15T09:59:00Z'), 1, D1);
    // 16:59 local + 2 min → 08:01 local next day
    const rollsOver = computeServiceWindow(utc('2030-01-15T09:59:00Z'), 2, D1);

    expect(endsAtClose.endTime).toEqual(utc('2030-01-15T10:00:00Z'));
    expect(endsAtClose.spansOvernight).toBe(false);
    expect(rollsOver.endTime).toEqual(utc('2030-01-16T01:01:00Z'));
    expect(rollsOver.spansOvernight).toBe(true);
  });

  it('T1.4 remaining minutes after closeTime continue at the next opening (spec example)', () => {
    // 16:00 local + 120 min → 09:00 local next day
    const window = computeServiceWindow(utc('2030-01-15T09:00:00Z'), 120, D1);

    expect(window.endTime).toEqual(utc('2030-01-16T02:00:00Z'));
    expect(window.spansOvernight).toBe(true);
  });

  it('T1.5 a service longer than one working day spans multiple days', () => {
    // 08:00 local + 720 min (540 today + 180 tomorrow) → 11:00 local next day
    const window = computeServiceWindow(utc('2030-01-15T01:00:00Z'), 720, D1);

    expect(window.endTime).toEqual(utc('2030-01-16T04:00:00Z'));
    expect(window.spansOvernight).toBe(true);
  });

  it('T1.6 working hours use the dealership timezone, not a hardcoded one', () => {
    // Both: 16:00 local + 120 min → 09:00 local next day
    const atD1 = computeServiceWindow(utc('2030-01-15T09:00:00Z'), 120, D1);
    const atD2 = computeServiceWindow(utc('2030-01-15T07:00:00Z'), 120, D2);

    expect(atD1.endTime).toEqual(utc('2030-01-16T02:00:00Z'));
    expect(atD2.endTime).toEqual(utc('2030-01-16T00:00:00Z'));
    expect(atD1.endTime).not.toEqual(atD2.endTime);
  });
});

describe('Overnight consent (I-11)', () => {
  const overnight = { endTime: utc('2030-01-16T02:00:00Z'), spansOvernight: true };
  const sameDay = { endTime: utc('2030-01-15T04:00:00Z'), spansOvernight: false };

  it('T1.7 an overnight booking without consent is rejected', () => {
    expect(() => assertOvernightConsent(overnight, false)).toThrow(OvernightConsentRequiredException);
    expect(() => assertOvernightConsent(overnight)).toThrow(OvernightConsentRequiredException);
  });

  it('T1.8 an overnight booking with consent is accepted', () => {
    expect(() => assertOvernightConsent(overnight, true)).not.toThrow();
  });

  it('T1.9 consent is ignored when the booking ends on the same local day', () => {
    expect(() => assertOvernightConsent(sameDay, true)).not.toThrow();
  });

  it('T1.10 overnight is judged by local date, not UTC date', () => {
    const earlyOpening: WorkingHours = { openTime: '06:00', closeTime: '17:00', timezone: 'Asia/Ho_Chi_Minh' };
    // 06:00 local on 2030-01-15 = 23:00Z on 2030-01-14; + 60 min → 07:00 local = 00:00Z on 2030-01-15
    const window = computeServiceWindow(utc('2030-01-14T23:00:00Z'), 60, earlyOpening);

    expect(window.endTime).toEqual(utc('2030-01-15T00:00:00Z'));
    expect(window.spansOvernight).toBe(false);
    expect(() => assertOvernightConsent(window, false)).not.toThrow();
  });
});

describe('Past-time rejection (I-9)', () => {
  it('T1.11 a startTime at or before now is rejected', () => {
    const now = utc('2030-01-15T02:00:00Z');

    expect(() => assertStartNotInPast(utc('2030-01-15T01:59:00Z'), now)).toThrow(PastStartTimeException);
    expect(() => assertStartNotInPast(utc('2030-01-15T02:00:00Z'), now)).toThrow(PastStartTimeException);
  });
});

describe('Start within working hours (I-13)', () => {
  it('T1.12 startTime must be at or after openTime and before closeTime', () => {
    // 07:59 local
    expect(() => assertStartWithinWorkingHours(utc('2030-01-15T00:59:00Z'), D1)).toThrow(
      OutsideWorkingHoursException,
    );
    // 17:00 local
    expect(() => assertStartWithinWorkingHours(utc('2030-01-15T10:00:00Z'), D1)).toThrow(
      OutsideWorkingHoursException,
    );
    // 08:00 local
    expect(() => assertStartWithinWorkingHours(utc('2030-01-15T01:00:00Z'), D1)).not.toThrow();
    // 16:59 local
    expect(() => assertStartWithinWorkingHours(utc('2030-01-15T09:59:00Z'), D1)).not.toThrow();
  });
});
