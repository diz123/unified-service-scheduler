import { parseErrorBody, toUserMessage } from '../../lib/error-messages';

// Exact texts fixed by DESIGN.md "Generic fallback" and "API unreachable".
const GENERIC = 'Something went wrong. Please try again.';
const UNREACHABLE = 'Cannot reach the booking service. Please try again.';

const CODES = [
  'VALIDATION_FAILED',
  'START_TIME_IN_PAST',
  'OUTSIDE_WORKING_HOURS',
  'OVERNIGHT_CONSENT_REQUIRED',
  'DEALERSHIP_NOT_FOUND',
  'SERVICE_TYPE_NOT_FOUND',
  'PLATE_PHONE_MISMATCH',
  'NO_QUALIFIED_TECHNICIAN',
  'VEHICLE_UNAVAILABLE',
  'BAY_UNAVAILABLE',
  'TECHNICIAN_UNAVAILABLE',
  'SERVICE_BUSY',
  'APPOINTMENTS_NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'REQUEST_REJECTED',
  'INTERNAL_ERROR',
];

/** Codes whose only customer action is to try again share the generic text (Round F2, F2.1). */
const GENERIC_CODES = ['ROUTE_NOT_FOUND', 'REQUEST_REJECTED', 'INTERNAL_ERROR'];
const OWN_TEXT_CODES = CODES.filter((code) => !GENERIC_CODES.includes(code));

/** The user-facing result for an API error body. */
const shown = (status: number, body: unknown): { message: string; details: string[] } =>
  toUserMessage(parseErrorBody(status, body));

describe('Error mapping (Round F2)', () => {
  it.each(CODES)('F2.1 code %s has a non-empty message (FD-1)', (code) => {
    expect(shown(400, { statusCode: 400, code, message: 'x' }).message).not.toBe('');
  });

  it.each(OWN_TEXT_CODES)('F2.1 code %s has its own message, different from the generic fallback', (code) => {
    expect(shown(400, { statusCode: 400, code, message: 'x' }).message).not.toBe(GENERIC);
  });

  it.each(GENERIC_CODES)('F2.1 code %s shows exactly the generic fallback', (code) => {
    expect(shown(400, { statusCode: 400, code, message: 'x' }).message).toBe(GENERIC);
  });

  it.each(['BAY_UNAVAILABLE', 'TECHNICIAN_UNAVAILABLE'])(
    'F2.1 code %s has its own message from the frontend table, not the fallback (DESIGN.md Frontend messages)',
    (code) => {
      expect(shown(409, { statusCode: 409, code, message: 'x' }).message).toBe('This time is no longer available');
    },
  );

  it('F2.2 the API message is never shown to the customer', () => {
    const result = shown(409, { statusCode: 409, code: 'BAY_UNAVAILABLE', message: 'debug-text-xyz' });

    expect(JSON.stringify(result)).not.toContain('debug-text-xyz');
  });

  it('F2.3 an unknown code shows the generic fallback', () => {
    expect(shown(418, { statusCode: 418, code: 'SOMETHING_NEW', message: 'x' }).message).toBe(GENERIC);
  });

  it('F2.3 a body without a code shows the generic fallback', () => {
    expect(shown(500, { statusCode: 500, message: 'x' }).message).toBe(GENERIC);
  });

  it('F2.4 VALIDATION_FAILED returns its details in order', () => {
    const details = ['phone must contain at least one digit', 'name must contain a non-whitespace character'];

    expect(shown(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'x', details }).details).toStrictEqual(details);
  });

  it('F2.4 VALIDATION_FAILED without details (malformed JSON, A-14) returns no details', () => {
    expect(shown(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'x' }).details).toStrictEqual([]);
  });

  it.each([
    ['an HTML string', '<html><body>Internal Server Error</body></html>'],
    ['null', null],
    ['a number', 42],
    ['an array', [{ code: 'BAY_UNAVAILABLE' }]],
  ])('F2.5 a body that is %s shows the cannot-reach message, not the generic fallback (FD-3)', (_label, body) => {
    expect(shown(500, body).message).toBe(UNREACHABLE);
  });

  it('F2.6 SERVICE_BUSY tells the customer to try again (retryable 503)', () => {
    expect(shown(503, { statusCode: 503, code: 'SERVICE_BUSY', message: 'x' }).message.toLowerCase()).toContain('try again');
  });

  it('F2.7 APPOINTMENTS_NOT_FOUND names neither plate nor phone, so it does not reveal whether the plate exists', () => {
    const message = shown(404, { statusCode: 404, code: 'APPOINTMENTS_NOT_FOUND', message: 'x' }).message.toLowerCase();

    expect([message.includes('plate'), message.includes('phone')]).toStrictEqual([false, false]);
  });
});
