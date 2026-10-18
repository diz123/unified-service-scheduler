/** DESIGN.md O-3: one entry per completed request; never bodies or personal data. */
export interface AccessLogEntry {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  code?: string;
}

export interface CompletedRequest {
  requestId: string;
  method: string;
  /** Original URL, possibly with a query string. */
  url: string;
  statusCode: number;
  durationMs: number;
  /** The JSON response body, read only for an error `code`. */
  responseBody?: unknown;
}

export type AccessLogLevel = 'log' | 'error';

const errorCodeOf = (body: unknown): string | undefined => {
  const code = (body as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
};

export function accessLogEntry(request: CompletedRequest): AccessLogEntry {
  const entry: AccessLogEntry = {
    requestId: request.requestId,
    method: request.method,
    path: request.url.split('?')[0],
    statusCode: request.statusCode,
    durationMs: request.durationMs,
  };
  const code = request.statusCode >= 400 ? errorCodeOf(request.responseBody) : undefined;
  return code === undefined ? entry : { ...entry, code };
}

export function accessLogLevel(statusCode: number): AccessLogLevel {
  return statusCode >= 500 ? 'error' : 'log';
}
