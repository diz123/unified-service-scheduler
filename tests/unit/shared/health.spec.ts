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

  describe('with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('T8.8d a ping that does not settle within 2 seconds raises DATABASE_UNAVAILABLE', async () => {
      const health = new HealthCheck(() => new Promise<never>(() => undefined));
      let outcome: unknown = 'pending';
      void health.check().then(
        () => {
          outcome = 'resolved';
        },
        (error: unknown) => {
          outcome = error;
        },
      );

      await jest.advanceTimersByTimeAsync(1_999);
      const beforeTimeout = outcome;
      await jest.advanceTimersByTimeAsync(1);

      const error = outcome instanceof HttpException ? outcome : undefined;
      const body = error?.getResponse() as { code?: unknown } | undefined;
      expect([beforeTimeout, error?.getStatus(), body?.code]).toStrictEqual([
        'pending',
        503,
        'DATABASE_UNAVAILABLE',
      ]);
    });
  });
});
