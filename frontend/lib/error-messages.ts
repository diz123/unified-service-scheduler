/** An API failure as the UI sees it (DESIGN.md Error response format, API unreachable). */
export type ApiError =
  | { kind: 'response'; status: number; code: string | undefined; details: string[] }
  | { kind: 'unreachable' };

const GENERIC = 'Something went wrong. Please try again.';
const UNREACHABLE = 'Cannot reach the booking service. Please try again.';
const TIME_TAKEN = 'This time is no longer available';

/** One message per DESIGN.md error code (Frontend messages); codes share a text when the customer action is the same. */
const MESSAGES = new Map<string, string>([
  ['VALIDATION_FAILED', 'Some details are missing or invalid. Please check the form.'],
  ['START_TIME_IN_PAST', 'Please choose a time in the future.'],
  ['OUTSIDE_WORKING_HOURS', 'The dealership is closed at that time. Please choose a time within opening hours.'],
  [
    'OVERNIGHT_CONSENT_REQUIRED',
    'This service runs past closing time. Please agree to leave the vehicle overnight, or choose an earlier time.',
  ],
  ['DEALERSHIP_NOT_FOUND', 'This dealership is not available. Please choose another one.'],
  ['SERVICE_TYPE_NOT_FOUND', 'This service is not offered at the selected dealership. Please choose another one.'],
  ['PLATE_PHONE_MISMATCH', 'This license plate is registered with a different phone number.'],
  ['NO_QUALIFIED_TECHNICIAN', 'This dealership has no technician for this service. Please choose another dealership.'],
  ['VEHICLE_UNAVAILABLE', 'This vehicle already has an appointment at that time.'],
  ['BAY_UNAVAILABLE', TIME_TAKEN],
  ['TECHNICIAN_UNAVAILABLE', TIME_TAKEN],
  ['SERVICE_BUSY', 'The booking service is busy. Please try again in a moment.'],
  ['APPOINTMENTS_NOT_FOUND', 'No appointments found for these details.'],
  ['ROUTE_NOT_FOUND', GENERIC],
  ['REQUEST_REJECTED', GENERIC],
  ['INTERNAL_ERROR', GENERIC],
]);

/** Reads an error response; `body` is the parsed JSON, or the raw text when the body is not JSON. */
export function parseErrorBody(status: number, body: unknown): ApiError {
  // Anything but a JSON object did not come from the API's error format: the proxy answered instead (FD-3).
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { kind: 'unreachable' };
  }
  const code = 'code' in body ? body.code : undefined;
  const details = 'details' in body ? body.details : undefined;
  return {
    kind: 'response',
    status,
    code: typeof code === 'string' ? code : undefined,
    details: Array.isArray(details) ? details.filter((d): d is string => typeof d === 'string') : [],
  };
}

/** The customer-facing text for an error (DESIGN.md Frontend messages, Generic fallback); the API `message` is never used. */
export function toUserMessage(error: ApiError): { message: string; details: string[] } {
  if (error.kind === 'unreachable') {
    return { message: UNREACHABLE, details: [] };
  }
  const message = (error.code !== undefined && MESSAGES.get(error.code)) || GENERIC;
  return { message, details: error.details };
}
