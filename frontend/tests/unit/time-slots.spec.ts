import { timeSlots } from '../../lib/time-slots';

describe('timeSlots — 30-minute start times from open up to (not including) close (Round F5)', () => {
  it('08:00–17:00 gives 08:00, 08:30 … 16:30', () => {
    const slots = timeSlots('08:00', '17:00');

    expect([slots.length, slots[0], slots[1], slots[slots.length - 1]]).toStrictEqual([18, '08:00', '08:30', '16:30']);
  });

  it('07:30–19:00 starts at 07:30 and ends at 18:30', () => {
    const slots = timeSlots('07:30', '19:00');

    expect([slots[0], slots[slots.length - 1]]).toStrictEqual(['07:30', '18:30']);
  });

  it('07:00–12:00 gives 10 slots', () => {
    expect(timeSlots('07:00', '12:00')).toStrictEqual([
      '07:00',
      '07:30',
      '08:00',
      '08:30',
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
    ]);
  });

  it('a close time off the 30-minute grid (17:15) ends at the last slot before it, 17:00', () => {
    const slots = timeSlots('08:00', '17:15');

    expect(slots[slots.length - 1]).toBe('17:00');
  });
});
