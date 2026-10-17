import type { AppointmentSummary, Dealership } from '../../lib/api';
import { withTimezones } from '../../lib/lookup-rows';

const dealership = (id: string, timezone: string): Dealership => ({
  id,
  name: `Dealer ${id}`,
  openTime: '08:00',
  closeTime: '17:00',
  timezone,
});

const appointment = (id: string, dealershipId: string): AppointmentSummary => ({
  id,
  startTime: '2030-01-15T02:00:00.000Z',
  endTime: '2030-01-15T03:00:00.000Z',
  status: 'Confirmed',
  dealership: { id: dealershipId, name: `Dealer ${dealershipId}` },
  serviceType: { id: 'service-type-1', name: 'Oil change' },
});

// Different zones prove each row is matched by its own dealership id, not the first dealership in the list.
const DEALERSHIPS = [dealership('d1', 'Asia/Tokyo'), dealership('d2', 'Asia/Ho_Chi_Minh')];

describe('withTimezones (DESIGN.md "Lookup times in the frontend")', () => {
  it("pairs each row with its own dealership's timezone, in the order returned", () => {
    const rows = withTimezones([appointment('a1', 'd2'), appointment('a2', 'd1')], DEALERSHIPS);

    expect(rows.map((r) => [r.appointment.id, r.timezone])).toStrictEqual([
      ['a1', 'Asia/Ho_Chi_Minh'],
      ['a2', 'Asia/Tokyo'],
    ]);
  });

  it('returns no rows when any dealership timezone is unknown (DESIGN.md "Unknown dealership timezone")', () => {
    expect(withTimezones([appointment('a1', 'd1'), appointment('a2', 'unknown')], DEALERSHIPS)).toStrictEqual([]);
  });
});
