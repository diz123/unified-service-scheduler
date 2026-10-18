import { dateStrip } from '../../lib/date-strip';

const HCM = 'Asia/Ho_Chi_Minh';

describe('dateStrip — the next 14 local dates for the date chips (Round F6)', () => {
  it("starts on today's local date in the dealership timezone", () => {
    expect(dateStrip(HCM, new Date('2026-10-20T03:00:00.000Z'))[0].value).toBe('2026-10-20');
  });

  it('at 23:30Z starts on the next day in Asia/Ho_Chi_Minh (06:30 local)', () => {
    expect(dateStrip(HCM, new Date('2026-10-19T23:30:00.000Z'))[0].value).toBe('2026-10-20');
  });

  it('returns 14 consecutive dates', () => {
    const values = dateStrip(HCM, new Date('2026-10-20T03:00:00.000Z')).map((d) => d.value);

    expect(values).toStrictEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('crosses the month end and the year end', () => {
    const values = dateStrip(HCM, new Date('2026-12-28T03:00:00.000Z')).map((d) => d.value);

    expect(values.slice(2, 6)).toStrictEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('labels each chip with weekday · day/month and a full date for screen readers', () => {
    const [first] = dateStrip(HCM, new Date('2026-10-19T03:00:00.000Z'));

    expect([first.short, first.full]).toStrictEqual(['Mon · 19/10', 'Monday 19 October 2026']);
  });
});
