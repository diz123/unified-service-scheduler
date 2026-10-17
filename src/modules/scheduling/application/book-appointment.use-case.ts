import { Appointment, Technician } from '../domain/entities';
import { normalizeLicensePlate } from '../domain/license-plate';
import {
  BayUnavailableException,
  PlatePhoneMismatchException,
  ResourceNotFoundException,
  SkillMismatchException,
  TechnicianUnavailableException,
  VehicleUnavailableException,
} from '../domain/scheduling.exceptions';
import {
  assertOvernightConsent,
  assertStartNotInPast,
  assertStartWithinWorkingHours,
  computeServiceWindow,
  localDayRange,
} from '../domain/working-hours';
import { BookAppointmentCommand } from './commands/book-appointment.command';
import { BookingTransaction, BookingUnitOfWork } from './ports/booking-unit-of-work.port';
import { Clock } from './ports/clock.port';

const withoutSpaces = (phone: string): string => phone.replace(/ /g, '');

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export class BookAppointmentUseCase {
  constructor(
    private readonly unitOfWork: BookingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(command: BookAppointmentCommand): Promise<Appointment> {
    const licensePlate = normalizeLicensePlate(command.licensePlate);
    return this.unitOfWork.run(licensePlate, command.dealershipId, (tx) => this.book(tx, command, licensePlate));
  }

  private async book(tx: BookingTransaction, command: BookAppointmentCommand, licensePlate: string): Promise<Appointment> {
    const dealership = await tx.findDealership(command.dealershipId);
    const serviceType = await tx.findServiceType(command.serviceTypeId);
    if (!dealership) {
      throw new ResourceNotFoundException('dealership');
    }
    if (!serviceType || serviceType.dealershipId !== dealership.id) {
      throw new ResourceNotFoundException('serviceType');
    }

    const startTime = command.startTime;
    assertStartNotInPast(startTime, this.clock.now());
    assertStartWithinWorkingHours(startTime, dealership);
    const window = computeServiceWindow(startTime, serviceType.durationMinutes, dealership);
    assertOvernightConsent(window, command.overnightConsent);
    const endTime = window.endTime;

    const existing = await tx.findVehicleByPlate(licensePlate);
    if (existing && withoutSpaces(existing.owner.phone) !== withoutSpaces(command.phone)) {
      throw new PlatePhoneMismatchException();
    }

    const technicians = (await tx.listTechnicians(dealership.id)).filter((t) =>
      t.skills.includes(serviceType.requiredSkill),
    );
    if (technicians.length === 0) {
      throw new SkillMismatchException();
    }

    if (existing) {
      const vehicleBookings = await tx.findConfirmedAppointments({
        from: startTime,
        to: endTime,
        vehicleId: existing.vehicle.id,
      });
      if (vehicleBookings.length > 0) {
        throw new VehicleUnavailableException();
      }
    }

    const overlapping = await tx.findConfirmedAppointments({ from: startTime, to: endTime, dealershipId: dealership.id });
    const busyBays = new Set(overlapping.map((a) => a.serviceBayId));
    const busyTechnicians = new Set(overlapping.map((a) => a.technicianId));

    const bay = (await tx.listServiceBays(dealership.id)).filter((b) => !busyBays.has(b.id)).sort(byName)[0];
    if (!bay) {
      throw new BayUnavailableException();
    }

    const freeTechnicians = technicians.filter((t) => !busyTechnicians.has(t.id));
    if (freeTechnicians.length === 0) {
      throw new TechnicianUnavailableException();
    }
    const technician = await this.leastLoaded(tx, freeTechnicians, startTime, dealership.id, dealership.timezone);

    // Customers and vehicles are created only after allocation succeeds, so a rejected booking creates nothing.
    const vehicle =
      existing?.vehicle ??
      (await tx.createVehicle({
        customerId: (await tx.createCustomer({ name: command.name, phone: command.phone })).id,
        licensePlate,
        make: command.make,
        model: command.model,
      }));

    return tx.createAppointment({
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
      dealershipId: dealership.id,
      serviceTypeId: serviceType.id,
      serviceBayId: bay.id,
      technicianId: technician.id,
      startTime,
      endTime,
      status: 'Confirmed',
    });
  }

  /** Fewest Confirmed appointments overlapping the local date of `startTime`; ties by name (DESIGN.md A-2). */
  private async leastLoaded(
    tx: BookingTransaction,
    technicians: Technician[],
    startTime: Date,
    dealershipId: string,
    timezone: string,
  ): Promise<Technician> {
    const sameDay = await tx.findConfirmedAppointments({ ...localDayRange(startTime, timezone), dealershipId });
    const workload = (t: Technician): number => sameDay.filter((a) => a.technicianId === t.id).length;
    return [...technicians].sort((a, b) => workload(a) - workload(b) || byName(a, b))[0];
  }
}
