import { Controller, Get, Inject, Param } from '@nestjs/common';
import { DealershipSummary, ServiceTypeSummary } from '../application/ports/scheduling-read-model.port';
import { SchedulingQueries } from '../application/scheduling-queries';

/** GET /dealerships and GET /dealerships/:dealershipId/service-types (DESIGN.md, Read-Only Operations → HTTP). */
@Controller('dealerships')
export class DealershipsController {
  constructor(@Inject(SchedulingQueries) private readonly queries: SchedulingQueries) {}

  @Get()
  list(): Promise<DealershipSummary[]> {
    return this.queries.listDealerships();
  }

  @Get(':dealershipId/service-types')
  listServiceTypes(@Param('dealershipId') dealershipId: string): Promise<ServiceTypeSummary[]> {
    return this.queries.listServiceTypes(dealershipId);
  }
}
