import { HttpException, Logger } from '@nestjs/common';
import { HealthCheck } from '../../../src/shared/presentation/health-check';

const PING_ERROR = 'connect ECONNREFUSED secret-host:5432';

/** The HTTP exception `check()` rejects with when the ping fails, or undefined if it resolved. */
async function failedCheck(): Promise<HttpException | undefined> {
  const health = new HealthCheck(() => Promise.reject(new Error(PING_ERROR)));
  const rejection: unknown = await health.check().then(
    () => undefined,
    (error: unknown) => error,
  );
  return rejection instanceof HttpException ? rejection : undefined;
}

describe('HealthCheck (O-4)', () => {
  let loggedErrors: jest.SpyInstance;

  beforeEach(() => {
    loggedErrors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggedErrors.mockRestore();
  });

  it('T8.7 returns { status: "ok" } when the database ping succeeds', async () => {
    const health = new HealthCheck(() => Promise.resolve(1));

    await expect(health.check()).resolves.toStrictEqual({ status: 'ok' });
  });

  it('T8.8a a failed ping raises DATABASE_UNAVAILABLE with the standard error body and status 503', async () => {
    const error = await failedCheck();

    const body = error?.getResponse() as { statusCode?: unknown; code?: unknown; message?: unknown } | undefined;
    expect([error?.getStatus(), body?.statusCode, body?.code, typeof body?.message, Object.keys(body ?? {}).sort()]).toStrictEqual([
      503,
      503,
      'DATABASE_UNAVAILABLE',
      'string',
      ['code', 'message', 'statusCode'],
    ]);
  });

  it('T8.8b the response body does not contain the ping error message', async () => {
    const error = await failedCheck();

    expect([error !== undefined, JSON.stringify(error?.getResponse()).includes('ECONNREFUSED')]).toStrictEqual([true, false]);
  });

  it('T8.8c the ping error message is logged at error level', async () => {
    await failedCheck();

    expect(loggedErrors).toHaveBeenCalledWith(expect.stringContaining(PING_ERROR));
  });
});
