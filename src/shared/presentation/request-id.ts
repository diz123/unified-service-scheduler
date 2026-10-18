import { randomUUID } from 'node:crypto';

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** DESIGN.md O-2: reuse a well-formed incoming X-Request-Id, otherwise generate a UUID v4. */
export function resolveRequestId(incoming: string | undefined): string {
  return incoming !== undefined && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}
