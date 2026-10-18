import { accessLogEntry, accessLogLevel } from '../../../src/shared/presentation/access-log';

const REQUEST_ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

describe('accessLogEntry — fields (O-3, T8.4)', () => {
  it('T8.4a a success has exactly requestId, method, path, statusCode and durationMs', () => {
    const entry = accessLogEntry({
      requestId: REQUEST_ID,
      method: 'GET',
      url: '/dealerships',
      statusCode: 200,
      durationMs: 12,
      responseBody: [{ id: 'd1', name: 'Ben Thanh Service Center' }],
    });

    expect(entry).toStrictEqual({ requestId: REQUEST_ID, method: 'GET', path: '/dealerships', statusCode: 200, durationMs: 12 });
  });

  it('T8.4b an error response with a code also has that code', () => {
    const entry = accessLogEntry({
      requestId: REQUEST_ID,
      method: 'POST',
      url: '/appointments',
      statusCode: 409,
      durationMs: 30,
      responseBody: { statusCode: 409, code: 'BAY_UNAVAILABLE', message: 'No service bay is available' },
    });

    expect(entry).toStrictEqual({
      requestId: REQUEST_ID,
      method: 'POST',
      path: '/appointments',
      statusCode: 409,
      durationMs: 30,
      code: 'BAY_UNAVAILABLE',
    });
  });
  it('T8.4c a 200 response whose body contains code produces an entry without code', () => {
    const entry = accessLogEntry({
      requestId: REQUEST_ID,
      method: 'GET',
      url: '/dealerships',
      statusCode: 200,
      durationMs: 8,
      responseBody: { code: 'NOT_AN_ERROR' },
    });

    expect(entry).toStrictEqual({ requestId: REQUEST_ID, method: 'GET', path: '/dealerships', statusCode: 200, durationMs: 8 });
  });
});

describe('accessLogEntry — path (O-3, T8.5)', () => {
  it('T8.5 path excludes the query string', () => {
    const entry = accessLogEntry({ requestId: REQUEST_ID, method: 'GET', url: '/dealerships?x=1', statusCode: 200, durationMs: 5 });

    expect(entry.path).toBe('/dealerships');
  });
});

describe('accessLogLevel — log below 500, error at 500 and above (O-3, T8.6)', () => {
  it.each([
    ['T8.6a', 201, 'log'],
    ['T8.6b', 409, 'log'],
    ['T8.6c', 500, 'error'],
    ['T8.6d', 503, 'error'],
  ])('%s status %d is logged at %s', (_case, statusCode, level) => {
    expect(accessLogLevel(statusCode)).toBe(level);
  });
});
