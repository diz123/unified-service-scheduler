import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../shared/infrastructure/database/generated/client';
import { createPrismaClient } from '../../shared/infrastructure/database/prisma-client.factory';
import { BookAppointmentUseCase } from './application/book-appointment.use-case';
import { BookingUnitOfWork } from './application/ports/booking-unit-of-work.port';
import { Clock } from './application/ports/clock.port';
import { PrismaBookingUnitOfWork } from './infrastructure/database/prisma-booking-unit-of-work';
import { AppointmentsController } from './presentation/appointments.controller';
import { BOOKING_UNIT_OF_WORK, CLOCK, PRISMA_CLIENT } from './scheduling.tokens';

const systemClock: Clock = { now: () => new Date() };

@Module({
  controllers: [AppointmentsController],
  providers: [
    { provide: PRISMA_CLIENT, useFactory: createPrismaClient },
    {
      provide: BOOKING_UNIT_OF_WORK,
      useFactory: (prisma: PrismaClient): BookingUnitOfWork => new PrismaBookingUnitOfWork(prisma),
      inject: [PRISMA_CLIENT],
    },
    { provide: CLOCK, useValue: systemClock },
    {
      provide: BookAppointmentUseCase,
      useFactory: (unitOfWork: BookingUnitOfWork, clock: Clock): BookAppointmentUseCase =>
        new BookAppointmentUseCase(unitOfWork, clock),
      inject: [BOOKING_UNIT_OF_WORK, CLOCK],
    },
  ],
})
export class SchedulingModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
