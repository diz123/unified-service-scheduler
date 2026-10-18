import { HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';

/** DESIGN.md O-4: 503 DATABASE_UNAVAILABLE in the standard error body. */
export class DatabaseUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({ statusCode: HttpStatus.SERVICE_UNAVAILABLE, code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' });
  }
}

export interface HealthStatus {
  status: 'ok';
}

/** DESIGN.md O-4: healthy when the database ping succeeds; the ping error is logged, not returned. */
export class HealthCheck {
  private readonly logger = new Logger(HealthCheck.name);

  constructor(private readonly ping: () => Promise<unknown>) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.ping();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      throw new DatabaseUnavailableException();
    }
    return { status: 'ok' };
  }
}
