import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthStatus } from './health-check';

/** GET /health (DESIGN.md O-4). */
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthCheck) private readonly health: HealthCheck) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
