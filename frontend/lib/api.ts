// Thin fetch client (FD-5): not unit-tested; error parsing lives in parseErrorBody, which is.
import { type ApiError, parseErrorBody } from './error-messages';
import type { BookingRequest } from './payloads';

/** `GET /dealerships` item (DESIGN.md Read-Only Operations). */
export interface Dealership {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  timezone: string;
}

/** `GET /dealerships/:dealershipId/service-types` item. */
export interface ServiceType {
  id: string;
  name: string;
  durationMinutes: number;
}

/** `POST /appointments` 201 body: identifiers, UTC times and status. */
export interface BookedAppointment {
  id: string;
  customerId: string;
  vehicleId: string;
  dealershipId: string;
  serviceTypeId: string;
  serviceBayId: string;
  technicianId: string;
  startTime: string;
  endTime: string;
  status: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Same-origin prefix that next.config.ts rewrites to the NestJS API (ADR-0002). */
const API_BASE = '/api';

const UNREACHABLE: ApiResult<never> = { ok: false, error: { kind: 'unreachable' } };

/** Parsed JSON, or the raw text when the body is not JSON (parseErrorBody treats that as unreachable, FD-3). */
const parseBody = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let status: number;
  let body: unknown;
  try {
    const response = await fetch(`${API_BASE}${path}`, init);
    status = response.status;
    body = parseBody(await response.text());
    if (response.ok) {
      // A success body that is not JSON did not come from the API.
      // The API contract defines the success shape; it is not re-validated here.
      return typeof body === 'object' && body !== null ? { ok: true, data: body as T } : UNREACHABLE;
    }
  } catch {
    return UNREACHABLE;
  }
  return { ok: false, error: parseErrorBody(status, body) };
}

export const listDealerships = (): Promise<ApiResult<Dealership[]>> => request('/dealerships');

export const listServiceTypes = (dealershipId: string): Promise<ApiResult<ServiceType[]>> =>
  request(`/dealerships/${encodeURIComponent(dealershipId)}/service-types`);

export const bookAppointment = (payload: BookingRequest): Promise<ApiResult<BookedAppointment>> =>
  request('/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
