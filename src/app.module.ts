import { Module } from '@nestjs/common';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { PRISMA_CLIENT } from './modules/scheduling/scheduling.tokens';
import { createDatabasePing, DATABASE_PING, DatabasePing } from './shared/infrastructure/database/database-ping';
import { HealthCheck } from './shared/presentation/health-check';
import { HealthController } from './shared/presentation/health.controller';

@Module({
  imports: [SchedulingModule],
  controllers: [HealthController],
  providers: [
    // DESIGN.md O-4: the database ping reuses the application's Prisma client.
    { provide: DATABASE_PING, useFactory: createDatabasePing, inject: [PRISMA_CLIENT] },
    {
      provide: HealthCheck,
      useFactory: (ping: DatabasePing): HealthCheck => new HealthCheck(ping),
      inject: [DATABASE_PING],
    },
  ],
})
export class AppModule {}
