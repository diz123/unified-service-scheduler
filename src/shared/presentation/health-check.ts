import { HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';

/** DESIGN.md O-4: a ping slower than this counts as a failed ping. */
const PING_TIMEOUT_MS = 2_000;

/** DESIGN.md O-4: 503 DATABASE_UNAVAILABLE in the standard error body. */
export class DatabaseUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({ statusCode: HttpStatus.SERVICE_UNAVAILABLE, code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' });
  }
}

export interface HealthStatus {
  status: 'ok';
}

/** Rejects if `work` has not settled within `ms`; the timer is cleared either way. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Database ping timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** DESIGN.md O-4: healthy when the database ping succeeds in time; the ping error is logged, not returned. */
export class HealthCheck {
  private readonly logger = new Logger(HealthCheck.name);

  constructor(private readonly ping: () => Promise<unknown>) {}

  async check(): Promise<HealthStatus> {
    try {
      await withTimeout(this.ping(), PING_TIMEOUT_MS);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      throw new DatabaseUnavailableException();
    }
    return { status: 'ok' };
  }
}
