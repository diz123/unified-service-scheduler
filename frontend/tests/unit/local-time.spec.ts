import { formatLocal, toUtcIso } from '../../lib/local-time';

const HCM = 'Asia/Ho_Chi_Minh';
const TOKYO = 'Asia/Tokyo';

/** Inputs whose expected UTC instant is fixed by Round F1 (F1.1, F1.2, F1.4, F1.6, F1.7, F1.8). */
const CONVERSIONS: [string, string, string, string, string][] = [
  ['F1.1', '2026-11-02', '09:00', HCM, '2026-11-02T02:00:00.000Z'],
  ['F1.2', '2026-11-02', '08:00', TOKYO, '2026-11-01T23:00:00.000Z'],
  ['F1.4', '2026-11-02', '06:00', HCM, '2026-11-01T23:00:00.000Z'],
  ['F1.6', '2026-11-02', '00:00', HCM, '2026-11-01T17:00:00.000Z'],
  ['F1.7', '2027-01-01', '00:30', HCM, '2026-12-31T17:30:00.000Z'],
  ['F1.8', '2028-02-29', '10:00', HCM, '2028-02-29T03:00:00.000Z'],
];

describe('toUtcIso — dealership local time to UTC (Round F1)', () => {
  it('F1.1 converts a morning in Ho Chi Minh City to UTC (backend T1.1)', () => {
    expect(toUtcIso('2026-11-02', '09:00', HCM)).toBe('2026-11-02T02:00:00.000Z');
  });

  it('F1.2 uses the given timezone, landing on the previous UTC day for Tokyo (backend T1.6)', () => {
    expect(toUtcIso('2026-11-02', '08:00', TOKYO)).toBe('2026-11-01T23:00:00.000Z');
  });

  it('F1.3 the timezone is not hardcoded: the same local time differs between Ho Chi Minh City and Tokyo', () => {
    expect(toUtcIso('2026-11-02', '09:00', HCM)).not.toBe(toUtcIso('2026-11-02', '09:00', TOKYO));
  });

  it('F1.4 an early local time falls on the previous UTC date (backend T1.10)', () => {
    expect(toUtcIso('2026-11-02', '06:00', HCM)).toBe('2026-11-01T23:00:00.000Z');
  });

  it.each(CONVERSIONS)('F1.5 output for %s has the Z suffix, :00 seconds and 3 fraction digits (A-13)', (_id, date, time, tz) => {
    expect(toUtcIso(date, time, tz)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });

  it('F1.6 local midnight converts to the previous UTC evening', () => {
    expect(toUtcIso('2026-11-02', '00:00', HCM)).toBe('2026-11-01T17:00:00.000Z');
  });

  it('F1.7 crosses the year boundary back into the previous UTC year', () => {
    expect(toUtcIso('2027-01-01', '00:30', HCM)).toBe('2026-12-31T17:30:00.000Z');
  });

  it('F1.8 accepts a leap day', () => {
    expect(toUtcIso('2028-02-29', '10:00', HCM)).toBe('2028-02-29T03:00:00.000Z');
  });

  it.each([
    ['month 13', '2026-13-01', '09:00'],
    ['hour 25', '2026-11-02', '25:00'],
    ['single-digit hour', '2026-11-02', '9:00'],
    ['empty date', '', '09:00'],
    ['empty time', '2026-11-02', ''],
  ])('F1.9 malformed input (%s) throws RangeError (FD-4)', (_label, date, time) => {
    expect(() => toUtcIso(date, time, HCM)).toThrow(RangeError);
  });

  it.each([
    ['30 February', '2026-02-30'],
    ['29 February in a non-leap year', '2027-02-29'],
  ])('F1.10 an impossible date (%s) throws RangeError instead of rolling over (FD-4)', (_label, date) => {
    expect(() => toUtcIso(date, '09:00', HCM)).toThrow(RangeError);
  });
});

describe('formatLocal — UTC to dealership local time (Round F1, FD-2)', () => {
  it.each([
    ['2026-11-02T02:00:00.000Z', HCM, '2026-11-02 09:00'],
    ['2026-11-01T23:00:00.000Z', TOKYO, '2026-11-02 08:00'],
  ])('F1.11 formats %s in %s as %s', (isoUtc, tz, expected) => {
    expect(formatLocal(isoUtc, tz)).toBe(expected);
  });

  it.each(CONVERSIONS)('F1.12 round trip for %s returns the original local date and time', (_id, date, time, tz) => {
    expect(formatLocal(toUtcIso(date, time, tz), tz)).toBe(`${date} ${time}`);
  });
});
