import { Logger } from '@nestjs/common';
import { accessLogEntry, accessLogLevel } from './access-log';
import { resolveRequestId } from './request-id';

interface ObservedRequest {
  method: string;
  /** Path plus query string; the access log drops the query. */
  originalUrl: string;
  header(name: string): string | undefined;
}

interface ObservedResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
  on(event: 'finish', listener: () => void): unknown;
}

const logger = new Logger('AccessLog');

/**
 * DESIGN.md O-2 and O-3: sets X-Request-Id before any handler or filter runs, so every response carries it,
 * and writes one access-log entry when the response finishes.
 */
export function requestObservability(request: ObservedRequest, response: ObservedResponse, next: () => void): void {
  const requestId = resolveRequestId(request.header('x-request-id'));
  const startedAt = Date.now();
  let responseBody: unknown;

  // Express offers no hook for the body sent; wrapping json() reads the error `code` without logging the body.
  const sendJson = response.json.bind(response);
  response.json = (body: unknown): unknown => {
    responseBody = body;
    return sendJson(body);
  };

  response.setHeader('X-Request-Id', requestId);
  response.on('finish', () => {
    const entry = accessLogEntry({
      requestId,
      method: request.method,
      url: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      responseBody,
    });
    logger[accessLogLevel(response.statusCode)](entry);
  });
  next();
}
