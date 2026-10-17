import type { AppointmentSummary, Dealership } from './api';

export interface LookupRow {
  appointment: AppointmentSummary;
  timezone: string;
}

/**
 * Pairs each appointment with its dealership's timezone, taken from the dealership list because the lookup body has
 * none (DESIGN.md "Lookup times in the frontend"). Empty when any timezone is unknown, e.g. the list failed to load:
 * no rows rather than times in the wrong zone (DESIGN.md "Unknown dealership timezone").
 */
export function withTimezones(appointments: AppointmentSummary[], dealerships: Dealership[]): LookupRow[] {
  const rows: LookupRow[] = [];
  for (const appointment of appointments) {
    const timezone = dealerships.find((d) => d.id === appointment.dealership.id)?.timezone;
    if (timezone === undefined) return [];
    rows.push({ appointment, timezone });
  }
  return rows;
}
