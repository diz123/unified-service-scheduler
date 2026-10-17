import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { BookAppointmentUseCase } from '../application/book-appointment.use-case';
import { AppointmentSummary } from '../application/ports/scheduling-read-model.port';
import { SchedulingQueries } from '../application/scheduling-queries';
import { Appointment } from '../domain/entities';
import { BookAppointmentDto } from './dtos/book-appointment.dto';
import { LookUpAppointmentsDto } from './dtos/look-up-appointments.dto';

/** POST /appointments and POST /appointments/lookup (DESIGN.md, API Contract → HTTP). */
@Controller('appointments')
export class AppointmentsController {
  constructor(
    @Inject(BookAppointmentUseCase) private readonly bookAppointment: BookAppointmentUseCase,
    @Inject(SchedulingQueries) private readonly queries: SchedulingQueries,
  ) {}

  /** 201 with the created appointment, identifiers only. */
  @Post()
  create(@Body() dto: BookAppointmentDto): Promise<Appointment> {
    return this.bookAppointment.execute({
      name: dto.name,
      phone: dto.phone,
      licensePlate: dto.licensePlate,
      make: dto.make,
      model: dto.model,
      dealershipId: dto.dealershipId,
      serviceTypeId: dto.serviceTypeId,
      startTime: new Date(dto.startTime),
      overnightConsent: dto.overnightConsent,
    });
  }

  /** POST, not GET, so the phone never appears in a URL or access log. */
  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  lookUp(@Body() dto: LookUpAppointmentsDto): Promise<AppointmentSummary[]> {
    return this.queries.lookUpAppointments({ licensePlate: dto.licensePlate, phone: dto.phone });
  }
}
