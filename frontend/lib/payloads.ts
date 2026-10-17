import { toUtcIso } from './local-time';

/** Booking form values as entered; `date` / `time` are dealership local `YYYY-MM-DD` / `HH:mm`. */
export interface BookingForm {
  name: string;
  phone: string;
  licensePlate: string;
  make: string;
  model: string;
  dealershipId: string;
  serviceTypeId: string;
  date: string;
  time: string;
  overnightConsent: boolean;
}

/** `POST /appointments` body (DESIGN.md API Contract, Book Appointment). */
export interface BookingRequest {
  name: string;
  phone: string;
  licensePlate: string;
  make?: string;
  model?: string;
  dealershipId: string;
  serviceTypeId: string;
  startTime: string;
  overnightConsent?: true;
}

export interface LookupForm {
  licensePlate: string;
  phone: string;
}

/** `POST /appointments/lookup` body (DESIGN.md Read-Only Operations). */
export interface LookupRequest {
  licensePlate: string;
  phone: string;
}

/** Values are sent as entered; plate and phone normalization stays in the API. */
export function buildBookingPayload(form: BookingForm, timezone: string): BookingRequest {
  return {
    name: form.name,
    phone: form.phone,
    licensePlate: form.licensePlate,
    ...(form.make.trim() !== '' && { make: form.make }),
    ...(form.model.trim() !== '' && { model: form.model }),
    dealershipId: form.dealershipId,
    serviceTypeId: form.serviceTypeId,
    startTime: toUtcIso(form.date, form.time, timezone),
    ...(form.overnightConsent && { overnightConsent: true }),
  };
}

export function buildLookupPayload(form: LookupForm): LookupRequest {
  return { licensePlate: form.licensePlate, phone: form.phone };
}
