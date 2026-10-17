import { Body, Controller, Inject, Post } from '@nestjs/common';
import { BookAppointmentUseCase } from '../application/book-appointment.use-case';
import { Appointment } from '../domain/entities';
import { BookAppointmentDto } from './dtos/book-appointment.dto';

/** POST /appointments (DESIGN.md, API Contract → HTTP): 201 with the created appointment, identifiers only. */
@Controller('appointments')
export class AppointmentsController {
  constructor(@Inject(BookAppointmentUseCase) private readonly bookAppointment: BookAppointmentUseCase) {}

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
}
